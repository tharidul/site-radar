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
  PanelTop,
  Layout,
  ScrollText,
  Infinity as InfinityIcon,
} from 'lucide-react';
import type { WebsiteInspection, PerformanceData, LayoutScrollType } from '@/types/inspection';

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


interface ScrollLayoutBadgeInfo {
  type: Exclude<LayoutScrollType, 'finite'>;
  label: string;
  tooltip: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SCROLL_LAYOUT_DISPLAY: Record<
  Exclude<LayoutScrollType, 'finite'>,
  { label: string; description: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  'fixed-height': {
    label: 'Fixed Height',
    description: 'Viewport-locked page with no vertical scroll; auto-scroll skipped.',
    Icon: PanelTop,
  },
  'app-shell': {
    label: 'App Shell',
    description: 'Scrollable inner container detected; measured via inner scroll container.',
    Icon: Layout,
  },
  'long-page': {
    label: 'Long Page',
    description: 'Tall finite document measured across stepped viewport folds.',
    Icon: ScrollText,
  },
  'infinite-feed': {
    label: 'Infinite Feed (Bounded)',
    description: 'Infinite scrolling detected; bounded to loaded content.',
    Icon: InfinityIcon,
  },
};

function getScrollLayoutBadge(perfData?: PerformanceData): ScrollLayoutBadgeInfo | null {
  if (!perfData) return null;

  const resolvedType: LayoutScrollType | undefined =
    perfData.layoutScrollType ??
    (perfData.isInfiniteScrollDetected
      ? 'infinite-feed'
      : perfData.isFixedHeight
        ? 'fixed-height'
        : undefined);

  if (!resolvedType || resolvedType === 'finite') {
    return null;
  }

  const config = SCROLL_LAYOUT_DISPLAY[resolvedType];
  const tooltipParts: string[] = [config.description];
  if (perfData.scrollConfidence) {
    tooltipParts.push(`Confidence: ${perfData.scrollConfidence}`);
  }
  if (perfData.scrollSignals && perfData.scrollSignals.length > 0) {
    tooltipParts.push(`Signals: ${perfData.scrollSignals.join(', ')}`);
  }

  return {
    type: resolvedType,
    label: config.label,
    tooltip: tooltipParts.join(' · '),
    Icon: config.Icon,
  };
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
    const isInf =
      perfData?.isInfiniteScrollDetected ??
      (perfData?.layoutScrollType === 'infinite-feed' ? true : undefined);
    if (
      sWire !== undefined ||
      sResCount !== undefined ||
      sDecoded !== undefined ||
      isInf !== undefined ||
      perfData?.layoutScrollType !== undefined ||
      perfData?.isFixedHeight !== undefined
    ) {
      return {
        wireBytes: sWire,
        transferBytes: sWire,
        decodedBytes: sDecoded,
        resourceCount: sResCount,
        cacheHitCount: perfData?.scrolledCacheHitCount,
        cacheHitBytes: perfData?.scrolledCacheHitBytes,
        opaqueResourceCount: perfData?.scrolledOpaqueResourceCount,
        isInfiniteScroll: isInf,
      };
    }
    return null;
  }, [perfData]);

  const scrollLayoutBadge = useMemo(() => getScrollLayoutBadge(perfData), [perfData]);

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

  const scrollDeltaWire = Math.max(0, (totalWire || 0) - (initialWire || 0));
  const scrollDeltaReqs = Math.max(0, effectiveScrolledReqs - totalRequests);
  const hasScrollSplit = Boolean(hasDelta && scrollDeltaWire > 0);

  const donutRadius = 41;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const initialWireRatio = totalWire && totalWire > 0 ? Math.min(1, Math.max(0, (initialWire || 0) / totalWire)) : 1;
  const initialDashOffset = donutCircumference * (1 - initialWireRatio);

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
      icon: Timer,
      target: '≤ 800ms',
    },
    {
      key: 'fcp',
      label: 'FCP',
      name: 'First Contentful Paint',
      value: fcp || '—',
      icon: Zap,
      target: '≤ 1.8s',
    },
    {
      key: 'lcp',
      label: 'LCP',
      name: 'Largest Contentful Paint',
      value: lcp || '—',
      icon: ImageIcon,
      target: '≤ 2.5s',
    },
    {
      key: 'load',
      label: 'Load',
      name: 'Window Load Event',
      value: fullLoad || domLoad || 'Complete',
      icon: CheckCircle2,
      target: '≤ 2.5s',
    },
  ];

  return (
    <section
      aria-labelledby="page-vitals-heading"
      className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 min-[400px]:p-4 shadow-xs space-y-3"
    >
      {/* Header with Title */}
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <h3
          id="page-vitals-heading"
          className="text-xs font-bold text-zinc-900 dark:text-zinc-100"
        >
          Page Loading Times &amp; Data Usage
        </h3>
      </div>

      {/* 4 Performance Metrics: Fused strip with dividers, no nested cards or bars */}
      <div className="grid grid-cols-2 min-[440px]:grid-cols-4 rounded-md bg-zinc-50/70 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80">
        {timingMetrics.map((m, idx) => {
          const Icon = m.icon;
          const dividerClass = [
            idx % 2 === 1 ? 'border-l border-zinc-200/60 dark:border-zinc-800/80' : '',
            idx >= 2 ? 'border-t min-[440px]:border-t-0 border-zinc-200/60 dark:border-zinc-800/80' : '',
            idx > 0 ? 'min-[440px]:border-l min-[440px]:border-zinc-200/60 dark:min-[440px]:border-zinc-800/80' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={m.key}
              title={`${m.name} (Target: ${m.target})`}
              className={`px-3 py-2.5 flex flex-col justify-between gap-2 min-w-0 ${dividerClass}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                  {m.label}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-1.5">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight leading-none">
                  {m.value}
                </div>
                <span className="text-2xs text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0 whitespace-nowrap">
                  {m.target}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Usage Section: Clean, unboxed layout divided by spacing */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center gap-1.5 text-2xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          <HardDrive className="w-3 h-3 text-accent" />
          <span>Data Usage</span>
        </div>

        {/* Donut Chart: Transfer distribution & single full page memory footprint */}
        <div className="flex items-center gap-5 sm:gap-6 py-2">
          {/* Donut Chart with Centered Total (Generous, un-squeezed proportions) */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox="0 0 100 100"
              role="img"
              aria-label={`Data usage donut chart: ${formatBytes(totalWire)} total wire transferred`}
            >
              {/* Background circle / On-scroll slice */}
              <circle
                cx="50"
                cy="50"
                r={donutRadius}
                fill="transparent"
                stroke={hasScrollSplit ? '#0284c7' : '#10b981'}
                strokeWidth="6.5"
                className={!totalWire || totalWire === 0 ? 'text-zinc-200 dark:text-zinc-800' : ''}
              />
              {/* Initial load slice */}
              {hasScrollSplit && (
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="6.5"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={initialDashOffset}
                  strokeLinecap="butt"
                  className="transition-[stroke-dashoffset] duration-300 ease-out"
                />
              )}
            </svg>

            {/* Centered Total Callout with generous padding and clearance */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums leading-tight tracking-tight">
                {formatBytes(totalWire)}
              </span>
              <span className="text-2xs text-zinc-400 dark:text-zinc-500 mt-1 leading-none font-medium">
                transferred
              </span>
            </div>
          </div>

          {/* Legend and Single Full Page Memory Footprint */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {hasScrollSplit ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-2 min-w-0 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium truncate">Initial load</span>
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                    {formatBytes(initialWire)}{' '}
                    <span className="text-2xs font-normal text-zinc-400 dark:text-zinc-500">
                      ({totalRequests} reqs)
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-2 min-w-0 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    <span className="font-medium truncate">On scroll</span>
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                    {formatBytes(scrollDeltaWire)}{' '}
                    <span className="text-2xs font-normal text-zinc-400 dark:text-zinc-500">
                      ({scrollDeltaReqs} reqs)
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-2 min-w-0 text-zinc-700 dark:text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-medium truncate">Total transfer</span>
                </span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                  {formatBytes(totalWire)}{' '}
                  <span className="text-2xs font-normal text-zinc-400 dark:text-zinc-500">
                    ({effectiveScrolledReqs} reqs)
                  </span>
                </span>
              </div>
            )}

            {/* Single Full Page Memory Extraction Footprint */}
            {totalDecoded && totalDecoded > 0 && (
              <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-between text-xs gap-2">
                <span className="text-2xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                  Unpacked in RAM {compressionSavingsPct > 0 ? `(${compressionSavingsPct}% compressed)` : ''}
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                  {formatBytes(totalDecoded)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Network Efficiency & Layout Chips */}
        {(displayCacheCount > 0 || displayOpaqueCount > 0 || Boolean(scrollLayoutBadge)) && (
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            {displayCacheCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded tabular-nums"
                title="Assets served directly from browser cache without network transfer."
              >
                <Layers className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                {`${formatBytes(displayCacheBytes)} cached (${displayCacheCount} reqs)`}
              </span>
            )}
            {displayOpaqueCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded tabular-nums"
                title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers."
              >
                <Globe className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                {`${displayOpaqueCount} cross-origin`}
              </span>
            )}
            {scrollLayoutBadge && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded"
                title={scrollLayoutBadge.tooltip}
                data-scroll-layout={scrollLayoutBadge.type}
              >
                <scrollLayoutBadge.Icon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                {scrollLayoutBadge.label}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
