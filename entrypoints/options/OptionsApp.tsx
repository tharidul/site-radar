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

  // Selected provider disclosure modal/view
  const [activeDisclosure, setActiveDisclosure] = useState<ConsentDisclosure | null>(null);

  // Theme management
  const [theme, setTheme] = useState<AppTheme>('dark');

  // Initial load
  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      // 0. Load saved theme
      try {
        const savedTheme = await loadSavedTheme();
        if (mounted) {
          setTheme(savedTheme);
          applyThemeToDom(savedTheme);
        }
      } catch {
        // Fallback
      }

      // 1. Load consent states from background
      const consents: Record<string, boolean> = {};
      for (const p of PROVIDER_LIST) {
        try {
          const res = await messageBus.sendToBackground(
            MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
            { provider: p.id },
          );
          consents[p.id] = Boolean(res.granted);
        } catch {
          consents[p.id] = false;
        }
      }
      if (mounted) {
        setProviderConsents(consents);
        setGlobalConsent(Object.values(consents).some(Boolean));
      }

      // 2. Load configured API key providers
      try {
        const keyRes = await messageBus.sendToBackground(
          MESSAGE_CHANNELS.GET_CONFIGURED_PROVIDERS,
          undefined,
        );
        if (mounted && keyRes?.configuredProviders) {
          setConfiguredProviders(keyRes.configuredProviders);
        }
      } catch (err) {
        console.warn('Could not fetch configured providers:', err);
      }

      // 3. Load saved crawl limits from storage
      try {
        const adapter = getBrowserAdapter();
        const stored = await adapter.getStorage<CrawlConfig>(['crawlLimits']);
        if (mounted && stored?.crawlLimits) {
          setCrawlConfig(stored.crawlLimits);
        }
      } catch (err) {
        console.warn('Could not fetch stored crawl limits:', err);
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
    <div data-theme={theme} className={`min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6 md:p-10 select-none ${theme}`}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-zinc-800 pb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-zinc-100" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 leading-tight">
                Website Intelligence Settings
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Privacy controls, provider consent, session API keys, and crawl boundaries
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-zinc-700" />
            ) : (
              <Sun className="w-4 h-4 text-orange-400" />
            )}
            <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </header>

        {/* Section 1: External Intelligence Consent (Feature 47) */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>External Intelligence Consent</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Local-first inspection executes in-browser. External lookups require explicit user opt-in.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRevokeAllConsent}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-rose-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-rose-300 transition-colors cursor-pointer"
            >
              Revoke All
            </button>
          </div>

          <div className="space-y-3">
            {PROVIDER_LIST.map((provider) => {
              const isGranted = Boolean(providerConsents[provider.id]);
              const disclosure = consentManager.getDisclosure(provider.id, 'target-example.com');

              return (
                <div
                  key={provider.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-200">
                        {provider.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveDisclosure(disclosure)}
                        className="text-xs font-medium text-orange-400 hover:text-orange-300 underline cursor-pointer"
                      >
                        View Disclosure
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      Endpoint: <code className="font-mono text-[11px] text-zinc-300">{disclosure.providerUrl}</code>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleProviderConsent(provider.id)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      isGranted
                        ? 'border-orange-500 bg-orange-950/80 text-orange-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {isGranted ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Session-Only API Key Management */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-300" />
              <span>Third-Party API Keys (Session Memory Only)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              API keys are stored transiently in memory for the active session. They are never written to disk or included in reports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1">
                Intelligence Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
              >
                <option value="shodan">Shodan</option>
                <option value="virustotal">VirusTotal</option>
                <option value="securitytrails">SecurityTrails</option>
                <option value="censys">Censys</option>
                <option value="custom">Custom Provider</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-400 block mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter secret API key..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 pr-8 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  title={showApiKey ? 'Hide key' : 'Show key'}
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-orange-400">
              {keyFeedback}
            </span>
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="rounded-xl border border-orange-600 bg-orange-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-orange-400 transition-colors cursor-pointer"
            >
              Save API Key
            </button>
          </div>

          {/* Configured Providers List */}
          {configuredProviders.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 block">
                Configured Providers in Memory:
              </span>
              <div className="flex flex-wrap gap-2">
                {configuredProviders.map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
                  >
                    <span className="capitalize">{provider}</span>
                    <span className="text-[10px] font-semibold text-zinc-100 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-0.5">
                      Active
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveApiKey(provider)}
                      className="text-zinc-400 hover:text-rose-400 cursor-pointer"
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
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-zinc-300" />
              <span>Bounded Deep Crawl Limits</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Limits safeguard browser performance, battery life, and network bandwidth during deep inspections.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Max Pages (5–200)
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={crawlConfig.maxPages}
                onChange={(e) => handleUpdateCrawlLimit('maxPages', parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 font-medium tabular-nums focus:border-zinc-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Max Depth (1–5)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={crawlConfig.maxDepth}
                onChange={(e) => handleUpdateCrawlLimit('maxDepth', parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 font-medium tabular-nums focus:border-zinc-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Concurrency (1–4)
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={crawlConfig.concurrency}
                onChange={(e) => handleUpdateCrawlLimit('concurrency', parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 font-medium tabular-nums focus:border-zinc-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Timeout (5–60s)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={crawlConfig.timeoutSeconds}
                onChange={(e) => handleUpdateCrawlLimit('timeoutSeconds', parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 font-medium tabular-nums focus:border-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <span className="text-xs text-orange-400">
              {crawlFeedback}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCrawlLimits}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCrawlLimits}
                className="rounded-xl border border-orange-600 bg-orange-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-orange-400 transition-colors cursor-pointer"
              >
                Save Boundaries
              </button>
            </div>
          </div>
        </section>

        {/* Disclosure Modal */}
        {activeDisclosure && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          >
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Provider Data Disclosure: {activeDisclosure.providerName}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    Explicit Transparency Report
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDisclosure(null)}
                  className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-zinc-300">
                <div>
                  <span className="text-zinc-400">Endpoint URL: </span>
                  <span className="text-zinc-100 font-mono text-[11px] break-all">{activeDisclosure.providerUrl}</span>
                </div>

                <div>
                  <span className="text-zinc-400">Data Transmitted: </span>
                  <span className="text-zinc-100">{activeDisclosure.dataToSend.join(', ')}</span>
                </div>

                {activeDisclosure.privacyPolicyUrl && (
                  <div>
                    <span className="text-zinc-400">Privacy Policy: </span>
                    <a
                      href={activeDisclosure.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{activeDisclosure.privacyPolicyUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveDisclosure(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
