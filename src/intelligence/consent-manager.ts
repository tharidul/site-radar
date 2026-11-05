/**
 * @file src/intelligence/consent-manager.ts
 * @description User consent gatekeeper and transient clear-key manager for external intelligence.
 * Strictly guarantees no third-party network lookups execute without explicit user opt-in.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, 14, Feature 38.
 */

import type { IntelligenceProviderType, ConsentDisclosure } from '@/types/intelligence';
import type { BrowserAdapter } from '@/browser/adapters/types';

export interface IntelligenceConsentState {
  doh: boolean;
  'ip-asn': boolean;
  'crt-sh': boolean;
  tls: boolean;
  reputation: boolean;
  [provider: string]: boolean;
}

export class ConsentManager {
  private adapter?: BrowserAdapter;
  private consentStore = new Map<string, IntelligenceConsentState>();
  private globalConsent: IntelligenceConsentState = {
    doh: false,
    'ip-asn': false,
    'crt-sh': false,
    tls: false,
    reputation: false,
  };

  constructor(adapter?: BrowserAdapter) {
    this.adapter = adapter;
  }

  /**
   * Checks whether consent is granted for a specific provider, either globally or per-origin.
   */
  hasConsent(provider: IntelligenceProviderType): boolean;
  hasConsent(origin: string, provider: IntelligenceProviderType): boolean;
  hasConsent(arg1: string, arg2?: IntelligenceProviderType): boolean {
    if (arg2 !== undefined) {
      const origin = arg1;
      const provider = arg2;
      const state = this.consentStore.get(origin);
      if (state && typeof state[provider] === 'boolean') {
        return state[provider];
      }
      return Boolean(this.globalConsent[provider]);
    }

    const provider = arg1 as IntelligenceProviderType;
    return Boolean(this.globalConsent[provider]);
  }

  /**
   * Sets consent preferences either globally for a provider or for a specific origin.
   */
  setConsent(provider: IntelligenceProviderType, granted: boolean): void;
  setConsent(origin: string, consent: Partial<IntelligenceConsentState>): void;
  setConsent(
    arg1: string | IntelligenceProviderType,
    arg2?: boolean | Partial<IntelligenceConsentState>,
  ): void {
    if (typeof arg2 === 'boolean') {
      const provider = arg1 as IntelligenceProviderType;
      this.globalConsent[provider] = arg2;
      return;
    }

    const origin = arg1 as string;
    const consent = (arg2 || {}) as Partial<IntelligenceConsentState>;
    const existing = this.consentStore.get(origin) || {
      doh: false,
      'ip-asn': false,
      'crt-sh': false,
      tls: false,
      reputation: false,
    };
    this.consentStore.set(origin, { ...existing, ...consent } as IntelligenceConsentState);
  }

  /**
   * Revokes all consent for a specific origin or clears all stored consent entirely.
   */
  revokeConsent(origin?: string): void {
    if (origin) {
      this.consentStore.delete(origin);
    } else {
      this.consentStore.clear();
      this.globalConsent = {
        doh: false,
        'ip-asn': false,
        'crt-sh': false,
        tls: false,
        reputation: false,
      };
    }
  }

  /**
   * Throws an explicit error if user consent has not been granted for the requested operation.
   * Matches /User consent required/i pattern.
   */
  assertConsent(origin: string, provider: IntelligenceProviderType): void {
    if (!this.hasConsent(origin, provider)) {
      throw new Error(
        `User consent required: external intelligence lookup '${provider}' for '${origin}' was blocked: explicit user consent is required.`,
      );
    }
  }

  /**
   * Generates a clear, informative consent disclosure object for user presentation.
   */
  getDisclosure(provider: IntelligenceProviderType, targetHost: string): ConsentDisclosure {
    switch (provider) {
      case 'doh':
        return {
          providerName: 'Cloudflare / Google DNS-over-HTTPS',
          providerUrl: 'https://cloudflare-dns.com/dns-query',
          lookupType: 'doh',
          targetHost,
          dataToSend: [targetHost, 'DNS Record Type'],
          privacyPolicyUrl: 'https://www.cloudflare.com/privacypolicy/',
          isPublicService: true,
          requiresApiKey: false,
        };
      case 'ip-asn':
        return {
          providerName: 'IP-API / ipapi.co',
          providerUrl: 'https://ipapi.co/',
          lookupType: 'ip-asn',
          targetHost,
          dataToSend: ['Target IP Address'],
          privacyPolicyUrl: 'https://ipapi.co/privacy/',
          isPublicService: true,
          requiresApiKey: false,
        };
      case 'crt-sh':
        return {
          providerName: 'crt.sh (Sectigo Certificate Transparency)',
          providerUrl: 'https://crt.sh/',
          lookupType: 'crt-sh',
          targetHost,
          dataToSend: [targetHost],
          privacyPolicyUrl: 'https://crt.sh/',
          isPublicService: true,
          requiresApiKey: false,
        };
      case 'tls':
        return {
          providerName: 'In-Browser TLS Security Inspector',
          providerUrl: 'https://' + targetHost,
          lookupType: 'tls',
          targetHost,
          dataToSend: [targetHost, 'Security Response Headers'],
          isPublicService: true,
          requiresApiKey: false,
        };
      default:
        return {
          providerName: String(provider),
          providerUrl: 'https://localhost',
          lookupType: provider,
          targetHost,
          dataToSend: [targetHost],
          isPublicService: true,
          requiresApiKey: false,
        };
    }
  }
}

export const consentManager = new ConsentManager();
