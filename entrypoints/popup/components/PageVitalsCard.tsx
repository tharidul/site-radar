import React, { useMemo } from 'react';
import { Layers, Globe } from 'lucide-react';
import type { WebsiteInspection, PerformanceData } from '@/types/inspection';

interface PageVitalsCardProps {
  inspection: WebsiteInspection;
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

export const PageVitalsCard: React.FC<PageVitalsCardProps> = ({ inspection }) => {
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

  return (
    <div className="rounded-md bg-white dark:bg-zinc-900 p-4 min-[400px]:p-5 shadow-xs">
      <div className="pb-3 border-b border-zinc-200/70 dark:border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Page Loading Times &amp; Data Usage
        </h3>
      </div>

      <div className="grid grid-cols-4 divide-x divide-zinc-200/70 dark:divide-zinc-800 py-3.5">
        <div className="pr-2.5 pl-0">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            TTFB
          </div>
          <div className="text-lg min-[400px]:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {ttfb || '—'}
          </div>
          <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full ${ttfbRating.barClass}`}
              style={{ width: `${ttfbRating.pct}%` }}
            />
          </div>
          <div className="text-xs font-semibold mt-1 truncate">
            <span className={ttfbRating.colorClass}>{ttfbRating.label}</span>
          </div>
        </div>

        <div className="px-2.5">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            FCP
          </div>
          <div className="text-lg min-[400px]:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {fcp || '—'}
          </div>
          <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full ${fcpRating.barClass}`}
              style={{ width: `${fcpRating.pct}%` }}
            />
          </div>
          <div className="text-xs font-semibold mt-1 truncate">
            <span className={fcpRating.colorClass}>{fcpRating.label}</span>
          </div>
        </div>

        <div className="px-2.5">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            LCP
          </div>
          <div className="text-lg min-[400px]:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {lcp || '—'}
          </div>
          <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full ${lcpRating.barClass}`}
              style={{ width: `${lcpRating.pct}%` }}
            />
          </div>
          <div className="text-xs font-semibold mt-1 truncate">
            <span className={lcpRating.colorClass}>{lcpRating.label}</span>
          </div>
        </div>

        <div className="pl-2.5 pr-0">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Load Event
          </div>
          <div className="text-lg min-[400px]:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight mt-1">
            {fullLoad || domLoad || 'Complete'}
          </div>
          <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full ${loadRating.barClass}`}
              style={{ width: `${loadRating.pct}%` }}
            />
          </div>
          <div className="text-xs font-semibold mt-1 truncate">
            <span className={loadRating.colorClass}>{loadRating.label}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200/70 dark:border-zinc-800 pt-3 space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">
                Data Usage:
              </span>
              <span
                className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 font-mono"
                title="Assets fetched up to the initial viewport. Below-the-fold assets load dynamically on scroll."
              >
                {`(Initial • ${totalRequests} reqs)`}
              </span>
            </div>

            <div className="text-right font-mono shrink-0">
              {wireBytes && wireBytes > 0 ? (
                <>
                  <span
                    className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm"
                    title="Transfer reflects compressed bytes received over network. Uncompressed reflects in-memory size."
                  >
                    {`Transfer: ${formatBytes(wireBytes)}`}
                  </span>
                  {decodedBytes && decodedBytes > 0 && (
                    <span
                      className="text-xs text-zinc-500 dark:text-zinc-400 ml-2.5 tabular-nums"
                      title="Uncompressed reflects in-memory size."
                    >
                      {`Uncompressed: ${formatBytes(decodedBytes)}`}
                    </span>
                  )}
                </>
              ) : decodedBytes && decodedBytes > 0 ? (
                <span
                  className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm"
                  title="Transfer reflects compressed bytes received over network. Uncompressed reflects in-memory size."
                >
                  {`~${formatBytes(decodedBytes)}`}
                </span>
              ) : (
                <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm">
                  {`${totalRequests} reqs`}
                </span>
              )}
            </div>
          </div>

          {((cacheHitCount ?? 0) > 0 || (opaqueResourceCount ?? 0) > 0) && (
            <div className="flex items-center gap-3 min-w-0 flex-wrap pt-0.5">
              {(cacheHitCount ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0"
                  title="Assets served from local browser cache without network transfer."
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {`${cacheHitCount} cached (${formatBytes(cacheHitBytes ?? 0)})`}
                </span>
              )}
              {(opaqueResourceCount ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-700 dark:text-amber-400 shrink-0"
                  title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only."
                >
                  <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  {`${opaqueResourceCount} cross-origin (no TAO)`}
                </span>
              )}
            </div>
          )}
        </div>

        {scrolledData && (
          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">
                  Full Page:
                </span>
                <span
                  className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 font-mono"
                  title="Total assets transferred after scrolling the webpage to trigger all lazy-loaded content."
                >
                  {`(Scrolled • ${scrolledData.resourceCount || totalRequests} reqs)`}
                </span>
              </div>

              <div className="text-right font-mono shrink-0">
                {scrolledData.wireBytes && scrolledData.wireBytes > 0 ? (
                  <>
                    <span
                      className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm"
                      title="Transfer reflects compressed bytes received over network. Uncompressed reflects in-memory size."
                    >
                      {`Transfer: ${formatBytes(scrolledData.wireBytes)}`}
                    </span>
                    {scrolledData.decodedBytes && scrolledData.decodedBytes > 0 && (
                      <span
                        className="text-xs text-zinc-500 dark:text-zinc-400 ml-2.5 tabular-nums"
                        title="Uncompressed reflects in-memory size."
                      >
                        {`Uncompressed: ${formatBytes(scrolledData.decodedBytes)}`}
                      </span>
                    )}
                  </>
                ) : scrolledData.decodedBytes && scrolledData.decodedBytes > 0 ? (
                  <span
                    className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm"
                    title="Transfer reflects compressed bytes received over network. Uncompressed reflects in-memory size."
                  >
                    {`~${formatBytes(scrolledData.decodedBytes)}`}
                  </span>
                ) : (
                  <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums text-sm">
                    {`${scrolledData.resourceCount || 0} reqs`}
                  </span>
                )}
              </div>
            </div>

            {(lazyWire > 0 ||
              scrolledData.isInfiniteScroll ||
              (scrolledData.cacheHitCount ?? 0) > 0 ||
              (scrolledData.opaqueResourceCount ?? 0) > 0) && (
              <div className="flex items-center gap-3 min-w-0 flex-wrap pt-0.5">
                {lazyWire > 0 && (
                  <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                    {`+${formatBytes(lazyWire)} lazy`}
                  </span>
                )}
                {scrolledData.isInfiniteScroll && (
                  <span
                    className="text-xs font-mono text-sky-700 dark:text-sky-400 shrink-0"
                    title="This site appends infinite content on scroll. Measurement was safely bounded to initial loaded viewports."
                  >
                    Infinite Feed (Bounded)
                  </span>
                )}
                {(scrolledData.cacheHitCount ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0"
                    title="Assets served from local browser cache without network transfer."
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {`${scrolledData.cacheHitCount} cached (${formatBytes(scrolledData.cacheHitBytes ?? 0)})`}
                  </span>
                )}
                {(scrolledData.opaqueResourceCount ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-700 dark:text-amber-400 shrink-0"
                    title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only."
                  >
                    <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    {`${scrolledData.opaqueResourceCount} cross-origin (no TAO)`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
