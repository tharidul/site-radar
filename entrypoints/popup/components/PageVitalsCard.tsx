import React, { useMemo } from 'react';
import {
  Timer,
  Zap,
  Image as ImageIcon,
  CheckCircle2,
  HardDrive,
  Layers,
  Globe,
  Activity,
} from 'lucide-react';
import type { WebsiteInspection, PerformanceData } from '@/types/inspection';

interface PageVitalsCardProps {
  inspection: WebsiteInspection;
  liveMetrics?: {
    resourceCount: number;
    wireTransferBytes: number;
    decodedBytes: number;
    cacheHitCount: number;
    cacheHitBytes: number;
    opaqueResourceCount: number;
  } | null;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  if (i === 0) return `${Math.round(bytes)} B`;
  const raw = bytes / Math.pow(k, i);
  if (raw % 1 === 0) return `${raw} ${sizes[i]}`;
  const decimals = i >= 2 && raw < 100 ? 2 : 1;
  const val = parseFloat(raw.toFixed(decimals));
  return `${val} ${sizes[i]}`;
}

function formatTiming(rawMs?: number, fallback?: string): string | undefined {
  if (rawMs !== undefined && rawMs !== null && !isNaN(rawMs) && rawMs >= 0) {
    if (rawMs >= 1000) {
      return `${(rawMs / 1000).toFixed(2)}s`;
    }
    const isInt = rawMs % 1 === 0;
    return isInt ? `${rawMs}ms` : `${rawMs.toFixed(1)}ms`;
  }
  if (fallback) {
    const match = fallback.match(/^(\d+(?:\.\d+)?)\s*(ms|s)?$/i);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      const unit = (match[2] || 'ms').toLowerCase();
      const ms = unit === 's' ? val * 1000 : val;
      if (ms >= 1000) {
        return `${(ms / 1000).toFixed(2)}s`;
      }
      const isInt = ms % 1 === 0;
      return isInt ? `${ms}ms` : `${ms.toFixed(1)}ms`;
    }
    return fallback;
  }
  return undefined;
}

function getSpeedRating(metric: 'ttfb' | 'fcp' | 'lcp' | 'load', ms?: number) {
  if (ms === undefined || ms === null || isNaN(ms) || ms < 0) {
    return { label: '—', colorClass: 'text-zinc-500', barClass: 'bg-zinc-300 dark:bg-zinc-700', pct: 0 };
  }
  switch (metric) {
    case 'ttfb':
      if (ms <= 800) return { label: 'Fast', colorClass: 'text-[#CEFF52]', barClass: 'bg-[#CEFF52]', pct: 100 };
      if (ms <= 1800) return { label: 'Moderate', colorClass: 'text-amber-400', barClass: 'bg-amber-400', pct: 60 };
      return { label: 'Slow', colorClass: 'text-rose-400', barClass: 'bg-rose-400', pct: 25 };
    case 'fcp':
      if (ms <= 1800) return { label: 'Good', colorClass: 'text-[#CEFF52]', barClass: 'bg-[#CEFF52]', pct: 100 };
      if (ms <= 3000) return { label: 'Moderate', colorClass: 'text-amber-400', barClass: 'bg-amber-400', pct: 60 };
      return { label: 'Slow', colorClass: 'text-rose-400', barClass: 'bg-rose-400', pct: 25 };
    case 'lcp':
      if (ms <= 2500) return { label: 'Good', colorClass: 'text-[#CEFF52]', barClass: 'bg-[#CEFF52]', pct: 100 };
      if (ms <= 4000) return { label: 'Needs Work', colorClass: 'text-amber-400', barClass: 'bg-amber-400', pct: 60 };
      return { label: 'Poor', colorClass: 'text-rose-400', barClass: 'bg-rose-400', pct: 25 };
    case 'load':
      if (ms <= 2500) return { label: 'Fast', colorClass: 'text-[#CEFF52]', barClass: 'bg-[#CEFF52]', pct: 100 };
      if (ms <= 5000) return { label: 'Normal', colorClass: 'text-sky-400', barClass: 'bg-sky-400', pct: 60 };
      return { label: 'Slow', colorClass: 'text-rose-400', barClass: 'bg-rose-400', pct: 25 };
  }
}

export const PageVitalsCard: React.FC<PageVitalsCardProps> = ({ inspection, liveMetrics }) => {
  const findings = inspection.findings || [];

  const getEvidence = (ruleId: string, label: string): string | undefined => {
    const f = findings.find((item) => item.ruleId === ruleId);
    const ev = f?.evidence?.find((e) => e.label.toLowerCase() === label.toLowerCase());
    return ev?.value !== undefined ? String(ev.value) : undefined;
  };

  const perfData = inspection.modules?.performance?.data as PerformanceData | undefined;
  const navTiming = perfData?.navigationTiming;
  const paintTiming = perfData?.paintTiming;
  const webVitals = perfData?.webVitals;

  const ttfb = formatTiming(navTiming?.ttfbMs, getEvidence('perf-ttfb', 'TTFB'));
  const fcp = formatTiming(paintTiming?.fcpMs, getEvidence('perf-slow-fcp', 'FCP'));
  const lcp = formatTiming(webVitals?.lcpMs, getEvidence('perf-lcp', 'LCP'));

  const fullLoadRaw = navTiming?.fullLoadMs;
  const domLoadRaw = navTiming?.domLoadMs;
  const fullLoad = formatTiming(fullLoadRaw);
  const domLoad = formatTiming(domLoadRaw);

  const ttfbRating = getSpeedRating('ttfb', navTiming?.ttfbMs);
  const fcpRating = getSpeedRating('fcp', paintTiming?.fcpMs);
  const lcpRating = getSpeedRating('lcp', webVitals?.lcpMs);
  const loadRating = getSpeedRating('load', fullLoadRaw ?? domLoadRaw);

  const resModule = inspection.modules?.resources?.data as any;
  const totalRequests =
    perfData?.resourceCount ??
    (resModule?.scripts?.length || 0) +
      (resModule?.stylesheets?.length || 0) +
      (resModule?.images?.length || 0);

  const wireBytes = perfData?.wireTransferBytes ?? perfData?.transferSizeApprox;
  const decodedBytes = perfData?.decodedBytes ?? perfData?.decodedSizeApprox;
  const cacheHitCount = perfData?.cacheHitCount;
  const cacheHitBytes = perfData?.cacheHitBytes;
  const opaqueResourceCount = perfData?.opaqueResourceCount;

  const scrolledData = useMemo(() => {
    const sWire = perfData?.scrolledWireTransferBytes ?? perfData?.scrolledTransferSizeApprox;
    const sDecoded = perfData?.scrolledDecodedBytes ?? perfData?.scrolledDecodedSizeApprox;
    const sResCount = perfData?.scrolledResourceCount;
    if (sWire !== undefined || sResCount !== undefined || sDecoded !== undefined) {
      return {
        wireBytes: sWire,
        transferBytes: sWire,
        decodedBytes: sDecoded,
        resourceCount: sResCount,
        cacheHitCount: perfData?.scrolledCacheHitCount,
        cacheHitBytes: perfData?.scrolledCacheHitBytes,
        opaqueResourceCount: perfData?.scrolledOpaqueResourceCount,
        isInfiniteScroll: perfData?.isInfiniteScrollDetected,
      };
    }
    return null;
  }, [perfData]);

  const lazyWire =
    scrolledData?.wireBytes && wireBytes && scrolledData.wireBytes > wireBytes
      ? scrolledData.wireBytes - wireBytes
      : 0;

  const lazyReqs =
    scrolledData?.resourceCount !== undefined && scrolledData.resourceCount > totalRequests
      ? scrolledData.resourceCount - totalRequests
      : 0;

  const lazyDecoded =
    scrolledData?.decodedBytes !== undefined && decodedBytes !== undefined && scrolledData.decodedBytes > decodedBytes
      ? scrolledData.decodedBytes - decodedBytes
      : 0;

  const hasLazyDelta = Boolean(
    scrolledData && (lazyWire > 0 || lazyReqs > 0 || lazyDecoded > 0 || scrolledData.isInfiniteScroll)
  );

  const isLive = Boolean(liveMetrics && liveMetrics.resourceCount > 0);
  const effectiveScrolledReqs = liveMetrics?.resourceCount
    ? Math.max(liveMetrics.resourceCount, scrolledData?.resourceCount || totalRequests)
    : scrolledData?.resourceCount || totalRequests;

  const hasDelta = Boolean(hasLazyDelta || effectiveScrolledReqs > totalRequests);

  const scrolledWire = scrolledData?.wireBytes ?? wireBytes;
  const scrolledDecoded = scrolledData?.decodedBytes ?? decodedBytes;
  const initialWire = wireBytes;
  const initialDecoded = decodedBytes;

  const effectiveWire = liveMetrics?.wireTransferBytes && liveMetrics.wireTransferBytes > 0
    ? Math.max(liveMetrics.wireTransferBytes, scrolledWire || initialWire || 0)
    : scrolledWire;

  const effectiveDecoded = liveMetrics?.decodedBytes && liveMetrics.decodedBytes > 0
    ? Math.max(liveMetrics.decodedBytes, scrolledDecoded || initialDecoded || 0)
    : scrolledDecoded;

  const totalWire = hasDelta ? effectiveWire : initialWire;
  const totalDecoded = hasDelta ? effectiveDecoded : initialDecoded;

  const displayCacheCount = Math.max(cacheHitCount ?? 0, scrolledData?.cacheHitCount ?? 0);
  const displayCacheBytes = Math.max(cacheHitBytes ?? 0, scrolledData?.cacheHitBytes ?? 0);
  const displayOpaqueCount = Math.max(opaqueResourceCount ?? 0, scrolledData?.opaqueResourceCount ?? 0);

  const compressionSavingsPct =
    totalDecoded && totalWire && totalDecoded > totalWire
      ? Math.round(((totalDecoded - totalWire) / totalDecoded) * 100)
      : 0;

  const timingMetrics = [
    {
      key: 'ttfb',
      label: 'TTFB',
      name: 'Time to First Byte',
      value: ttfb || '—',
      rating: ttfbRating,
      icon: Timer,
      target: '≤ 800ms',
    },
    {
      key: 'fcp',
      label: 'FCP',
      name: 'First Contentful Paint',
      value: fcp || '—',
      rating: fcpRating,
      icon: Zap,
      target: '≤ 1.8s',
    },
    {
      key: 'lcp',
      label: 'LCP',
      name: 'Largest Contentful Paint',
      value: lcp || '—',
      rating: lcpRating,
      icon: ImageIcon,
      target: '≤ 2.5s',
    },
    {
      key: 'load',
      label: 'Load',
      name: 'Window Load Event',
      value: fullLoad || domLoad || 'Complete',
      rating: loadRating,
      icon: CheckCircle2,
      target: '≤ 2.5s',
    },
  ];

  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 space-y-3.5 shadow-xs">
      {/* Header with Title */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/70 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#152E40]/10 dark:bg-[#CEFF52]/10 text-[#152E40] dark:text-[#CEFF52]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
              Page Loading Times &amp; Data Usage
            </h3>
            <p className="text-2xs text-zinc-500 dark:text-zinc-400">
              Core vitals, network transfer, and payload telemetry
            </p>
          </div>
        </div>
      </div>

      {/* 4 Performance Metric Cards: Clean unclipped layout */}
      <div className="grid grid-cols-2 min-[440px]:grid-cols-4 gap-2.5">
        {timingMetrics.map((m) => {
          const Icon = m.icon;
          const isGood = ['Fast', 'Good'].includes(m.rating.label);
          const isWarn = ['Moderate', 'Normal', 'Needs Work'].includes(m.rating.label);
          const isBad = ['Slow', 'Poor'].includes(m.rating.label);

          const ratingPillClass = isGood
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#CEFF52]'
            : isWarn
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : isBad
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : 'bg-zinc-500/10 text-zinc-500';

          return (
            <div
              key={m.key}
              title={`${m.name} (Target: ${m.target})`}
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col justify-between"
            >
              {/* Row 1: Label + Target threshold */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52] shrink-0" />
                  <span className="text-2xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider whitespace-nowrap">
                    {m.label}
                  </span>
                </div>
                <span className="text-2xs font-mono text-zinc-400 dark:text-zinc-500 shrink-0 whitespace-nowrap">
                  {m.target}
                </span>
              </div>

              {/* Row 2: Metric Value */}
              <div className="my-1.5">
                <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight">
                  {m.value}
                </div>
              </div>

              {/* Row 3: Status rating badge + calibrated gauge */}
              <div className="space-y-1.5 pt-1.5 border-t border-zinc-200/40 dark:border-zinc-800/50">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-2xs font-semibold px-1.5 py-0.2 rounded shrink-0 ${ratingPillClass}`}>
                    {m.rating.label}
                  </span>
                  <span className="text-2xs font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
                    {m.rating.pct}%
                  </span>
                </div>
                <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${m.rating.barClass} transition-all duration-300`}
                    style={{ width: `${m.rating.pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simple, Unified Data Usage Section (Single Card - No Overlaps, No Duplicate Boxes) */}
      <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/50 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Data Usage</span>
          </div>

          {isLive && (
            <span className="text-2xs font-mono font-bold text-emerald-600 dark:text-[#CEFF52] uppercase tracking-wider">
              Live
            </span>
          )}
        </div>

        {/* Content: Initial vs Full Page (if delta exists) or Single Viewport */}
        {hasDelta ? (
          <div className="grid grid-cols-2 gap-3">
            {/* Initial Load */}
            <div className="p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Initial Load
                </span>
                <span className="text-2xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
                  {totalRequests} {totalRequests === 1 ? 'Request' : 'Requests'}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">
                  {formatBytes(initialWire)}
                </span>
                <span className="text-2xs text-zinc-500 dark:text-zinc-400 font-sans">
                  transferred
                </span>
              </div>
              {initialDecoded && initialDecoded > 0 && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {formatBytes(initialDecoded)} extracted
                </div>
              )}
            </div>

            {/* Full Page */}
            <div className="p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Full Page
                </span>
                <span className="text-2xs font-mono font-bold text-zinc-900 dark:text-[#CEFF52]">
                  {effectiveScrolledReqs} {effectiveScrolledReqs === 1 ? 'Request' : 'Requests'}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums tracking-tight">
                  {formatBytes(effectiveWire)}
                </span>
                <span className="text-2xs text-zinc-500 dark:text-zinc-400 font-sans">
                  transferred
                </span>
              </div>
              {effectiveDecoded && effectiveDecoded > 0 && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {formatBytes(effectiveDecoded)} extracted
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Transfer
                </span>
                <span className="text-2xs font-mono font-bold text-zinc-900 dark:text-[#CEFF52]">
                  ({effectiveScrolledReqs} {effectiveScrolledReqs === 1 ? 'Request' : 'Requests'})
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums tracking-tight">
                  {formatBytes(effectiveWire)}
                </span>
                <span className="text-2xs text-zinc-500 dark:text-zinc-400 font-sans">
                  transferred
                </span>
              </div>
            </div>

            {effectiveDecoded && effectiveDecoded > 0 && (
              <div className="text-right space-y-1">
                <span className="text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Extracted in Memory
                </span>
                <div className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                  {formatBytes(effectiveDecoded)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Network Efficiency Chips (Cache & Cross-origin) */}
        {(displayCacheCount > 0 || displayOpaqueCount > 0 || scrolledData?.isInfiniteScroll) && (
          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center gap-2 flex-wrap">
            {displayCacheCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md"
                title="Assets served directly from browser cache without network transfer."
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {`${formatBytes(displayCacheBytes)} cached (${displayCacheCount} reqs)`}
              </span>
            )}
            {displayOpaqueCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md"
                title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers."
              >
                <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                {`${displayOpaqueCount} cross-origin`}
              </span>
            )}
            {scrolledData?.isInfiniteScroll && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs font-mono text-sky-700 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md"
                title="Infinite scrolling detected; bounded to loaded content."
              >
                Infinite Feed (Bounded)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
