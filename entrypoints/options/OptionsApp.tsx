/**
 * @file entrypoints/options/OptionsApp.tsx
 * @description Dedicated options and settings page (Feature 47).
 * Manages external intelligence consent, provider disclosures, masked session API keys,
 * and bounded crawl boundaries.
 * Adheres strictly to anti-slop guidelines: compact, intentional, zero decorative fluff.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Compass,
  FileText,
  Check,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  RotateCcw,
  Sun,
  Moon,
} from 'lucide-react';
import { MESSAGE_CHANNELS } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import { consentManager } from '../../src/intelligence/consent-manager';
import type { IntelligenceProviderType, ConsentDisclosure } from '@/types/intelligence';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';
import { CustomSelect } from '../popup/components/CustomSelect';
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

const PROVIDER_LIST: Array<{ id: IntelligenceProviderType; name: string }> = [
  { id: 'doh', name: 'DNS-over-HTTPS (DoH)' },
  { id: 'ip-asn', name: 'IP & ASN Intelligence' },
  { id: 'crt-sh', name: 'Certificate Transparency (crt.sh)' },
  { id: 'tls', name: 'TLS Security Inspector' },
];

export function OptionsApp() {
  // Consent states
  const [globalConsent, setGlobalConsent] = useState(false);
  const [providerConsents, setProviderConsents] = useState<Record<string, boolean>>({
    doh: false,
    'ip-asn': false,
    'crt-sh': false,
    tls: false,
  });

  // API Key management
  const [selectedProvider, setSelectedProvider] = useState('shodan');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);

  // Crawl boundaries
  const [crawlConfig, setCrawlConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [crawlFeedback, setCrawlFeedback] = useState<string | null>(null);

  // Selected provider disclosure inline toggle
  const [expandedDisclosureProviderId, setExpandedDisclosureProviderId] = useState<string | null>(null);

  // Theme management
  const [theme, setTheme] = useState<AppTheme>('dark');

  // Initial load
  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const adapter = getBrowserAdapter();
        const [savedTheme, consentResults, keyRes, stored] = await Promise.all([
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
          messageBus
            .sendToBackground(MESSAGE_CHANNELS.GET_CONFIGURED_PROVIDERS, undefined)
            .catch(() => null),
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

          if (keyRes?.configuredProviders) {
            setConfiguredProviders(keyRes.configuredProviders);
          }
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

  // Toggle individual provider consent
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

  // Revoke all consent
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

  // Set API Key
  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setKeyFeedback('API key cannot be empty');
      setTimeout(() => setKeyFeedback(null), 3000);
      return;
    }

    try {
      const res = await messageBus.sendToBackground(MESSAGE_CHANNELS.SET_API_KEY, {
        provider: selectedProvider,
        key: trimmed,
        isSessionOnly: true,
      });

      if (res.success) {
        setApiKeyInput('');
        setKeyFeedback(`API key saved for ${selectedProvider} (Session memory only)`);
        if (!configuredProviders.includes(selectedProvider)) {
          setConfiguredProviders([...configuredProviders, selectedProvider]);
        }
      } else {
        setKeyFeedback(res.error || 'Failed to set API key');
      }
    } catch (err: any) {
      setKeyFeedback(err?.message || 'Error saving API key');
    }
    setTimeout(() => setKeyFeedback(null), 3000);
  };

  // Remove API Key
  const handleRemoveApiKey = async (provider: string) => {
    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.REMOVE_API_KEY, {
        provider,
      });
      setConfiguredProviders(configuredProviders.filter((p) => p !== provider));
      setKeyFeedback(`API key removed for ${provider}`);
    } catch (err: any) {
      setKeyFeedback('Failed to remove API key');
    }
    setTimeout(() => setKeyFeedback(null), 3000);
  };

  // Clamp and save crawl limits
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
    <div data-theme={theme} className={`min-h-screen bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-6 md:p-10 select-none ${theme}`}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 pb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                Website Intelligence Settings
              </h1>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Privacy controls, provider consent, session API keys, and crawl boundaries
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            leftIcon={
              theme === 'light' ? (
                <Moon className="w-4 h-4 text-zinc-700" />
              ) : (
                <Sun className="w-4 h-4 text-orange-400" />
              )
            }
          >
            {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </header>

        {/* Section 1: External Intelligence Consent (Feature 47) */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>External Intelligence Consent</span>
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Local-first inspection executes in-browser. External lookups require explicit user opt-in.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleRevokeAllConsent}
            >
              Revoke All
            </Button>
          </div>

          <div className="space-y-3">
            {PROVIDER_LIST.map((provider) => {
              const isGranted = Boolean(providerConsents[provider.id]);
              const disclosure = consentManager.getDisclosure(provider.id, 'target-example.com');
              const isDisclosureOpen = expandedDisclosureProviderId === provider.id;

              return (
                <div
                  key={provider.id}
                  className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/80 p-3 space-y-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {provider.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedDisclosureProviderId((prev) => prev === provider.id ? null : provider.id)}
                          className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline cursor-pointer"
                        >
                          {isDisclosureOpen ? 'Hide Disclosure' : 'View Disclosure'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        Endpoint: <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">{disclosure.providerUrl}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleProviderConsent(provider.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                        isGranted
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-400'
                          : 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700'
                      }`}
                    >
                      {isGranted ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {/* Inline Disclosure Accordion */}
                  {isDisclosureOpen && (
                    <div className="pt-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Endpoint URL: </span>
                        <span className="text-zinc-900 dark:text-zinc-100 text-xs font-mono break-all">{disclosure.providerUrl}</span>
                      </div>

                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Data Transmitted: </span>
                        <span className="text-zinc-900 dark:text-zinc-100">{disclosure.dataToSend.join(', ')}</span>
                      </div>

                      {disclosure.privacyPolicyUrl && (
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Privacy Policy: </span>
                          <a
                            href={disclosure.privacyPolicyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{disclosure.privacyPolicyUrl}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Session-Only API Key Management */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4 shadow-xs">
          <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>Third-Party API Keys (Session Memory Only)</span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              API keys are stored transiently in memory for the active session. They are never written to disk or included in reports.
            </p>
          </div>

          {/* deslop-ignore-next-line 28 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                Intelligence Provider
              </label>
              <CustomSelect
                value={selectedProvider}
                options={[
                  { value: 'shodan', label: 'Shodan' },
                  { value: 'virustotal', label: 'VirusTotal' },
                  { value: 'securitytrails', label: 'SecurityTrails' },
                  { value: 'censys', label: 'Censys' },
                  { value: 'custom', label: 'Custom Provider' },
                ]}
                onChange={setSelectedProvider}
                fullWidth
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter secret API key..."
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 pr-8 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-2 top-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                  title={showApiKey ? 'Hide key' : 'Show key'}
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              {keyFeedback}
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveApiKey}
            >
              Save API Key
            </Button>
          </div>

          {/* Configured Providers List */}
          {configuredProviders.length > 0 && (
            <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300 block">
                Configured providers in memory:
              </span>
              <div className="flex flex-wrap gap-2">
                {configuredProviders.map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200"
                  >
                    <span className="capitalize font-medium">{provider}</span>
                    <Badge size="xs">
                      Active
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleRemoveApiKey(provider)}
                      className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      title="Remove key"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Bounded Crawl Limits Configuration */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4 shadow-xs">
          <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>Bounded Deep Crawl Limits</span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Limits safeguard browser performance, battery life, and network bandwidth during deep inspections.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                Max Pages (5–200)
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={crawlConfig.maxPages}
                onChange={(e) => handleUpdateCrawlLimit('maxPages', parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                Max Depth (1–5)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={crawlConfig.maxDepth}
                onChange={(e) => handleUpdateCrawlLimit('maxDepth', parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                Concurrency (1–4)
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={crawlConfig.concurrency}
                onChange={(e) => handleUpdateCrawlLimit('concurrency', parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-400 block mb-1">
                Timeout (5–60s)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={crawlConfig.timeoutSeconds}
                onChange={(e) => handleUpdateCrawlLimit('timeoutSeconds', parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium tabular-nums focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
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
                Reset Defaults
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

        {/* Developer Attribution Footer */}
        <footer className="pt-6 pb-2 text-center border-t border-zinc-200/80 dark:border-zinc-800/80">
          <a
            href="https://tharidulakmal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400 transition-colors"
          >
            <span>Developed by</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">Tharidu Lakmal</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-2">tharidulakmal.com</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </footer>
      </div>
    </div>
  );
}
