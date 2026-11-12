import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionMessageBus, isInternalExtensionSender, messageBus } from '../src/messaging/bus';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { setBrowserAdapter } from '../src/browser/adapters';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import { consentManager } from '../src/intelligence';
import backgroundDef from '../entrypoints/background';

describe('HIGH-01: isInternalExtensionSender & ExtensionMessageBus', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    (globalThis as any).chrome = {
      runtime: {
        id: 'abcdefghijklmnopabcdefghijklmnop',
        onMessage: { addListener: vi.fn() },
      },
    };
  });

  afterEach(() => {
    (globalThis as any).chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it('validates internal extension senders and rejects content scripts / external origins', () => {
    const extId = 'abcdefghijklmnopabcdefghijklmnop';

    expect(
      isInternalExtensionSender({
        id: extId,
        url: `chrome-extension://${extId}/popup.html`,
      } as chrome.runtime.MessageSender),
    ).toBe(true);

    expect(
      isInternalExtensionSender({
        id: extId,
        url: `chrome-extension://${extId}/options.html#intelligence`,
      } as chrome.runtime.MessageSender),
    ).toBe(true);

    // Content script has sender.tab defined
    expect(
      isInternalExtensionSender({
        id: extId,
        url: 'https://example.com/page',
        tab: { id: 1 } as chrome.tabs.Tab,
      } as chrome.runtime.MessageSender),
    ).toBe(false);

    // Content script in iframe even with extension url still has sender.tab defined
    expect(
      isInternalExtensionSender({
        id: extId,
        url: `chrome-extension://${extId}/injected.html`,
        tab: { id: 1 } as chrome.tabs.Tab,
      } as chrome.runtime.MessageSender),
    ).toBe(false);

    // Different extension ID
    expect(
      isInternalExtensionSender({
        id: 'otherextensionidotherextensionid',
        url: `chrome-extension://${extId}/popup.html`,
      } as chrome.runtime.MessageSender),
    ).toBe(false);

    // Prefix spoofing attempt
    expect(
      isInternalExtensionSender({
        id: extId,
        url: `chrome-extension://${extId}.evil.com/popup.html`,
      } as chrome.runtime.MessageSender),
    ).toBe(false);

    // Missing URL
    expect(
      isInternalExtensionSender({
        id: extId,
      } as chrome.runtime.MessageSender),
    ).toBe(false);
  });

  it('blocks content script senders on requireInternalSender channels via chrome.runtime.onMessage', async () => {
    let capturedListener: ((msg: any, sender: any, sendResponse: any) => boolean) | undefined;
    (globalThis as any).chrome.runtime.onMessage.addListener = vi.fn((fn) => {
      capturedListener = fn;
    });

    const bus = new ExtensionMessageBus(new MockBrowserAdapter());
    const handler = vi.fn(async () => ({ success: true }));
    bus.onMessage(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, handler, {
      requireInternalSender: true,
    });

    expect(capturedListener).toBeDefined();

    // Content script sender should be rejected
    const contentResponse = await new Promise<any>((resolve) => {
      const keepOpen = capturedListener!(
        { id: '1', type: MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, payload: undefined, timestamp: Date.now() },
        {
          id: 'abcdefghijklmnopabcdefghijklmnop',
          url: 'https://untrusted.example/app',
          tab: { id: 42 },
        },
        resolve,
      );
      expect(keepOpen).toBe(true);
    });

    expect(contentResponse).toEqual({
      success: false,
      error: 'Unauthorized: internal extension context required',
    });
    expect(handler).not.toHaveBeenCalled();

    // Internal extension page sender should succeed
    const internalResponse = await new Promise<any>((resolve) => {
      capturedListener!(
        { id: '2', type: MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, payload: undefined, timestamp: Date.now() },
        {
          id: 'abcdefghijklmnopabcdefghijklmnop',
          url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html',
        },
        resolve,
      );
    });

    expect(internalResponse).toEqual({
      success: true,
      data: { success: true },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('Background handlers: HIGH-01, HIGH-05, HIGH-06', () => {
  const originalChrome = (globalThis as any).chrome;
  let adapter: MockBrowserAdapter;
  let capturedRuntimeListener: ((msg: any, sender: any, sendResponse: any) => boolean) | undefined;

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    setBrowserAdapter(adapter);

    // Reset runtime listener state on singleton bus for isolated testing
    (messageBus as any).runtimeListenerAttached = false;
    (messageBus as any).localListeners.clear();

    (globalThis as any).chrome = {
      runtime: {
        id: 'abcdefghijklmnopabcdefghijklmnop',
        onMessage: {
          addListener: vi.fn((fn) => {
            capturedRuntimeListener = fn;
          }),
        },
      },
    };

    const mainFn = (backgroundDef as any).main;
    if (typeof mainFn === 'function') {
      mainFn();
    }
  });

  afterEach(() => {
    setBrowserAdapter(null);
    (globalThis as any).chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it('rejects content scripts invoking privileged background channels', async () => {
    const contentSender = {
      id: 'abcdefghijklmnopabcdefghijklmnop',
      url: 'https://compromised.example/',
      tab: { id: 7 },
    };

    for (const channel of [
      MESSAGE_CHANNELS.START_INSPECTION,
      MESSAGE_CHANNELS.CANCEL_INSPECTION,
      MESSAGE_CHANNELS.GET_INSPECTION_STATE,
      MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE,
      MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
      MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT,
    ]) {
      const res = await new Promise<any>((resolve) => {
        capturedRuntimeListener!(
          { id: 'msg', type: channel, payload: {}, timestamp: Date.now() },
          contentSender,
          resolve,
        );
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    }
  });

  it('loads and normalizes stored crawlLimits (including timeoutSeconds) on START_INSPECTION', async () => {
    await adapter.setStorage({
      crawlLimits: {
        maxPages: 12,
        maxDepth: 2,
        concurrency: 1,
        timeoutSeconds: 25,
      },
    });

    const startSpy = vi
      .spyOn(inspectionOrchestrator, 'startInspection')
      .mockResolvedValue({} as any);
    const ensureLoadedSpy = vi
      .spyOn(consentManager, 'ensureLoaded')
      .mockResolvedValue();

    const internalSender = {
      id: 'abcdefghijklmnopabcdefghijklmnop',
      url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html',
    };

    const res = await new Promise<any>((resolve) => {
      capturedRuntimeListener!(
        {
          id: 'start-1',
          type: MESSAGE_CHANNELS.START_INSPECTION,
          payload: { mode: 'deep', tabId: 3, refreshPage: false },
          timestamp: Date.now(),
        },
        internalSender,
        resolve,
      );
    });

    expect(res.success).toBe(true);
    expect(ensureLoadedSpy).toHaveBeenCalled();
    expect(startSpy).toHaveBeenCalledWith(
      'deep',
      3,
      expect.objectContaining({
        crawlLimits: {
          maxPages: 12,
          maxDepth: 2,
          concurrency: 1,
          perPageTimeoutMs: 25000,
        },
      }),
    );
  });

  it('hydrates and persists external consent via consentManager on CHECK/SET_EXTERNAL_CONSENT', async () => {
    const ensureLoadedSpy = vi
      .spyOn(consentManager, 'ensureLoaded')
      .mockResolvedValue();
    const setConsentSpy = vi
      .spyOn(consentManager, 'setConsent')
      .mockResolvedValue();
    const hasConsentSpy = vi
      .spyOn(consentManager, 'hasConsent')
      .mockReturnValue(true);

    const internalSender = {
      id: 'abcdefghijklmnopabcdefghijklmnop',
      url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html',
    };

    const setRes = await new Promise<any>((resolve) => {
      capturedRuntimeListener!(
        {
          id: 'set-1',
          type: MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT,
          payload: { provider: 'doh', granted: true },
          timestamp: Date.now(),
        },
        internalSender,
        resolve,
      );
    });

    expect(setRes).toEqual({ success: true, data: { success: true } });
    expect(setConsentSpy).toHaveBeenCalledWith('doh', true);

    const checkRes = await new Promise<any>((resolve) => {
      capturedRuntimeListener!(
        {
          id: 'check-1',
          type: MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
          payload: { provider: 'doh' },
          timestamp: Date.now(),
        },
        internalSender,
        resolve,
      );
    });

    expect(ensureLoadedSpy).toHaveBeenCalled();
    expect(hasConsentSpy).toHaveBeenCalledWith('doh');
    expect(checkRes).toEqual({ success: true, data: { granted: true } });
  });
});
