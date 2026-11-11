
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, ShieldAlert, Check, Shield } from 'lucide-react';
import type { CollectionResult, CollectionStatus } from '@/types/inspection';
import { Badge } from './Badge';
import { Card } from './Card';

interface ModuleAccordionsProps {
  modules?: Record<string, CollectionResult<unknown>>;
}

interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
}

const MODULE_KEY_ALIASES: Record<string, string[]> = {
  identity: ['identity'],
  seo: ['seo', 'metadata', 'structuredData'],
  securityHeaders: ['securityHeaders', 'security', 'securitySignals', 'forms'],
  performance: ['performance'],
  accessibility: ['accessibility'],
  technology: ['technology'],
  dns: ['dns', 'tls', 'certificate', 'ipAsn'],
  resources: ['resources', 'scripts', 'styles', 'media', 'links'],
  privacy: ['privacy', 'privacySignals'],
  content: ['content', 'dom', 'responsive'],
};

const SKIPPED_REASONS: Record<string, string> = {
  accessibility: 'Automated axe-core WCAG analysis is omitted in Quick Scan mode. Available in Full Page Audit and Deep Audit.',
  dns: 'External DoH queries, TLS cert verification, and ASN lookups run in Deep Audit mode.',
  privacy: 'In-depth tracker network profiling and cookie banner analysis run in Full Page Audit and Deep Audit modes.',
};

function resolveModule(modules: Record<string, CollectionResult<unknown>> = {}, key: string): CollectionResult<unknown> | undefined {
  if (modules[key]) return modules[key];
  const aliases = MODULE_KEY_ALIASES[key] || [];
  for (const alias of aliases) {
    if (modules[alias]) return modules[alias];
  }
  return undefined;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: 'identity', name: 'Overview & Identity', description: 'URL, document title, charset, language, canonical tag' },
  { key: 'seo', name: 'SEO & Metadata', description: 'Meta robots, OpenGraph, Twitter cards, hreflang' },
  { key: 'securityHeaders', name: 'Security & Headers', description: 'HTTPS, HSTS, CSP, SRI, X-Frame-Options' },
  { key: 'performance', name: 'Performance & Vitals', description: 'TTFB, FCP, LCP, CLS, render-blocking resources' },
  { key: 'accessibility', name: 'Accessibility (axe-core)', description: 'WCAG 2.1 AA violations, landmarks, heading hierarchy' },
  { key: 'technology', name: 'Technology & Frameworks', description: 'CMS, frontend frameworks, runtime analytics' },
  { key: 'dns', name: 'Infrastructure & DNS', description: 'DoH records, IP/ASN, CT logs, TLS certificates' },
  { key: 'resources', name: 'Resources & Assets', description: 'Script inventory, stylesheets, images & media' },
  { key: 'privacy', name: 'Privacy & Trackers', description: 'Consent banners, privacy policy, third-party trackers' },
  { key: 'content', name: 'Content & DOM Structure', description: 'DOM depth, sanitized forms, text density' },
];

export const ModuleAccordions: React.FC<ModuleAccordionsProps> = ({ modules = {} }) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleAccordion = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="p-4 space-y-3 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
            Rules &amp; Collection Modules
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Audit coverage and operational boundaries across 10 engine modules.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (expandedKeys.size === MODULE_DEFINITIONS.length) {
              setExpandedKeys(new Set());
            } else {
              setExpandedKeys(new Set(MODULE_DEFINITIONS.map((m) => m.key)));
            }
          }}
          className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
        >
          {expandedKeys.size === MODULE_DEFINITIONS.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <Card padding="none" className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
        {MODULE_DEFINITIONS.map((def) => {
          const mod = resolveModule(modules, def.key);
          const isExpanded = expandedKeys.has(def.key);
          const status = mod?.status ?? 'skipped';
          const limitations = mod?.limitations || [];
          const sources = mod?.sources || [];
          const errors = mod?.errors || [];

          return (
            <div
              key={def.key}
              className="transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleAccordion(def.key)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-150 ease-out active:scale-[0.995] cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-orange-500 shrink-0 transition-transform duration-200 ease-out" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ease-out" />
                  )}
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {def.name}
                  </span>
                </div>

                <div className="shrink-0 ml-2">
                  {status === 'completed' ? (
                    <span
                      title="Module collected"
                      className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md select-none"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <Badge variant="collection" collectionStatus={status}>
                      {status}
                    </Badge>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 space-y-3 text-xs transition-all duration-200 ease-out animate-in fade-in-0 slide-in-from-top-1">
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {def.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span>Status: </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{status}</span>
                      {status === 'skipped' && SKIPPED_REASONS[def.key] && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 col-span-2 leading-normal">
                          {SKIPPED_REASONS[def.key]}
                        </p>
                      )}
                    </div>
                    {mod?.collectedAt && (
                      <div>
                        <span>Collected: </span>
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {new Date(mod.collectedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {sources.length > 0 && (
                    <div className="text-zinc-600 dark:text-zinc-400">
                      <span>Sources: </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{sources.join(', ')}</span>
                    </div>
                  )}

                  {def.key === 'technology' && Array.isArray((mod?.data as any)?.technologies) && (mod?.data as any).technologies.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs block">
                        Detected Technologies ({(mod?.data as any).technologies.length})
                      </span>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                        {((mod?.data as any).technologies as any[]).map((t: any, idx: number) => (
                          <div key={idx} className="p-2 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{t.name}</span>
                                {t.version && <span className="text-2xs text-zinc-500 font-mono">v{t.version}</span>}
                              </div>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 block truncate">{t.evidence}</span>
                            </div>
                            <span className="shrink-0 text-2xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {t.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sources.includes('ConsentManager') && (
                    <div className="rounded-lg bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 p-2.5 space-y-1.5 text-xs text-zinc-800 dark:text-zinc-200">
                      <div className="flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>Privacy Protection (Zero-Telemetry Guardrail)</span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        This lookup queries external servers (Cloudflare DoH, IP-API, crt.sh). To protect your browsing privacy, SiteRadar pauses external third-party requests until you explicitly opt in.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                            chrome.tabs.create({ url: chrome.runtime.getURL('options.html#intelligence'), active: true });
                          } else if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
                            chrome.runtime.openOptionsPage();
                          } else {
                            window.open('options.html#intelligence', '_blank');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer pt-0.5"
                      >
                        <span>Enable external lookups in Settings (⚙️)</span>
                        <span>→</span>
                      </button>
                    </div>
                  )}

                  {limitations.length > 0 && (
                    <div className="border-l-2 border-orange-500 pl-3 py-0.5 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>Operational Limitations</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400 text-xs">
                        {Array.from(new Set(limitations)).map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div className="border-l-2 border-rose-500 pl-3 py-0.5 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Execution Errors</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400 text-xs">
                        {Array.from(new Set(errors)).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};
