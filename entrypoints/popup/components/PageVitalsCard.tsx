/**
 * @file entrypoints/popup/components/PageVitalsCard.tsx
 * @description Dedicated dashboard component displaying page loading times
 * and total data/resource usage. Designed with a clean, elegant, unified surface layout.
 */

import React from 'react';
import { Clock } from 'lucide-react';
import type { WebsiteInspection, PerformanceData } from '@/types/inspection';

interface PageVitalsCardProps {
  inspection: WebsiteInspection;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const PageVitalsCard: React.FC<PageVitalsCardProps> = ({ inspection }) => {
  const findings = inspection.findings || [];

  // Helper to extract evidence values as fallback for imported inspections
  const getEvidence = (ruleId: string, label: string): string | undefined => {
    const f = findings.find((item) => item.ruleId === ruleId);
    const ev = f?.evidence?.find((e) => e.label.toLowerCase() === label.toLowerCase());
    return ev?.value !== undefined ? String(ev.value) : undefined;
  };

  // Performance data extraction
  const perfData = inspection.modules?.performance?.data as PerformanceData | undefined;
  const navTiming = perfData?.navigationTiming;
  const paintTiming = perfData?.paintTiming;
  const webVitals = perfData?.webVitals;

  // Loading times
  const ttfb = navTiming?.ttfbMs !== undefined ? `${navTiming.ttfbMs}ms` : getEvidence('perf-ttfb', 'TTFB');
  const fcp = paintTiming?.fcpMs !== undefined ? `${paintTiming.fcpMs}ms` : getEvidence('perf-slow-fcp', 'FCP');
  const lcp = webVitals?.lcpMs !== undefined ? `${webVitals.lcpMs}ms` : getEvidence('perf-lcp', 'LCP');

  const fullLoadRaw = navTiming?.fullLoadMs;
  const domLoadRaw = navTiming?.domLoadMs;
  const fullLoad =
    fullLoadRaw !== undefined && fullLoadRaw > 0
      ? fullLoadRaw >= 1000
        ? `${(fullLoadRaw / 1000).toFixed(2)}s`
        : `${fullLoadRaw}ms`
      : undefined;
  const domLoad =
    domLoadRaw !== undefined && domLoadRaw > 0
      ? domLoadRaw >= 1000
        ? `${(domLoadRaw / 1000).toFixed(2)}s`
        : `${domLoadRaw}ms`
      : undefined;

  // Primary load time highlight (prefer fullLoad -> LCP -> FCP -> TTFB)
  const primaryTime = fullLoad || lcp || fcp || ttfb || '—';

  // Data & resource usage extraction
  const resModule = inspection.modules?.resources?.data as any;
  const totalRequests =
    perfData?.resourceCount ??
    (resModule?.scripts?.length || 0) +
      (resModule?.stylesheets?.length || 0) +
      (resModule?.images?.length || 0);

  const transferBytes = perfData?.transferSizeApprox;
  const decodedBytes = perfData?.decodedSizeApprox;

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200/70 dark:border-zinc-800">
        <div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Page Loading Times &amp; Data Usage
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Network metrics, paint timing, and resource payloads
          </p>
        </div>
        {primaryTime !== '—' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-[#132737] text-[#CEFF52] border border-[#21435c] shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#CEFF52]" />
            <span>{primaryTime}</span>
          </span>
        )}
      </div>

      {/* Speed Timing Grid (Seamless 4-column ticker without nested boxes) */}
      <div className="grid grid-cols-4 divide-x divide-zinc-200/70 dark:divide-zinc-800 py-3.5">
        {/* TTFB */}
        <div className="pr-3 pl-0">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            TTFB
          </div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {ttfb || '—'}
          </div>
          <div className="text-[11px] mt-0.5">
            {ttfb ? (
              <span className="text-[#CEFF52] font-semibold">Server response</span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">Cached / Nav</span>
            )}
          </div>
        </div>

        {/* FCP */}
        <div className="px-3">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            FCP
          </div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {fcp || '—'}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            First content paint
          </div>
        </div>

        {/* LCP */}
        <div className="px-3">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            LCP
          </div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {lcp || '—'}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Largest element
          </div>
        </div>

        {/* Load Event */}
        <div className="pl-3 pr-0">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Load Event
          </div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {fullLoad || domLoad || 'Complete'}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {fullLoad ? 'Window load' : domLoad ? 'DOM ready' : 'Rendered'}
          </div>
        </div>
      </div>

      {/* Data Usage & Payload Footer Bar */}
      <div className="border-t border-zinc-200/70 dark:border-zinc-800 pt-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
            Data Usage:
          </span>
          <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] font-mono tabular-nums shrink-0">
            {transferBytes && transferBytes > 0
              ? formatBytes(transferBytes)
              : decodedBytes && decodedBytes > 0
              ? `~${formatBytes(decodedBytes)} (Decoded)`
              : `${totalRequests} Network Requests`}
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate hidden sm:inline">
            {transferBytes && transferBytes > 0
              ? `• Total transferred across ${totalRequests} observable network subresources`
              : '• Subresource transfer sizes protected by cross-origin Timing-Allow-Origin'}
          </span>
        </div>
      </div>
    </div>
  );
};
