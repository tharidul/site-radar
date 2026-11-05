/**
 * @file src/intelligence/asn-lookup.ts
 * @description IP Geolocation, BGP prefix, and Autonomous System (ASN) lookup client.
 * Strictly verifies IP is public routable before initiating external network queries.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, Feature 35.
 */

import type { IpAsnLookupResult } from '@/types/intelligence';
import { isPrivateIp } from '@/security/private-network.guard';
import { consentManager } from './consent-manager';

export interface AsnLookupOptions {
  timeoutMs?: number;
  skipConsentCheck?: boolean;
}

export class AsnLookupClient {
  private timeoutMs: number;
  private skipConsentCheck: boolean;

  constructor(options?: AsnLookupOptions) {
    this.timeoutMs = options?.timeoutMs || 8000;
    this.skipConsentCheck = options?.skipConsentCheck ?? false;
  }

  /**
   * Resolves public IP address to ASN and geolocation metadata.
   */
  async lookup(ip: string, targetOrigin?: string): Promise<IpAsnLookupResult> {
    const cleanIp = ip.trim();

    // STRICT SSRF GUARD: Never query ASN / geolocation for private or loopback IPs
    if (isPrivateIp(cleanIp)) {
      return {
        ip: cleanIp,
        queriedAt: Date.now(),
        provider: 'Local Guard',
        error: `Cannot query ASN for private or loopback IP: ${cleanIp}`,
      };
    }

    if (!this.skipConsentCheck && targetOrigin) {
      consentManager.assertConsent(targetOrigin, 'ip-asn');
    }

    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), this.timeoutMs);

    try {
      // Query IP-API JSON endpoint with HTTPS
      const url = `https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: timeoutCtrl.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`ASN provider responded with HTTP status ${response.status}`);
      }

      const json = await response.json();

      let asnNum: number | undefined;
      if (json.asn) {
        const parsed = parseInt(String(json.asn).replace(/^AS/i, ''), 10);
        if (!isNaN(parsed)) asnNum = parsed;
      } else if (json.as) {
        const match = String(json.as).match(/AS(\d+)/i);
        if (match && match[1]) {
          asnNum = parseInt(match[1], 10);
        }
      }

      const country = json.country || json.country_name;
      const org = json.org || json.asn_org || json.as;

      return {
        ip: cleanIp,
        asn: asnNum,
        asNumber: asnNum,
        asOrganization: org,
        isp: json.isp || org,
        countryCode: json.countryCode || json.country_code,
        countryName: json.country_name || country,
        country,
        city: json.city,
        region: json.regionName || json.region,
        queriedAt: Date.now(),
        provider: 'ipapi.co',
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        ip: cleanIp,
        queriedAt: Date.now(),
        provider: 'ipapi.co',
        error: err?.message || 'IP/ASN lookup failed',
      };
    }
  }
}

export const asnLookupClient = new AsnLookupClient();
