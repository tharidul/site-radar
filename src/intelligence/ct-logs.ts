/**
 * @file src/intelligence/ct-logs.ts
 * @description Certificate Transparency (CT) log query client for crt.sh.
 * Extracts historical TLS certificates, issuing CAs, and discovers subdomains.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, Feature 36.
 */

import type {
  CertificateTransparencyResult,
  CertificateTransparencyRecord,
} from '@/types/intelligence';
import { consentManager } from './consent-manager';

export interface CtLogsOptions {
  timeoutMs?: number;
  skipConsentCheck?: boolean;
}

export class CtLogsClient {
  private timeoutMs: number;
  private skipConsentCheck: boolean;

  constructor(options?: CtLogsOptions) {
    this.timeoutMs = options?.timeoutMs || 10000;
    this.skipConsentCheck = options?.skipConsentCheck ?? false;
  }

  /**
   * Queries crt.sh Certificate Transparency logs for the specified domain.
   */
  async query(domain: string): Promise<CertificateTransparencyResult> {
    const cleanDomain = domain.toLowerCase().trim().replace(/\.+$/, '');
    const origin = `https://${cleanDomain}`;

    if (!this.skipConsentCheck) {
      consentManager.assertConsent(origin, 'crt-sh');
    }

    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), this.timeoutMs);

    try {
      const url = `https://crt.sh/?q=${encodeURIComponent('%.' + cleanDomain)}&output=json`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: timeoutCtrl.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`crt.sh responded with HTTP status ${response.status}`);
      }

      const json = await response.json();
      const records: CertificateTransparencyRecord[] = [];

      if (Array.isArray(json)) {
        // Limit to most recent 50 certificates to prevent memory bloat
        for (const item of json.slice(0, 50)) {
          records.push({
            id: item.id || item.min_cert_id || Math.random().toString(36).slice(2),
            issuerName: item.issuer_name || '',
            commonName: item.common_name || '',
            nameValue: item.name_value || '',
            notBefore: item.not_before || '',
            notAfter: item.not_after || '',
            serialNumber: item.serial_number || '',
            loggedAt: item.entry_timestamp || undefined,
          });
        }
      }

      const partialResult: CertificateTransparencyResult = {
        domain: cleanDomain,
        totalFound: Array.isArray(json) ? json.length : 0,
        certificates: records,
        records,
        queriedAt: Date.now(),
        provider: 'crt.sh',
      };

      const subdomainsDiscovered = this.extractSubdomains(partialResult);

      return {
        ...partialResult,
        subdomainsDiscovered,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        domain: cleanDomain,
        totalFound: 0,
        certificates: [],
        records: [],
        subdomainsDiscovered: [],
        queriedAt: Date.now(),
        provider: 'crt.sh',
        error: err?.message || 'Certificate Transparency lookup failed',
      };
    }
  }

  /**
   * Extracts unique, deduplicated subdomains from Certificate Transparency SANs.
   */
  extractSubdomains(ctResult: CertificateTransparencyResult): string[] {
    const subdomains = new Set<string>();
    const baseDomain = ctResult.domain.toLowerCase();

    const certList = ctResult.certificates || ctResult.records || [];
    for (const cert of certList) {
      const names = [cert.commonName, ...(cert.nameValue ? cert.nameValue.split(/[\n,]/) : [])];
      for (const rawName of names) {
        const name = rawName.trim().toLowerCase().replace(/^\*\./, '');
        if (name && name.endsWith('.' + baseDomain)) {
          subdomains.add(name);
        }
      }
    }

    return Array.from(subdomains).sort();
  }
}

export const ctLogsClient = new CtLogsClient();
