/**
 * @file entrypoints/popup/components/FindingDetailInspector.tsx
 * @description Finding detail inspector modal displaying rule identifier, human-readable
 * explanation, redacted evidence table, confidence indicator, remediation guidance,
 * and reference links (Feature 46).
 * Adheres strictly to anti-slop guidelines: technical legibility, monospaced data, zero XSS.
 */

import React, { useEffect } from 'react';
import { X, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
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
        return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
      case 'high':
        return 'text-orange-400 bg-orange-950/70 border-orange-800/80';
      case 'medium':
        return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
      case 'low':
        return 'text-sky-400 bg-sky-950/70 border-sky-800/80';
      case 'info':
      default:
        return 'text-cyan-400 bg-cyan-950/70 border-cyan-800/80';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs"
    >
      <div className="w-full max-w-md max-h-[540px] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 p-3.5 bg-zinc-900/60 select-none">
          <div className="space-y-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-xs uppercase font-bold border rounded-full px-2.5 py-0.5 shrink-0 ${getSeverityBadgeClass(
                  finding.severity,
                )}`}
              >
                {finding.severity}
              </span>
              <span className="text-xs uppercase font-semibold text-zinc-300 border border-zinc-800 rounded-full px-2.5 py-0.5 shrink-0">
                {finding.status}
              </span>
              <span className="font-mono text-xs text-zinc-400 shrink-0">
                {finding.ruleId}
              </span>
            </div>
            <h3
              id="inspector-title"
              className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug"
            >
              {finding.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
          {/* Explanation */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Description &amp; Impact
            </span>
            <p className="text-zinc-300 text-[13px] leading-relaxed">
              {finding.description}
            </p>
          </div>

          {/* Expected Behavior */}
          {finding.expectedBehavior && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100 block">
                Expected Behavior
              </span>
              <p className="text-zinc-300 text-[13px] leading-relaxed">
                {finding.expectedBehavior}
              </p>
            </div>
          )}

          {/* Detailed Technical Explanation */}
          {finding.explanation && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 block">
                Technical Explanation
              </span>
              <p className="text-zinc-300 text-[13px] leading-relaxed">
                {finding.explanation}
              </p>
            </div>
          )}

          {/* Heuristic Confidence */}
          {finding.confidence !== undefined && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs">
              <span className="text-zinc-400">Heuristic Confidence:</span>
              <span className="font-semibold text-zinc-200 tabular-nums">
                {Math.round(finding.confidence * 100)}%
              </span>
            </div>
          )}

          {/* Remediation Guidance */}
          {finding.recommendation && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-2.5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Recommended Remediation</span>
              </span>
              <p className="text-zinc-200 text-[13px] leading-relaxed">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Redacted Evidence Table */}
          {finding.evidence && finding.evidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 block">
                Observed Evidence (Sanitized)
              </span>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] text-zinc-400 uppercase tracking-wider">
                      <th className="p-1.5 font-medium">Label</th>
                      <th className="p-1.5 font-medium">Value</th>
                      <th className="p-1.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finding.evidence.map((ev, i) => (
                      <tr key={i} className="border-b border-zinc-800/60 last:border-b-0">
                        <td className="p-1.5 font-medium text-zinc-300 align-top whitespace-nowrap">
                          {ev.label}
                        </td>
                        <td className="p-1.5 font-mono text-[11px] text-orange-400 break-all whitespace-pre-wrap">
                          {formatEvidenceValue(ev.value)}
                        </td>
                        <td className="p-1.5 text-zinc-400 text-xs align-top whitespace-nowrap">
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
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 block">
                Documentation References
              </span>
              <ul className="space-y-1 text-xs">
                {finding.references.map((ref, idx) => (
                  <li key={idx} className="truncate">
                    <a
                      href={sanitizeHref(ref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{ref}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 bg-zinc-900/60 p-2.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
