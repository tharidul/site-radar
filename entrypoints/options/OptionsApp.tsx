
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Compass,
  FileText,
  Check,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { MESSAGE_CHANNELS } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import { consentManager } from '../../src/intelligence/consent-manager';
import type { IntelligenceProviderType, ConsentDisclosure } from '@/types/intelligence';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';
import { Button } from '../popup/components/Button';
import { Badge } from '../popup/components/Badge';

interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  timeoutSeconds: number;
}

const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 50,
  maxDepth: 3,
  concurrency: 2,
  timeoutSeconds: 15,
};

interface ProviderItem {
  id: IntelligenceProviderType;
  name: string;
  summary: string;
  endpoint: string;
}

const PROVIDER_LIST: ProviderItem[] = [
  {
    id: 'doh',
    name: 'DNS-over-HTTPS (DoH)',
    summary: 'Resolves DNS A, AAAA, MX, and TXT records via Cloudflare (1.1.1.1) to verify DNSSEC and CNAME chains.',
    endpoint: 'https://cloudflare-dns.com/dns-query',
  },
  {
    id: 'ip-asn',
    name: 'IP & ASN Intelligence',
    summary: 'Identifies hosting provider, data center, Autonomous System Number (ASN), and network routing via ipapi.co.',
    endpoint: 'https://ipapi.co/',
  },
  {
    id: 'crt-sh',
    name: 'Certificate Transparency (crt.sh)',
    summary: 'Audits historical SSL/TLS certificates and known subdomains logged to public CT transparency logs.',
    endpoint: 'https://crt.sh/',
  },
  {
    id: 'tls',
    name: 'TLS Security Inspector',
    summary: 'Inspects active TLS protocol version, cipher suite strength, and certificate validity directly.',
    endpoint: 'Direct host connection',
  },
];

export function OptionsApp() {
  const [globalConsent, setGlobalConsent] = useState(false);
  const [providerConsents, setProviderConsents] = useState<Record<string, boolean>>({
    doh: false,
    'ip-asn': false,
    'crt-sh': false,
    tls: false,
  });

  const [crawlConfig, setCrawlConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [crawlFeedback, setCrawlFeedback] = useState<string | null>(null);

  const [expandedDisclosureProviderId, setExpandedDisclosureProviderId] = useState<string | null>(null);

  const [theme, setTheme] = useState<AppTheme>('dark');

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const adapter = getBrowserAdapter();
        const [savedTheme, consentResults, stored] = await Promise.all([
          loadSavedTheme().catch(() => 'dark' as AppTheme),
          Promise.all(
            PROVIDER_LIST.map(async (p) => {
              try {
                const res = await messageBus.sendToBackground(
                  MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
                  { provider: p.id },
                );
                return [p.id, Boolean(res.granted)] as const;
              } catch {
                return [p.id, false] as const;
              }
            }),
          ),
          adapter.getStorage<CrawlConfig>(['crawlLimits']).catch(() => null),
        ]);

        if (mounted) {
          if (savedTheme) {
            setTheme(savedTheme);
            applyThemeToDom(savedTheme);
          }
          const consents: Record<string, boolean> = Object.fromEntries(consentResults);
          setProviderConsents(consents);
          setGlobalConsent(Object.values(consents).some(Boolean));

          if (stored?.crawlLimits) {
            setCrawlConfig(stored.crawlLimits);
          }
        }
      } catch (err) {
        console.warn('Error loading settings concurrently:', err);
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleProviderConsent = async (provider: IntelligenceProviderType) => {
    const nextGranted = !providerConsents[provider];
    setProviderConsents((prev) => ({ ...prev, [provider]: nextGranted }));

    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, {
        provider,
        granted: nextGranted,
      });
    } catch (err) {
      console.error('Failed to update consent:', err);
    }
  };

  const handleRevokeAllConsent = async () => {
    const cleared: Record<string, boolean> = {
      doh: false,
      'ip-asn': false,
      'crt-sh': false,
      tls: false,
    };
    setProviderConsents(cleared);
    setGlobalConsent(false);

    for (const p of PROVIDER_LIST) {
      try {
        await messageBus.sendToBackground(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, {
          provider: p.id,
          granted: false,
        });
      } catch {}
    }
  };

  const handleUpdateCrawlLimit = (field: keyof CrawlConfig, value: number) => {
    setCrawlConfig((prev) => {
      let clamped = value;
      if (field === 'maxPages') clamped = Math.max(5, Math.min(200, value || 5));
      if (field === 'maxDepth') clamped = Math.max(1, Math.min(5, value || 1));
      if (field === 'concurrency') clamped = Math.max(1, Math.min(4, value || 1));
      if (field === 'timeoutSeconds') clamped = Math.max(5, Math.min(60, value || 5));

      return { ...prev, [field]: clamped };
    });
  };

  const handleSaveCrawlLimits = async () => {
    try {
      const adapter = getBrowserAdapter();
      await adapter.setStorage({ crawlLimits: crawlConfig });
      setCrawlFeedback('Crawl boundaries saved');
    } catch (err) {
      setCrawlFeedback('Failed to save crawl limits');
    }
    setTimeout(() => setCrawlFeedback(null), 2500);
  };

  const handleResetCrawlLimits = () => {
    setCrawlConfig(DEFAULT_CRAWL_CONFIG);
    setCrawlFeedback('Reset to default boundaries');
    setTimeout(() => setCrawlFeedback(null), 2500);
  };

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyThemeToDom(nextTheme);
    saveTheme(nextTheme);
  };

  return (
    <div data-theme={theme} className={`min-h-screen overflow-y-auto bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-6 md:p-8 select-none ${theme}`}>
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="border-b border-zinc-200 dark:border-zinc-800/80 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Shield className="w-6 h-6 text-[#152E40] dark:text-[#CEFF52] shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                SiteRadar Settings
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Privacy controls, intelligence opt-in, and audit boundaries
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label="Toggle theme"
            className="shrink-0 border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            ) : (
              <Sun className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
            )}
          </Button>
        </header>

        <section className="rounded-md bg-white dark:bg-zinc-900/60 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <span>External Intelligence Opt-In</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                SiteRadar runs 100% locally by default. Enable external lookups for deep network intelligence.
              </p>
            </div>
            {Object.values(providerConsents).some(Boolean) && (
              <button
                type="button"
                onClick={handleRevokeAllConsent}
                className="text-xs font-semibold text-zinc-500 hover:text-[#152E40] dark:text-zinc-400 dark:hover:text-[#CEFF52] transition-colors cursor-pointer shrink-0"
              >
                Disable all
              </button>
            )}
          </div>

          {PROVIDER_LIST.map((provider) => {
            const isGranted = Boolean(providerConsents[provider.id]);
            const disclosure = consentManager.getDisclosure(provider.id, 'inspected host');
            const isDisclosureOpen = expandedDisclosureProviderId === provider.id;

            return (
              <div key={provider.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {provider.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedDisclosureProviderId((prev) => (prev === provider.id ? null : provider.id))}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{isDisclosureOpen ? 'Hide' : 'Details'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isDisclosureOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                      {provider.summary}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isGranted}
                    onClick={() => handleToggleProviderConsent(provider.id)}
                    title={isGranted ? `Disable ${provider.name}` : `Enable ${provider.name}`}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#CEFF52]/50 active:scale-[0.97] ${
                      isGranted ? 'bg-[#CEFF52]' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full ${isGranted ? 'bg-[#152E40]' : 'bg-white'} shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isGranted ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isDisclosureOpen && (
                  <div className="pt-2 text-xs space-y-1 text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">Endpoint:</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-mono text-xs select-all">{provider.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">Data transmitted:</span>
                      <span className="text-zinc-800 dark:text-zinc-200">{disclosure.dataToSend.join(', ')}</span>
                    </div>
                    {disclosure.privacyPolicyUrl && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">Privacy Policy:</span>
                        <a
                          href={disclosure.privacyPolicyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#152E40] dark:text-[#CEFF52] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{disclosure.providerName}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="rounded-md bg-white dark:bg-zinc-900/60 p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3">
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>Deep Crawl Boundaries</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Protects tab performance, memory, and battery during multi-page link exploration.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Max Pages
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={crawlConfig.maxPages}
                onChange={(e) => handleUpdateCrawlLimit('maxPages', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-[#CEFF52] focus:outline-none transition-colors"
              />
              <span className="text-2xs text-zinc-400 mt-0.5 block">5–200 pages</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Max Depth
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={crawlConfig.maxDepth}
                onChange={(e) => handleUpdateCrawlLimit('maxDepth', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-[#CEFF52] focus:outline-none transition-colors"
              />
              <span className="text-2xs text-zinc-400 mt-0.5 block">1–5 hops</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Concurrency
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={crawlConfig.concurrency}
                onChange={(e) => handleUpdateCrawlLimit('concurrency', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-[#CEFF52] focus:outline-none transition-colors"
              />
              <span className="text-2xs text-zinc-400 mt-0.5 block">1–4 parallel</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Timeout
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={crawlConfig.timeoutSeconds}
                onChange={(e) => handleUpdateCrawlLimit('timeoutSeconds', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-[#CEFF52] focus:outline-none transition-colors"
              />
              <span className="text-2xs text-zinc-400 mt-0.5 block">5–60 seconds</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
            <span className="text-xs text-[#152E40] dark:text-[#CEFF52] font-semibold">
              {crawlFeedback}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetCrawlLimits}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveCrawlLimits}
              >
                Save Boundaries
              </Button>
            </div>
          </div>
        </section>

        <footer className="pt-4 pb-2 text-center border-t border-zinc-200/80 dark:border-zinc-800/80">
          <div className="inline-flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <a
              href="https://tharidulakmal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[#152E40] dark:hover:text-[#CEFF52] transition-colors"
            >
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">LKML</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <a
              href="privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#152E40] dark:hover:text-[#CEFF52] transition-colors hover:underline"
            >
              Privacy Policy
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
