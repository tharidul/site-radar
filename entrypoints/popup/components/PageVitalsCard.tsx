
import React, { useMemo } from 'react';
import { Clock, Layers, Globe } from 'lucide-react';
import type { WebsiteInspection, PerformanceData } from '@/types/inspection';

interface PageVitalsCardProps {
  inspection: WebsiteInspection;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  const primaryTime = fullLoad || lcp || fcp || ttfb || '—';

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

  const totalWire = scrolledData?.wireBytes ?? wireBytes ?? 0;
  const initialWire = wireBytes ?? 0;
  const initialPct = totalWire > 0 ? Math.round(Math.min(100, Math.max(5, (initialWire / totalWire) * 100))) : 100;
  const lazyPct = totalWire > 0 && lazyWire > 0 ? Math.max(0, 100 - initialPct) : 0;

  const activeCacheCount = (scrolledData?.cacheHitCount ?? cacheHitCount) ?? 0;
  const activeCacheBytes = (scrolledData?.cacheHitBytes ?? cacheHitBytes) ?? 0;
  const activeOpaqueCount = (scrolledData?.opaqueResourceCount ?? opaqueResourceCount) ?? 0;

  return (
    <div className="rounded-md bg-white dark:bg-zinc-900 p-5 shadow-xs">
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

      <div className="grid grid-cols-4 divide-x divide-zinc-200/70 dark:divide-zinc-800 py-3.5">
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

      <div className="border-t border-zinc-200/70 dark:border-zinc-800 pt-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Data Usage:
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
              Network transfer &amp; compression
            </span>
          </div>

          <div className="flex items-center gap-2">
            {scrolledData?.isInfiniteScroll && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400"
                title="This site appends infinite content on scroll. Measurement was safely bounded to initial loaded viewports."
              >
                Infinite Feed (Bounded)
              </span>
            )}
            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-[#CEFF52] tabular-nums">
              {totalWire > 0
                ? formatBytes(totalWire)
                : (scrolledData?.decodedBytes ?? decodedBytes) && (scrolledData?.decodedBytes ?? decodedBytes)! > 0
                ? `~${formatBytes(scrolledData?.decodedBytes ?? decodedBytes)}`
                : `${scrolledData?.resourceCount || totalRequests} reqs`}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
            <div
              className="h-full bg-[#CEFF52] transition-all duration-300 rounded-l-full"
              style={{ width: `${initialPct}%` }}
              title={`Initial Viewport: ${wireBytes && wireBytes > 0 ? formatBytes(wireBytes) : `${totalRequests} reqs`} (${initialPct}%)`}
            />
            {lazyWire > 0 && (
              <div
                className="h-full bg-sky-400 dark:bg-sky-500 transition-all duration-300"
                style={{ width: `${lazyPct}%` }}
                title={`Lazy-Loaded: +${formatBytes(lazyWire)} (${lazyPct}%)`}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-2.5 py-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#CEFF52] shrink-0" />
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
              Initial
            </span>
            <span
              className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0"
              title="Assets fetched up to the initial viewport. Below-the-fold assets load dynamically on scroll."
            >
              {`(Initial • ${totalRequests} reqs)`}
            </span>
            {(cacheHitCount ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                title="Assets served from local browser cache without network transfer."
              >
                <Layers className="w-3 h-3 text-emerald-500 shrink-0" />
                {`${cacheHitCount} cached (${formatBytes(cacheHitBytes ?? 0)})`}
              </span>
            )}
            {(opaqueResourceCount ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only."
              >
                <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                {`${opaqueResourceCount} cross-origin (no TAO)`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 pl-2">
            <div className="w-14 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden hidden min-[440px]:block">
              <div
                className="h-full rounded-full bg-[#CEFF52]"
                style={{ width: `${initialPct}%` }}
              />
            </div>
            <div className="text-right font-mono">
              {wireBytes && wireBytes > 0 ? (
                <>
                  <span
                    className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums"
                    title="Wire transfer reflects compressed bytes received over network. Decoded reflects uncompressed size in memory."
                  >
                    {`Wire: ${formatBytes(wireBytes)}`}
                  </span>
                  {decodedBytes && decodedBytes > 0 && (
                    <span
                      className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-2 hidden sm:inline tabular-nums"
                      title="Decoded reflects uncompressed size in memory."
                    >
                      {`Decoded: ${formatBytes(decodedBytes)}`}
                    </span>
                  )}
                </>
              ) : decodedBytes && decodedBytes > 0 ? (
                <span
                  className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums"
                  title="Wire transfer reflects compressed bytes received over network. Decoded reflects uncompressed size in memory."
                >
                  {`~${formatBytes(decodedBytes)}`}
                </span>
              ) : (
                <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums">
                  {`${totalRequests} reqs`}
                </span>
              )}
            </div>
          </div>
        </div>

        {scrolledData && (
          <div className="flex items-center justify-between px-2.5 py-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${lazyWire > 0 ? 'bg-sky-400 dark:bg-sky-500' : 'bg-[#CEFF52]'}`} />
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                Full Page:
              </span>
              <span
                className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0"
                title="Total assets transferred after scrolling the webpage to trigger all lazy-loaded content."
              >
                {`(Scrolled • ${scrolledData.resourceCount || totalRequests} reqs)`}
              </span>
              {lazyWire > 0 && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
                  {`+${formatBytes(lazyWire)} lazy`}
                </span>
              )}
              {(scrolledData.cacheHitCount ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  title="Assets served from local browser cache without network transfer."
                >
                  <Layers className="w-3 h-3 text-emerald-500 shrink-0" />
                  {`${scrolledData.cacheHitCount} cached (${formatBytes(scrolledData.cacheHitBytes ?? 0)})`}
                </span>
              )}
              {(scrolledData.opaqueResourceCount ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  title="Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only."
                >
                  <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                  {`${scrolledData.opaqueResourceCount} cross-origin (no TAO)`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 pl-2">
              <div className="w-14 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden hidden min-[440px]:block">
                <div
                  className="h-full rounded-full bg-sky-400 dark:bg-sky-500"
                  style={{ width: `${Math.min(100, Math.max(15, lazyPct || 100))}%` }}
                />
              </div>
              <div className="text-right font-mono">
                {scrolledData.wireBytes && scrolledData.wireBytes > 0 ? (
                  <>
                    <span
                      className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums"
                      title="Wire transfer reflects compressed bytes received over network. Decoded reflects uncompressed size in memory."
                    >
                      {`Wire: ${formatBytes(scrolledData.wireBytes)}`}
                    </span>
                    {scrolledData.decodedBytes && scrolledData.decodedBytes > 0 && (
                      <span
                        className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-2 hidden sm:inline tabular-nums"
                        title="Decoded reflects uncompressed size in memory."
                      >
                        {`Decoded: ${formatBytes(scrolledData.decodedBytes)}`}
                      </span>
                    )}
                  </>
                ) : scrolledData.decodedBytes && scrolledData.decodedBytes > 0 ? (
                  <span
                    className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums"
                    title="Wire transfer reflects compressed bytes received over network. Decoded reflects uncompressed size in memory."
                  >
                    {`~${formatBytes(scrolledData.decodedBytes)}`}
                  </span>
                ) : (
                  <span className="font-extrabold text-zinc-900 dark:text-[#CEFF52] tabular-nums">
                    {`${scrolledData.resourceCount || 0} reqs`}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
