/**
 * @file entrypoints/popup/components/ModuleAccordions.tsx
 * @description 10 expandable module result accordions displaying execution status,
 * coverage metrics, operational limitations, and key-value tables (Feature 44).
 * Adheres strictly to anti-slop guidelines: compact, functional, high information density.
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
          <span className="text-xs font-medium text-zinc-100 bg-zinc-800/80 border border-zinc-700/80 rounded-full px-2.5 py-0.5">
            Completed
          </span>
        );
      case 'partial':
        return (
          <span className="text-xs font-medium text-orange-400 bg-orange-950/60 border border-orange-800/80 rounded-full px-2.5 py-0.5">
            Partial
          </span>
        );
      case 'blocked':
        return (
          <span className="text-xs font-medium text-rose-400 bg-rose-950/60 border border-rose-800/80 rounded-full px-2.5 py-0.5">
            Blocked
          </span>
        );
      case 'failed':
        return (
          <span className="text-xs font-medium text-rose-400 bg-rose-950/60 border border-rose-800/80 rounded-full px-2.5 py-0.5">
            Failed
          </span>
        );
      case 'unsupported':
        return (
          <span className="text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-2.5 py-0.5">
            Unsupported
          </span>
        );
      case 'skipped':
      default:
        return (
          <span className="text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-2.5 py-0.5">
            Skipped
          </span>
        );
    }
  };

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Module Coverage
        </span>
        <button
          type="button"
          onClick={() => {
            if (expandedKeys.size === MODULE_DEFINITIONS.length) {
              setExpandedKeys(new Set());
            } else {
              setExpandedKeys(new Set(MODULE_DEFINITIONS.map((m) => m.key)));
            }
          }}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {expandedKeys.size === MODULE_DEFINITIONS.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1.5">
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
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleAccordion(def.key)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-zinc-200 truncate">
                    {def.name}
                  </span>
                </div>

                <div className="shrink-0 ml-2">
                  {getStatusBadge(status)}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-zinc-800/60 bg-zinc-950/80 space-y-2 text-[11px]">
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {def.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div>
                      <span>Status: </span>
                      <span className="text-zinc-200 font-semibold">{status}</span>
                    </div>
                    {mod?.collectedAt && (
                      <div>
                        <span>Time: </span>
                        <span className="text-zinc-200">
                          {new Date(mod.collectedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {sources.length > 0 && (
                    <div className="text-xs text-zinc-400">
                      <span className="text-zinc-400">Sources: </span>
                      <span className="text-zinc-300">{sources.join(', ')}</span>
                    </div>
                  )}

                  {limitations.length > 0 && (
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs space-y-1.5">
                      <div className="font-semibold flex items-center gap-1.5 text-orange-400">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Operational Limitations:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                        {Array.from(new Set(limitations)).map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs space-y-1.5">
                      <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Execution Errors:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-zinc-300">
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
