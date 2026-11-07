/**
 * @file entrypoints/content.ts
 * @description In-tab content script collector coordinator.
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { PAGE_COLLECTORS } from '../src/collectors/page';
import { redactSecrets } from '../src/security/secret-redactor';

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
  },
});
