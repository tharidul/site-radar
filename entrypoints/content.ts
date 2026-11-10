
import { defineContentScript } from 'wxt/utils/define-content-script';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { PAGE_COLLECTORS } from '../src/collectors/page';
import { aggregateResourceMetrics } from '../src/collectors/page/resource-aggregator';
import { redactSecrets } from '../src/security/secret-redactor';

function smoothScrollTo(
  targetY: number,
  targetX: number,
  durationMs: number,
): Promise<void> {
  const startY = window.scrollY;
  const startX = window.scrollX;
  const deltaY = targetY - startY;
  const deltaX = targetX - startX;

  if ((Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) || durationMs <= 0) {
    window.scrollTo({ left: targetX, top: targetY, behavior: 'instant' as ScrollBehavior });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startTime = performance.now();
    let completed = false;

    const safetyTimer = setTimeout(() => {
      if (!completed) {
        completed = true;
        window.scrollTo({ left: targetX, top: targetY, behavior: 'instant' as ScrollBehavior });
        resolve();
      }
    }, durationMs + 800);

    function step(currentTime: number) {
      if (completed) return;
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      window.scrollTo({
        left: startX + deltaX * ease,
        top: startY + deltaY * ease,
        behavior: 'instant' as ScrollBehavior,
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        completed = true;
        clearTimeout(safetyTimer);
        window.scrollTo({ left: targetX, top: targetY, behavior: 'instant' as ScrollBehavior });
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

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
          const origX = window.scrollX;
          const origY = window.scrollY;

          const docEl = document.documentElement;
          const body = document.body;
          const totalHeight = Math.max(
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            docEl ? docEl.clientHeight : 0,
            docEl ? docEl.scrollHeight : 0,
            docEl ? docEl.offsetHeight : 0,
            window.innerHeight
          );

          const viewportHeight = window.innerHeight || 800;
          const maxScrollScreens = 8;
          const targetBottom = Math.min(
            totalHeight,
            origY + viewportHeight * maxScrollScreens
          );
          const scrollDistance = Math.max(0, targetBottom - origY);

          const scrollDownDuration = scrollDistance <= 50
            ? 0
            : Math.min(2200, Math.max(500, Math.round((scrollDistance / 1500) * 1000)));

          if (scrollDownDuration > 0) {
            await smoothScrollTo(targetBottom, origX, scrollDownDuration);
            await new Promise((r) => setTimeout(r, 400));
          }

          const finalHeight = Math.max(
            body ? body.scrollHeight : 0,
            docEl ? docEl.scrollHeight : 0
          );
          const isInfiniteScroll = finalHeight > totalHeight * 1.25;

          const scrollUpDuration = scrollDistance <= 50
            ? 0
            : Math.min(900, Math.max(300, Math.round((scrollDistance / 2500) * 1000)));

          if (scrollUpDuration > 0) {
            await smoothScrollTo(origY, origX, scrollUpDuration);
          }

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
            isInfiniteScroll,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Failed to scroll and measure page payloads',
          };
        }
      },
    );
  },
});
