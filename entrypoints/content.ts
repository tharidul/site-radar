
import { defineContentScript } from 'wxt/utils/define-content-script';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { PAGE_COLLECTORS } from '../src/collectors/page';
import { aggregateResourceMetrics } from '../src/collectors/page/resource-aggregator';
import { measureAndScrollPage } from '../src/collectors/page/scroll-detector';
import { redactSecrets } from '../src/security/secret-redactor';

export default defineContentScript({
  registration: 'runtime',
  main() {
    messageBus.onMessage(
      MESSAGE_CHANNELS.PING_CONTENT_SCRIPT,
      async () => {
        return {
          pong: true,
          url: window.location.href,
          readyState: document.readyState,
        };
      },
    );

    messageBus.onMessage(
      MESSAGE_CHANNELS.EXECUTE_COLLECTOR,
      async (payload) => {
        const moduleId = payload?.module;
        const collector = moduleId ? PAGE_COLLECTORS[moduleId] : undefined;

        if (!collector) {
          return {
            result: {
              module: moduleId || 'unknown',
              status: 'unsupported',
              collectedAt: Date.now(),
              data: null,
              coverage: { expected: 0, collected: 0, unavailable: 0, supported: false },
              limitations: [`Module ${moduleId} is not registered in content script`],
              errors: [`Unknown collector module: ${moduleId}`],
              sources: ['ContentScript'],
            },
          };
        }

        try {
          const rawResult = await collector.collect({
            document,
            window,
            url: window.location.href,
            options: payload?.options as Record<string, unknown> | undefined,
          });

          const sanitizedData = rawResult.data !== null && rawResult.data !== undefined
            ? redactSecrets(rawResult.data)
            : null;

          return {
            result: {
              ...rawResult,
              data: sanitizedData,
            },
          };
        } catch (err: any) {
          return {
            result: {
              module: moduleId,
              status: 'failed',
              collectedAt: Date.now(),
              data: null,
              coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
              limitations: [],
              errors: [err?.message || 'Collector threw an unexpected error'],
              sources: ['ContentScript'],
            },
          };
        }
      },
    );

    messageBus.onMessage(
      MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE,
      async () => {
        try {
          const scrollResult = await measureAndScrollPage(document, window);

          const resources = (performance.getEntriesByType('resource') || []) as PerformanceResourceTiming[];
          const navEntries = performance.getEntriesByType('navigation');
          const navEntry = navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming) : undefined;
          const aggregated = aggregateResourceMetrics(resources, navEntry, window.location.href);

          return {
            success: true,
            scrolledResourceCount: aggregated.totalRequests,
            scrolledTransferSizeApprox: aggregated.wireTransferBytes,
            scrolledDecodedSizeApprox: aggregated.decodedBytes,
            scrolledWireTransferBytes: aggregated.wireTransferBytes,
            scrolledDecodedBytes: aggregated.decodedBytes,
            scrolledCacheHitCount: aggregated.cacheHitCount,
            scrolledCacheHitBytes: aggregated.cacheHitBytes,
            scrolledOpaqueResourceCount: aggregated.opaqueResourceCount,
            isInfiniteScroll: scrollResult.isInfiniteScroll,
            layoutScrollType: scrollResult.layoutScrollType,
            isFixedHeight: scrollResult.isFixedHeight,
            scrollConfidence: scrollResult.scrollConfidence,
            scrollSignals: scrollResult.scrollSignals,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Failed to scroll and measure page payloads',
          };
        }
      },
    );

    messageBus.onMessage(
      MESSAGE_CHANNELS.GET_LIVE_METRICS,
      async () => {
        try {
          const resources = (performance.getEntriesByType('resource') || []) as PerformanceResourceTiming[];
          const navEntries = performance.getEntriesByType('navigation');
          const navEntry = navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming) : undefined;
          const aggregated = aggregateResourceMetrics(resources, navEntry, window.location.href);

          return {
            success: true,
            resourceCount: aggregated.totalRequests,
            wireTransferBytes: aggregated.wireTransferBytes,
            decodedBytes: aggregated.decodedBytes,
            cacheHitCount: aggregated.cacheHitCount,
            cacheHitBytes: aggregated.cacheHitBytes,
            opaqueResourceCount: aggregated.opaqueResourceCount,
          };
        } catch (err: any) {
          return {
            success: false,
            resourceCount: 0,
            wireTransferBytes: 0,
            decodedBytes: 0,
            cacheHitCount: 0,
            cacheHitBytes: 0,
            opaqueResourceCount: 0,
            error: err?.message || 'Failed to get live metrics',
          };
        }
      },
    );
  },
});
