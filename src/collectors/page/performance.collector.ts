/**
 * @file src/collectors/page/performance.collector.ts
 * @description Extracts Navigation Timing, Paint Timing, and Resource distribution metrics.
 */

import type { PerformanceData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class PerformanceCollector implements PageCollector<PerformanceData> {
  readonly id = 'performance';
  readonly name = 'Page Performance & Resource Timing Collector';

  collect(context: CollectorContext) {
    const win = context.window || (context.document.defaultView as Window | null);
    const perf = win?.performance;

    let navigationTiming: PerformanceData['navigationTiming'] = undefined;
    let paintTiming: PerformanceData['paintTiming'] = undefined;
    let webVitals: PerformanceData['webVitals'] = undefined;
    let resourceCount = 0;
    let transferSizeApprox = 0;

    if (perf && typeof perf.getEntriesByType === 'function') {
      try {
        // Navigation timing (PerformanceNavigationTiming Level 2 or legacy timing)
        const navEntries = perf.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
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
          // Legacy PerformanceTiming fallback
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

        // Paint Timing
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

        // Resource Timing
        const resources = perf.getEntriesByType('resource');
        resourceCount = resources.length;
        resources.forEach((entry) => {
          const res = entry as PerformanceResourceTiming;
          if (res.transferSize) {
            transferSizeApprox += res.transferSize;
          }
        });

        // Web Vitals: Attempt buffered retrieval of LCP, CLS, and First Input
        try {
          const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
          const clsEntries = perf.getEntriesByType('layout-shift');
          const fidEntries = perf.getEntriesByType('first-input');

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
          // Buffered entry queries unsupported in some contexts
        }
      } catch {
        // Handle environments where performance entries throw
      }
    }

    const data: PerformanceData = {
      navigationTiming,
      paintTiming,
      webVitals,
      resourceCount,
      transferSizeApprox: transferSizeApprox > 0 ? transferSizeApprox : undefined,
    };

    const hasNav = navigationTiming !== undefined;
    const hasPaint = paintTiming !== undefined;
    const hasResources = resourceCount > 0;

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
