/**
 * @file entrypoints/popup/components/FindingDetailInspector.tsx
 * @description Finding detail inspector modal displaying rule identifier, human-readable
 * explanation, redacted evidence table, confidence indicator, remediation guidance,
 * and reference links (Feature 46).
 * Redesigned to harmonize with the Website Intelligence visual standard.
 */

import React, { useEffect } from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import type { AuditFinding, Severity } from '@/types/inspection';
import { sanitizeHref } from '../../../src/export/html.exporter';

interface FindingDetailInspectorProps {
  finding: AuditFinding | null;
  onClose: () => void;
}

export const FindingDetailInspector: React.FC<FindingDetailInspectorProps> = ({
  finding,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!finding) return null;

  const getSeverityBadgeClass = (severity: Severity) => {
    switch (severity) {
      case 'critical':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900';
      case 'high':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-900';
      case 'medium':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-900';
      case 'low':
        return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      case 'info':
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';
    }
  };

  const formatEvidenceValue = (val: unknown): string => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
    >
      <div className="w-full max-w-md max-h-[540px] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden animate-in fade-in duration-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200/90 dark:border-zinc-800 p-4 bg-zinc-50/70 dark:bg-zinc-950/60 select-none">
          <div className="space-y-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] uppercase font-bold border rounded-md px-2 py-0.5 shrink-0 ${getSeverityBadgeClass(
                  finding.severity,
                )}`}
              >
                {finding.severity}
              </span>
              <span className="text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-0.5 shrink-0">
                {finding.status}
              </span>
              <span className="font-medium text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                {finding.ruleId}
              </span>
            </div>
            <h3
              id="inspector-title"
              className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug pt-1"
            >
              {finding.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300">
          {/* Explanation */}
          <div>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block mb-1">
              Description &amp; Impact
            </span>
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
              {finding.description}
            </p>
          </div>

          {/* Expected Behavior */}
          {finding.expectedBehavior && (
            <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3 space-y-1">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 block">
                Expected Behavior
              </span>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                {finding.expectedBehavior}
              </p>
            </div>
          )}

          {/* Detailed Technical Explanation */}
          {finding.explanation && (
            <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3 space-y-1">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 block">
                Technical Explanation
              </span>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                {finding.explanation}
              </p>
            </div>
          )}

          {/* Heuristic Confidence */}
          {finding.confidence !== undefined && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Detection Confidence:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {Math.round(finding.confidence * 100)}%
              </span>
            </div>
          )}

          {/* Remediation Guidance */}
          {finding.recommendation && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3 space-y-1">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-orange-500" />
                <span>Recommended Remediation</span>
              </span>
              <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Redacted Evidence Table */}
          {finding.evidence && finding.evidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Observed Evidence (Sanitized)
              </span>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400">
                      <th className="p-2 font-semibold">Label</th>
                      <th className="p-2 font-semibold">Value</th>
                      <th className="p-2 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finding.evidence.map((ev, i) => (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80 last:border-b-0 bg-white dark:bg-zinc-900">
                        <td className="p-2 font-medium text-zinc-800 dark:text-zinc-300 align-top whitespace-nowrap">
                          {ev.label}
                        </td>
                        {/* deslop-ignore-next-line 34 */}
                        <td className="p-2 font-mono text-xs text-orange-600 dark:text-orange-400 break-all whitespace-pre-wrap">
                          {formatEvidenceValue(ev.value)}
                        </td>
                        <td className="p-2 text-zinc-500 dark:text-zinc-400 text-xs align-top whitespace-nowrap">
                          {ev.source || 'DOM'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* References */}
          {finding.references && finding.references.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Documentation References
              </span>
              <ul className="space-y-1 text-xs">
                {finding.references.map((ref, idx) => (
                  <li key={idx} className="truncate">
                    <a
                      href={sanitizeHref(ref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{ref}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
