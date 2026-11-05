/**
 * @file entrypoints/popup/components/ModuleAccordions.tsx
 * @description 10 expandable module result accordions displaying execution status,
 * coverage metrics, operational limitations, and key-value tables (Rules tab).
 * Redesigned to harmonize with the Website Intelligence visual standard.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, ShieldAlert } from 'lucide-react';
import type { CollectionResult, CollectionStatus } from '@/types/inspection';

interface ModuleAccordionsProps {
  modules?: Record<string, CollectionResult<unknown>>;
}

interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
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

  const getStatusBadge = (status: CollectionStatus = 'skipped') => {
    switch (status) {
      case 'completed':
        return (
          <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-md px-2 py-0.5">
            Completed
          </span>
        );
      case 'partial':
        return (
          <span className="text-[10px] font-semibold text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/80 border border-orange-200 dark:border-orange-800 rounded-md px-2 py-0.5">
            Partial
          </span>
        );
      case 'blocked':
        return (
          <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-md px-2 py-0.5">
            Blocked
          </span>
        );
      case 'failed':
        return (
          <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-md px-2 py-0.5">
            Failed
          </span>
        );
      case 'unsupported':
      case 'skipped':
      default:
        return (
          <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-0.5">
            {status}
          </span>
        );
    }
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

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {MODULE_DEFINITIONS.map((def) => {
          const mod = modules[def.key];
          const isExpanded = expandedKeys.has(def.key);
          const status = mod?.status ?? 'skipped';
          const limitations = mod?.limitations || [];
          const sources = mod?.sources || [];
          const errors = mod?.errors || [];

          return (
            <div
              key={def.key}
              className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggleAccordion(def.key)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {def.name}
                  </span>
                </div>

                <div className="shrink-0 ml-2">
                  {getStatusBadge(status)}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 space-y-2.5 text-xs">
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {def.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span>Status: </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{status}</span>
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
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">{sources.join(', ')}</span>
                    </div>
                  )}

                  {limitations.length > 0 && (
                    <div className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/10 p-2.5 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-orange-800 dark:text-orange-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <span>Operational Limitations:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-300 text-[11px]">
                        {Array.from(new Set(limitations)).map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 p-2.5 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-rose-800 dark:text-rose-400 text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Execution Errors:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-300 text-[11px]">
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
      </div>
    </div>
  );
};
