
import type { DnsLookupResult, DnsAnswer, DnsRecordType } from '@/types/intelligence';
import { isPrivateIp, isProhibitedHostname } from '@/security/private-network.guard';
import { consentManager } from './consent-manager';

const DNS_TYPE_MAP: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const DNS_NUM_TO_TYPE: Record<number, DnsRecordType> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  257: 'CAA',
};

export interface DohResolverOptions {
  endpoint?: string;
  timeoutMs?: number;
  skipConsentCheck?: boolean;
}

export class DohResolver {
  private endpoint: string;
  private timeoutMs: number;
  private skipConsentCheck: boolean;

  constructor(options?: DohResolverOptions) {
    this.endpoint = options?.endpoint || 'https://cloudflare-dns.com/dns-query';
    this.timeoutMs = options?.timeoutMs || 8000;
    this.skipConsentCheck = options?.skipConsentCheck ?? false;
  }

  async resolve(
    domain: string,
    type: DnsRecordType = 'A',
    origin?: string,
  ): Promise<DnsLookupResult> {
    const cleanDomain = domain.toLowerCase().trim().replace(/\.+$/, '');
    const effectiveOrigin = origin || `https://${cleanDomain}`;

    if (!this.skipConsentCheck) {
      consentManager.assertConsent(effectiveOrigin, 'doh');
    }

    if (isPrivateIp(cleanDomain) || isProhibitedHostname(cleanDomain)) {
      return {
        domain: cleanDomain,
        resolver: this.endpoint,
        answers: [],
        queriedAt: Date.now(),
        responseCode: 2,
        status: 2,
        error: `Cannot query DoH for private or loopback domain: ${cleanDomain}`,
      };
    }

    const typeNum = DNS_TYPE_MAP[type] || 1;
    const url = new URL(this.endpoint);
    url.searchParams.set('name', cleanDomain);
    url.searchParams.set('type', String(typeNum));

    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/dns-json',
        },
        signal: timeoutCtrl.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`DoH server responded with HTTP status ${response.status}`);
      }

      const json = await response.json();
      const responseCode = typeof json.Status === 'number' ? json.Status : 0;
      const isTruncated = Boolean(json.TC);
      const isDnssecValidated = Boolean(json.AD);

      const rawAnswers = Array.isArray(json.Answer) ? json.Answer : [];
      const answers: DnsAnswer[] = [];

      for (const ans of rawAnswers) {
        const ansTypeNum = Number(ans.type);
        const typeName = DNS_NUM_TO_TYPE[ansTypeNum] || String(ansTypeNum);
        const data = String(ans.data || '');

        if ((typeName === 'A' || typeName === 'AAAA') && isPrivateIp(data)) {
          throw new Error(
            `DNS rebinding detected: DoH resolution returned private IP '${data}' for domain '${cleanDomain}'.`,
          );
        }

        answers.push({
          name: ans.name || cleanDomain,
          type: ansTypeNum,
          typeName,
          TTL: Number(ans.TTL || 0),
          data,
        });
      }

      return {
        domain: cleanDomain,
        resolver: this.endpoint,
        answers,
        queriedAt: Date.now(),
        responseCode,
        status: responseCode,
        isTruncated,
        isDnssecValidated,
        dnssecValid: isDnssecValidated,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        domain: cleanDomain,
        resolver: this.endpoint,
        answers: [],
        queriedAt: Date.now(),
        responseCode: 2,
        status: 2,
        error: err?.message || 'DoH lookup failed',
      };
    }
  }

  async resolveIps(domain: string): Promise<string[]> {
    const resA = await this.resolve(domain, 'A');
    const resAaaa = await this.resolve(domain, 'AAAA');

    const ips: string[] = [];
    for (const ans of [...resA.answers, ...resAaaa.answers]) {
      if (ans.typeName === 'A' || ans.typeName === 'AAAA') {
        ips.push(ans.data);
      }
    }
    return ips;
  }
}

export const dohResolver = new DohResolver();
