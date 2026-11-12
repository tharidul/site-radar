
import type { IntelligenceProviderType, ConsentDisclosure } from '@/types/intelligence';
import { getBrowserAdapter, type BrowserAdapter } from '@/browser/adapters';

export const CONSENT_STORAGE_KEY = 'siteradar_intelligence_consent';
export const ORIGIN_CONSENT_STORAGE_KEY = 'siteradar_intelligence_origin_consent';

export interface IntelligenceConsentState {
  doh: boolean;
  'ip-asn': boolean;
  'crt-sh': boolean;
  tls: boolean;
  reputation: boolean;
  [provider: string]: boolean;
}

const DEFAULT_CONSENT_STATE: IntelligenceConsentState = {
  doh: false,
  'ip-asn': false,
  'crt-sh': false,
  tls: false,
  reputation: false,
};

function createDefaultConsentState(): IntelligenceConsentState {
  return { ...DEFAULT_CONSENT_STATE };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeConsentState(raw: unknown): IntelligenceConsentState {
  const next = createDefaultConsentState();
  if (!isPlainRecord(raw)) {
    return next;
  }
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'boolean') {
      next[key] = val;
    }
  }
  return next;
}

export class ConsentManager {
  private adapter?: BrowserAdapter;
  private consentStore = new Map<string, IntelligenceConsentState>();
  private globalConsent: IntelligenceConsentState = createDefaultConsentState();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private dirtyGlobalKeys = new Set<string>();
  private dirtyOrigins = new Set<string>();
  private deletedOrigins = new Set<string>();
  private mutationEpoch = 0;

  constructor(adapter?: BrowserAdapter) {
    this.adapter = adapter;
  }

  private resolveAdapter(): BrowserAdapter {
    return this.adapter || getBrowserAdapter();
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getGlobalConsent(): IntelligenceConsentState {
    return { ...this.globalConsent };
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    return this.loadConsent();
  }

  async loadConsent(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const startEpoch = this.mutationEpoch;
    const run = (async () => {
      try {
        const adapter = this.resolveAdapter();
        const stored = await adapter.getStorage<unknown>(
          [CONSENT_STORAGE_KEY, ORIGIN_CONSENT_STORAGE_KEY],
          'local',
        );

        // If a full clear occurred while reading storage, discard the stale snapshot.
        if (this.mutationEpoch !== startEpoch) {
          return;
        }

        const storedGlobal = stored?.[CONSENT_STORAGE_KEY];
        if (isPlainRecord(storedGlobal)) {
          const mergedGlobal = normalizeConsentState(storedGlobal);
          for (const key of this.dirtyGlobalKeys) {
            if (typeof this.globalConsent[key] === 'boolean') {
              mergedGlobal[key] = this.globalConsent[key];
            }
          }
          this.globalConsent = mergedGlobal;
        }

        const storedOrigins = stored?.[ORIGIN_CONSENT_STORAGE_KEY];
        if (isPlainRecord(storedOrigins)) {
          const dirtySnapshots = new Map<string, IntelligenceConsentState>();
          for (const origin of this.dirtyOrigins) {
            const existing = this.consentStore.get(origin);
            if (existing) {
              dirtySnapshots.set(origin, existing);
            }
          }

          const nextStore = new Map<string, IntelligenceConsentState>();
          for (const [origin, state] of Object.entries(storedOrigins)) {
            if (isPlainRecord(state)) {
              nextStore.set(origin, normalizeConsentState(state));
            }
          }
          for (const origin of this.deletedOrigins) {
            nextStore.delete(origin);
          }
          for (const [origin, snapshot] of dirtySnapshots.entries()) {
            nextStore.set(origin, snapshot);
          }
          this.consentStore = nextStore;
        }

        this.dirtyGlobalKeys.clear();
        this.dirtyOrigins.clear();
        this.deletedOrigins.clear();
        this.loaded = true;
      } catch (err) {
        console.warn('Failed to load intelligence consent from storage:', err);
      } finally {
        this.loadPromise = null;
      }
    })();

    this.loadPromise = run;
    return run;
  }

  private async persistToStorage(): Promise<void> {
    try {
      const adapter = this.resolveAdapter();
      const originConsent: Record<string, IntelligenceConsentState> = {};
      for (const [origin, state] of this.consentStore.entries()) {
        originConsent[origin] = { ...state };
      }

      await adapter.setStorage(
        {
          [CONSENT_STORAGE_KEY]: { ...this.globalConsent },
          [ORIGIN_CONSENT_STORAGE_KEY]: originConsent,
        },
        'local',
      );
    } catch (err) {
      console.warn('Failed to persist intelligence consent to storage:', err);
    }
  }

  private enqueuePersist(): Promise<void> {
    const run = async () => {
      await this.ensureLoaded();
      await this.persistToStorage();
    };
    this.persistQueue = this.persistQueue.then(run, run);
    return this.persistQueue;
  }

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

  setConsent(provider: IntelligenceProviderType, granted: boolean): Promise<void>;
  setConsent(origin: string, consent: Partial<IntelligenceConsentState>): Promise<void>;
  setConsent(
    arg1: string | IntelligenceProviderType,
    arg2?: boolean | Partial<IntelligenceConsentState>,
  ): Promise<void> {
    if (typeof arg2 === 'boolean') {
      const provider = arg1 as IntelligenceProviderType;
      this.globalConsent[provider] = arg2;
      this.dirtyGlobalKeys.add(provider);
      return this.enqueuePersist();
    }

    const origin = arg1 as string;
    const consent = (arg2 || {}) as Partial<IntelligenceConsentState>;
    const existing = this.consentStore.get(origin) || createDefaultConsentState();
    this.consentStore.set(origin, { ...existing, ...consent } as IntelligenceConsentState);
    this.dirtyOrigins.add(origin);
    this.deletedOrigins.delete(origin);
    return this.enqueuePersist();
  }

  revokeConsent(origin?: string): Promise<void> {
    if (origin) {
      this.consentStore.delete(origin);
      this.dirtyOrigins.delete(origin);
      this.deletedOrigins.add(origin);
      return this.enqueuePersist();
    }

    this.mutationEpoch += 1;
    this.consentStore.clear();
    this.globalConsent = createDefaultConsentState();
    this.dirtyGlobalKeys.clear();
    this.dirtyOrigins.clear();
    this.deletedOrigins.clear();
    this.loaded = true;
    return this.enqueuePersist();
  }

  clearConsent(): Promise<void> {
    return this.revokeConsent();
  }

  assertConsent(origin: string, provider: IntelligenceProviderType): void {
    if (!this.hasConsent(origin, provider)) {
      throw new Error(
        `User consent required: external intelligence lookup '${provider}' for '${origin}' was blocked: explicit user consent is required.`,
      );
    }
  }

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
        };
      case 'tls':
        return {
          providerName: 'In-Browser TLS Security Inspector',
          providerUrl: 'https://' + targetHost,
          lookupType: 'tls',
          targetHost,
          dataToSend: [targetHost, 'Security Response Headers'],
          isPublicService: true,
        };
      default:
        return {
          providerName: String(provider),
          providerUrl: 'https://localhost',
          lookupType: provider,
          targetHost,
          dataToSend: [targetHost],
          isPublicService: true,
        };
    }
  }
}

export const consentManager = new ConsentManager();
