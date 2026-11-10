
import type { PerformanceData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';
import { aggregateResourceMetrics, type AggregatedMetrics } from './resource-aggregator';

export class PerformanceCollector implements PageCollector<PerformanceData> {
  readonly id = 'performance';
  readonly name = 'Page Performance & Resource Timing Collector';

  collect(context: CollectorContext) {
    const win = context.window || (context.document.defaultView as Window | null);
    const perf = win?.performance;

    let navigationTiming: PerformanceData['navigationTiming'] = undefined;
    let paintTiming: PerformanceData['paintTiming'] = undefined;
    let webVitals: PerformanceData['webVitals'] = undefined;
    let aggregated: AggregatedMetrics = {
      totalRequests: 0,
      wireTransferBytes: 0,
      decodedBytes: 0,
      cacheHitCount: 0,
      cacheHitBytes: 0,
      opaqueResourceCount: 0,
      opaqueResourceOrigins: [],
      resourceTypes: {},
      categoryBreakdown: {},
    };

    if (perf && typeof perf.getEntriesByType === 'function') {
      try {
        let navEntry: PerformanceNavigationTiming | undefined;
        const navEntries = perf.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          navEntry = nav;
          const dnsLookup = Math.max(0, Math.round(nav.domainLookupEnd - nav.domainLookupStart));
          const tcpConnect = Math.max(0, Math.round(nav.connectEnd - nav.connectStart));
          const ttfb = Math.max(0, Math.round(nav.responseStart - nav.requestStart));
          const domLoad = Math.max(0, Math.round(nav.domContentLoadedEventEnd - nav.startTime));
          const fullLoad = Math.max(0, Math.round(nav.loadEventEnd - nav.startTime));

          navigationTiming = {
            dnsLookupMs: dnsLookup,
            tcpConnectMs: tcpConnect,
            ttfbMs: ttfb,
            domLoadMs: domLoad,
            fullLoadMs: fullLoad,
          };
        } else if (perf.timing) {
          const t = perf.timing;
          const start = t.navigationStart || t.fetchStart;
          navigationTiming = {
            dnsLookupMs: Math.max(0, t.domainLookupEnd - t.domainLookupStart),
            tcpConnectMs: Math.max(0, t.connectEnd - t.connectStart),
            ttfbMs: Math.max(0, t.responseStart - t.requestStart),
            domLoadMs: Math.max(0, t.domContentLoadedEventEnd - start),
            fullLoadMs: Math.max(0, t.loadEventEnd - start),
          };
        }

        const paintEntries = perf.getEntriesByType('paint');
        if (paintEntries.length > 0) {
          paintTiming = {};
          paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
              paintTiming!.fpMs = Math.round(entry.startTime);
            } else if (entry.name === 'first-contentful-paint') {
              paintTiming!.fcpMs = Math.round(entry.startTime);
            }
          });
        }

        const resources = (perf.getEntriesByType('resource') || []) as PerformanceResourceTiming[];
        aggregated = aggregateResourceMetrics(
          resources,
          navEntry,
          context.url || win?.location?.href,
        );

        try {
          let lcpEntries: any[] = [];
          try {
            lcpEntries = perf.getEntriesByType('largest-contentful-paint');
          } catch {}

          let clsEntries: any[] = [];
          try {
            clsEntries = perf.getEntriesByType('layout-shift');
          } catch {}

          let fidEntries: any[] = [];
          try {
            fidEntries = perf.getEntriesByType('first-input');
          } catch {}

          const PO = (win as any)?.PerformanceObserver;
          if (PO && Array.isArray(PO.supportedEntryTypes)) {
            if (lcpEntries.length === 0 && PO.supportedEntryTypes.includes('largest-contentful-paint')) {
              try {
                const po = new PO((list: any) => {
                  const entries = list.getEntries();
                  if (entries.length > 0) lcpEntries = entries;
                });
                po.observe({ type: 'largest-contentful-paint', buffered: true });
                if (typeof po.takeRecords === 'function') {
                  const records = po.takeRecords();
                  if (records.length > 0) lcpEntries = records;
                }
                po.disconnect();
              } catch {}
            }
            if (clsEntries.length === 0 && PO.supportedEntryTypes.includes('layout-shift')) {
              try {
                const po = new PO((list: any) => {
                  const entries = list.getEntries();
                  if (entries.length > 0) clsEntries = entries;
                });
                po.observe({ type: 'layout-shift', buffered: true });
                if (typeof po.takeRecords === 'function') {
                  const records = po.takeRecords();
                  if (records.length > 0) clsEntries = records;
                }
                po.disconnect();
              } catch {}
            }
          }

          let lcpMs: number | undefined;
          if (lcpEntries && lcpEntries.length > 0) {
            const lastLcp = lcpEntries[lcpEntries.length - 1];
            if (lastLcp && typeof lastLcp.startTime === 'number') {
              lcpMs = Math.round(lastLcp.startTime);
            }
          }

          let clsScore: number | undefined;
          if (clsEntries && clsEntries.length > 0) {
            let totalCls = 0;
            clsEntries.forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                totalCls += entry.value || 0;
              }
            });
            clsScore = parseFloat(totalCls.toFixed(3));
          }

          let inpMs: number | undefined;
          if (fidEntries && fidEntries.length > 0) {
            const firstFid = fidEntries[0] as any;
            if (firstFid.processingStart && firstFid.startTime) {
              inpMs = Math.round(firstFid.processingStart - firstFid.startTime);
            }
          }

          if (lcpMs !== undefined || clsScore !== undefined || inpMs !== undefined) {
            webVitals = {
              ...(webVitals || {}),
              ...(lcpMs !== undefined ? { lcpMs } : {}),
              ...(clsScore !== undefined ? { clsScore } : {}),
              ...(inpMs !== undefined ? { inpMs } : {}),
            };
          }
        } catch {
        }
      } catch {
      }
    }

    const data: PerformanceData = {
      navigationTiming,
      paintTiming,
      webVitals,
      resourceCount: aggregated.totalRequests,
      transferSizeApprox: aggregated.wireTransferBytes,
      decodedSizeApprox: aggregated.decodedBytes,
      wireTransferBytes: aggregated.wireTransferBytes,
      decodedBytes: aggregated.decodedBytes,
      cacheHitCount: aggregated.cacheHitCount,
      cacheHitBytes: aggregated.cacheHitBytes,
      opaqueResourceCount: aggregated.opaqueResourceCount,
      opaqueResourceOrigins: aggregated.opaqueResourceOrigins,
      resourceTypes: aggregated.resourceTypes,
      categoryBreakdown: aggregated.categoryBreakdown,
    };

    const hasNav = navigationTiming !== undefined;
    const hasPaint = paintTiming !== undefined;
    const hasResources = aggregated.totalRequests > 0;

    let collectedCount = 0;
    if (hasNav) collectedCount++;
    if (hasPaint) collectedCount++;
    if (hasResources) collectedCount++;
    if (webVitals !== undefined) collectedCount++;

    return createCollectionResult<PerformanceData>({
      module: this.id,
      status: hasNav || hasResources ? 'completed' : 'partial',
      data,
      coverage: {
        expected: 4,
        collected: collectedCount,
        unavailable: Math.max(0, 4 - collectedCount),
        supported: perf !== undefined,
      },
      limitations: [
        'Cross-origin resource timings require Timing-Allow-Origin header to expose non-zero transfer sizes.',
        'Core Web Vitals (LCP, CLS, INP) require live page interaction and may be incomplete during early scan initiation.',
      ],
      sources: ['PerformanceNavigationTiming', 'PerformancePaintTiming', 'PerformanceResourceTiming'],
    });
  }
}

export const performanceCollector = new PerformanceCollector();
