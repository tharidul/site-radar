/**
 * @file entrypoints/popup/components/PageVitalsCard.tsx
 * @description Dedicated dashboard component displaying page loading times
 * and total data/resource usage. Designed with a clean, elegant, unified surface layout.
 */

import React, { useState, useCallback } from 'react';
import { Clock, ArrowDownToLine, Loader2 } from 'lucide-react';
import type { WebsiteInspection, PerformanceData } from '@/types/inspection';
import { messageBus } from '../../../src/messaging/bus';
import { MESSAGE_CHANNELS } from '../../../src/types/messaging';
import { getBrowserAdapter } from '../../../src/browser/adapters';

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

  // Scrolled full page measurement state
  const [scrolledData, setScrolledData] = useState<{
    transferBytes?: number;
    resourceCount?: number;
    decodedBytes?: number;
    isInfiniteScroll?: boolean;
  } | null>(
    perfData?.scrolledTransferSizeApprox !== undefined
      ? {
          transferBytes: perfData.scrolledTransferSizeApprox,
          resourceCount: perfData.scrolledResourceCount,
          decodedBytes: perfData.scrolledDecodedSizeApprox,
          isInfiniteScroll: perfData.isInfiniteScrollDetected,
        }
      : null
  );
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMeasureScrolled = useCallback(async () => {
    setIsMeasuring(true);
    setErrorMessage(null);
    try {
      const adapter = getBrowserAdapter();
      const tab = await adapter.getActiveTab();
      if (!tab?.id) {
        throw new Error('Active tab not found');
      }

      const res = await messageBus.sendToTab(
        tab.id,
        MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE,
        undefined
      );

      if (res && res.success) {
        const data = {
          transferBytes: res.scrolledTransferSizeApprox,
          resourceCount: res.scrolledResourceCount,
          decodedBytes: res.scrolledDecodedSizeApprox,
          isInfiniteScroll: res.isInfiniteScroll,
        };
        setScrolledData(data);
        if (perfData) {
          perfData.scrolledTransferSizeApprox = res.scrolledTransferSizeApprox;
          perfData.scrolledResourceCount = res.scrolledResourceCount;
          perfData.scrolledDecodedSizeApprox = res.scrolledDecodedSizeApprox;
          perfData.isInfiniteScrollDetected = res.isInfiniteScroll;
        }
      } else {
        throw new Error(res?.error || 'Scroll measurement failed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not measure page scroll');
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setIsMeasuring(false);
    }
  }, [perfData]);

  return (
    <div className="rounded-md bg-white dark:bg-zinc-900 p-5 shadow-xs">
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono bg-[#132737] text-[#CEFF52] border border-[#21435c] shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#CEFF52]" />
            <span>{primaryTime}</span>
          </span>
        )}
      </div>

      {/* Speed Timing Grid (Responsive: 2 columns on thin viewports, 4 columns on wide) */}
      <div className="grid grid-cols-2 min-[440px]:grid-cols-4 gap-2 py-3">
        {/* TTFB */}
        <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            TTFB
          </div>
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-0.5">
            {ttfb || '—'}
          </div>
          <div className="text-[10px] mt-0.5 truncate">
            {ttfb ? (
              <span className="text-[#152E40] dark:text-[#CEFF52] font-semibold">Server response</span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">Cached / Nav</span>
            )}
          </div>
        </div>

        {/* FCP */}
        <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            FCP
          </div>
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-0.5">
            {fcp || '—'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            First content paint
          </div>
        </div>

        {/* LCP */}
        <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            LCP
          </div>
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-0.5">
            {lcp || '—'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            Largest element
          </div>
        </div>

        {/* Load Event */}
        <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Load Event
          </div>
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-0.5">
            {fullLoad || domLoad || 'Complete'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            {fullLoad ? 'Window load' : domLoad ? 'DOM ready' : 'Rendered'}
          </div>
        </div>
      </div>

      {/* Data Usage & Payload Footer Bar */}
      <div className="border-t border-zinc-200/70 dark:border-zinc-800 pt-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {/* 1. Initial Load Usage */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              Data Usage:
            </span>
            <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] font-mono tabular-nums shrink-0">
              {transferBytes && transferBytes > 0
                ? formatBytes(transferBytes)
                : decodedBytes && decodedBytes > 0
                ? `~${formatBytes(decodedBytes)}`
                : `${totalRequests} reqs`}
            </span>
            <span
              className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0"
              title="Assets fetched up to the initial viewport. Below-the-fold assets load dynamically on scroll."
            >
              (Initial • {totalRequests} reqs)
            </span>
          </div>

          {/* 2. Full Page (Scrolled) Usage */}
          {scrolledData ? (
            <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                Full Page:
              </span>
              <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] font-mono tabular-nums shrink-0">
                {scrolledData.transferBytes && scrolledData.transferBytes > 0
                  ? formatBytes(scrolledData.transferBytes)
                  : `${scrolledData.resourceCount || 0} reqs`}
              </span>
              <span
                className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0"
                title="Total assets transferred after scrolling the webpage to trigger all lazy-loaded content."
              >
                (Scrolled • {scrolledData.resourceCount || totalRequests} reqs)
              </span>
              {scrolledData.isInfiniteScroll && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400 shrink-0"
                  title="This site appends infinite content on scroll. Measurement was safely bounded to initial loaded viewports."
                >
                  Infinite Feed (Bounded)
                </span>
              )}
              {scrolledData.transferBytes && transferBytes && scrolledData.transferBytes > transferBytes && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
                  +{formatBytes(scrolledData.transferBytes - transferBytes)} lazy
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMeasureScrolled}
              disabled={isMeasuring}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#152E40] dark:text-[#CEFF52] hover:underline cursor-pointer disabled:opacity-50 transition-colors"
              title="Scroll the page to bottom to trigger and measure below-the-fold lazy-loaded assets and infinite scroll"
            >
              {isMeasuring ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#152E40] dark:text-[#CEFF52]" />
                  <span>Slowly scrolling page...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
                  <span>Scroll &amp; measure full page</span>
                </>
              )}
            </button>
          )}

          {errorMessage && (
            <span className="text-[10px] text-rose-600 dark:text-rose-400">
              {errorMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
