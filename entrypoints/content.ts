/**
 * @file entrypoints/content.ts
 * @description In-tab content script collector coordinator.
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { PAGE_COLLECTORS } from '../src/collectors/page';
import { redactSecrets } from '../src/security/secret-redactor';

/**
 * Smoothly animates window scrolling to target coordinates over durationMs.
 * Uses requestAnimationFrame with cubic easeInOutQuad easing for natural momentum,
 * with a safety timer fallback in case background tab throttling pauses rAF.
 */
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

    // Safety timeout in case background tab throttling suspends requestAnimationFrame
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

      // Smooth easeInOutQuad easing for natural deceleration and acceleration
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
    // 1. Handshake Ping Handler
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

    // 2. Collector Execution Handler
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

          // Strict secret redaction applied before data crosses boundary
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

    // 3. Scroll to Bottom and Measure Dynamic Page Payloads
    messageBus.onMessage(
      MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE,
      async () => {
        try {
          const origX = window.scrollX;
          const origY = window.scrollY;

          // Compute page dimensions
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
          // For infinite feeds, safely bound scroll sweep to 8 screens to prevent unbounded runaway loops
          const maxScrollScreens = 8;
          const targetBottom = Math.min(
            totalHeight,
            origY + viewportHeight * maxScrollScreens
          );
          const scrollDistance = Math.max(0, targetBottom - origY);

          // Scroll slowly at ~1000px/s (1px/ms) so user can see progress and IntersectionObserver/lazy-loaders trigger reliably
          const scrollDownDuration = Math.min(
            3500,
            Math.max(1500, Math.round((scrollDistance / 1000) * 1000))
          );

          // Smoothly glide down across the page
          await smoothScrollTo(targetBottom, origX, scrollDownDuration);

          // Wait at the bottom for lazy-loaded network requests to dispatch and populate timeline
          await new Promise((r) => setTimeout(r, 650));

          // Check if document height grew significantly while scrolling (infinite scroll detection)
          const finalHeight = Math.max(
            body ? body.scrollHeight : 0,
            docEl ? docEl.scrollHeight : 0
          );
          const isInfiniteScroll = finalHeight > totalHeight * 1.25;

          // Smoothly glide back to user's original scroll position
          const scrollUpDuration = Math.min(
            1200,
            Math.max(600, Math.round((scrollDistance / 2000) * 1000))
          );
          await smoothScrollTo(origY, origX, scrollUpDuration);

          // Collect updated performance entries
          let scrolledTransferSize = 0;
          let scrolledDecodedSize = 0;
          const resources = performance.getEntriesByType('resource');

          resources.forEach((entry) => {
            const res = entry as PerformanceResourceTiming;
            if (res.transferSize) {
              scrolledTransferSize += res.transferSize;
            } else if (res.encodedBodySize) {
              scrolledTransferSize += res.encodedBodySize;
            }
            if (res.decodedBodySize) {
              scrolledDecodedSize += res.decodedBodySize;
            }
          });

          // Also account for navigation entry
          const navEntries = performance.getEntriesByType('navigation');
          if (navEntries.length > 0) {
            const nav = navEntries[0] as PerformanceNavigationTiming;
            if (nav.transferSize) {
              scrolledTransferSize += nav.transferSize;
            } else if (nav.encodedBodySize) {
              scrolledTransferSize += nav.encodedBodySize;
            }
          }

          return {
            success: true,
            scrolledResourceCount: resources.length,
            scrolledTransferSizeApprox: scrolledTransferSize,
            scrolledDecodedSizeApprox: scrolledDecodedSize,
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
