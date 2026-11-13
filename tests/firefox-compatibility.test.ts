import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { ExtensionMessageBus, isInternalExtensionSender } from '../src/messaging/bus';
import { FirefoxMV3Adapter, getBrowserAdapter, setBrowserAdapter } from '../src/browser/adapters';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { consumePendingPermissionScan, savePendingPermissionScan } from '../src/security/ephemeral-permissions';
import { ModeSelector } from '../entrypoints/popup/components/ModeSelector';
import {
  getExtensionApi,
  openExtensionOptions,
  openExtensionTab,
  supportsSidePanelOpen,
} from '../entrypoints/popup/ext-api';
import backgroundDef from '../entrypoints/background';

describe('Firefox MV3 Compatibility', () => {
  const FIREFOX_EXT_ID = 'siteradar@local.audit';
  const FIREFOX_UUID = '7c3b2f10-4a8e-4d91-9b2a-123456789abc';
  const FIREFOX_ORIGIN = `moz-extension://${FIREFOX_UUID}`;

  let originalBrowser: any;
  let originalChrome: any;

  beforeEach(() => {
    originalBrowser = (globalThis as any).browser;
    originalChrome = (globalThis as any).chrome;
    setBrowserAdapter(null);
  });

  afterEach(() => {
    if (originalBrowser === undefined) {
      delete (globalThis as any).browser;
    } else {
      (globalThis as any).browser = originalBrowser;
    }

    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }

    setBrowserAdapter(null);
    vi.restoreAllMocks();
  });

  describe('isInternalExtensionSender & ExtensionMessageBus in Firefox MV3', () => {
    beforeEach(() => {
      delete (globalThis as any).chrome;
      (globalThis as any).browser = {
        runtime: {
          id: FIREFOX_EXT_ID,
          getURL: vi.fn((path = '') => `${FIREFOX_ORIGIN}/${String(path).replace(/^\/+/, '')}`),
          onMessage: { addListener: vi.fn() },
        },
      };
    });

    it('detects Firefox environment via moz-extension:// URL even when chrome is undefined', () => {
      const adapter = getBrowserAdapter();
      expect(adapter.browserType).toBe('firefox');
      expect(adapter).toBeInstanceOf(FirefoxMV3Adapter);
    });

    it('accepts Firefox moz-extension:// popup, sidepanel, and options tab senders', () => {
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/popup.html`,
        } as any),
      ).toBe(true);

      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/sidepanel.html`,
        } as any),
      ).toBe(true);

      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/options.html#welcome`,
          tab: { id: 2, url: `${FIREFOX_ORIGIN}/options.html#welcome` },
          frameId: 0,
        } as any),
      ).toBe(true);
    });

    it('rejects injected, content-script, subframe, and mismatched-origin senders in Firefox', () => {
      // Content script on web page
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: 'https://example.com/page',
          tab: { id: 1 },
          frameId: 0,
        } as any),
      ).toBe(false);

      // Injected/non-entrypoint extension page inside a tab
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/injected.html`,
          tab: { id: 1 },
          frameId: 0,
        } as any),
      ).toBe(false);

      // Extension page loaded in a non-top subframe
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/options.html`,
          tab: { id: 1 },
          frameId: 1,
        } as any),
      ).toBe(false);

      // Different moz-extension UUID origin
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
          url: 'moz-extension://00000000-0000-0000-0000-000000000000/popup.html',
        } as any),
      ).toBe(false);

      // Different extension ID
      expect(
        isInternalExtensionSender({
          id: 'other@extension.test',
          url: `${FIREFOX_ORIGIN}/popup.html`,
        } as any),
      ).toBe(false);

      // Missing URL
      expect(
        isInternalExtensionSender({
          id: FIREFOX_EXT_ID,
        } as any),
      ).toBe(false);
    });

    it('attaches runtime listener on browser.runtime.onMessage and enforces requireInternalSender', async () => {
      let capturedListener: ((msg: any, sender: any, sendResponse: any) => boolean) | undefined;
      (globalThis as any).browser.runtime.onMessage.addListener = vi.fn((fn) => {
        capturedListener = fn;
      });

      const bus = new ExtensionMessageBus(new MockBrowserAdapter());
      const handler = vi.fn(async () => ({ state: 'idle' as const }));
      bus.onMessage(MESSAGE_CHANNELS.GET_INSPECTION_STATE, handler, {
        requireInternalSender: true,
      });

      expect(capturedListener).toBeDefined();

      // Untrusted content script is rejected
      const blockedRes = await new Promise<any>((resolve) => {
        const keepOpen = capturedListener!(
          {
            id: 'ff-1',
            type: MESSAGE_CHANNELS.GET_INSPECTION_STATE,
            payload: { tabId: 1 },
            timestamp: Date.now(),
          },
          {
            id: FIREFOX_EXT_ID,
            url: 'https://untrusted.example/app',
            tab: { id: 1 },
            frameId: 0,
          },
          resolve,
        );
        expect(keepOpen).toBe(true);
      });

      expect(blockedRes).toEqual({
        success: false,
        error: 'Unauthorized: internal extension context required',
      });
      expect(handler).not.toHaveBeenCalled();

      // Firefox popup / sidepanel / options senders succeed
      for (const sender of [
        { id: FIREFOX_EXT_ID, url: `${FIREFOX_ORIGIN}/popup.html` },
        { id: FIREFOX_EXT_ID, url: `${FIREFOX_ORIGIN}/sidepanel.html` },
        {
          id: FIREFOX_EXT_ID,
          url: `${FIREFOX_ORIGIN}/options.html#welcome`,
          tab: { id: 2, url: `${FIREFOX_ORIGIN}/options.html#welcome` },
          frameId: 0,
        },
      ]) {
        const okRes = await new Promise<any>((resolve) => {
          capturedListener!(
            {
              id: 'ff-ok',
              type: MESSAGE_CHANNELS.GET_INSPECTION_STATE,
              payload: { tabId: 1 },
              timestamp: Date.now(),
            },
            sender,
            resolve,
          );
        });

        expect(okRes).toEqual({
          success: true,
          data: { state: 'idle' },
        });
      }

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('FirefoxMV3Adapter resilience', () => {
    it('handles malformed/unparseable tab URLs safely in getActiveTab and queryTabs', async () => {
      delete (globalThis as any).chrome;
      (globalThis as any).browser = {
        runtime: {
          id: FIREFOX_EXT_ID,
          getURL: (p = '') => `${FIREFOX_ORIGIN}/${p}`,
        },
        tabs: {
          query: vi.fn(async () => [
            {
              id: 7,
              url: 'not a valid :// url',
              title: 'Malformed Tab',
              windowId: 1,
              incognito: false,
              active: true,
              status: 'complete',
            },
            {
              id: 8,
              url: 'https://example.com/path',
              title: 'Valid Tab',
              windowId: 1,
              incognito: false,
              active: false,
              status: 'complete',
            },
          ]),
        },
      };

      const adapter = new FirefoxMV3Adapter();

      const activeTab = await adapter.getActiveTab();
      expect(activeTab).not.toBeNull();
      expect(activeTab?.id).toBe(7);
      expect(activeTab?.url).toBe('not a valid :// url');
      expect(activeTab?.origin).toBeUndefined();

      const queried = await adapter.queryTabs({ currentWindow: true });
      expect(queried).toHaveLength(2);
      expect(queried[0]?.id).toBe(7);
      expect(queried[0]?.origin).toBeUndefined();
      expect(queried[1]?.id).toBe(8);
      expect(queried[1]?.origin).toBe('https://example.com');
    });

    it('omits allFrames from executeScript target when undefined and forwards it when defined', async () => {
      delete (globalThis as any).chrome;
      const executeScriptMock = vi.fn(async (_details: any) => [{ result: 'ok' }]);
      (globalThis as any).browser = {
        runtime: {
          id: FIREFOX_EXT_ID,
          getURL: (p = '') => `${FIREFOX_ORIGIN}/${p}`,
        },
        scripting: {
          executeScript: executeScriptMock,
        },
      };

      const adapter = new FirefoxMV3Adapter();

      await adapter.executeScript({
        tabId: 12,
        func: () => 'ok',
      });

      expect(executeScriptMock).toHaveBeenCalledTimes(1);
      const firstCallArg = executeScriptMock.mock.calls[0]?.[0];
      expect(firstCallArg).toBeDefined();
      expect(firstCallArg.target).toEqual({ tabId: 12 });
      expect('allFrames' in firstCallArg.target).toBe(false);

      await adapter.executeScript({
        tabId: 12,
        allFrames: true,
        func: () => 'ok',
      });

      expect(executeScriptMock).toHaveBeenCalledTimes(2);
      const secondCallArg = executeScriptMock.mock.calls[1]?.[0];
      expect(secondCallArg).toBeDefined();
      expect(secondCallArg.target).toEqual({ tabId: 12, allFrames: true });
    });
  });

  describe('Popup ext-api, sidepanel manifest hints, and Firefox background handlers', () => {
    it('getExtensionApi and supportsSidePanelOpen prefer browser and detect Firefox sidebarAction.open', () => {
      delete (globalThis as any).browser;
      delete (globalThis as any).chrome;
      expect(getExtensionApi()).toBeNull();
      expect(supportsSidePanelOpen()).toBe(false);

      const ffApi = {
        runtime: { id: FIREFOX_EXT_ID, getURL: (p = '') => `${FIREFOX_ORIGIN}/${p}` },
        sidebarAction: { open: vi.fn() },
        tabs: { create: vi.fn(async () => ({})) },
      };
      const chromeApi = {
        runtime: { id: 'chrome-id', getURL: (p = '') => `chrome-extension://chrome-id/${p}` },
        sidePanel: { open: vi.fn() },
        tabs: { create: vi.fn() },
      };

      (globalThis as any).chrome = chromeApi;
      expect(getExtensionApi()).toBe(chromeApi);
      expect(supportsSidePanelOpen()).toBe(true);

      (globalThis as any).browser = ffApi;
      expect(getExtensionApi()).toBe(ffApi);
      expect(supportsSidePanelOpen()).toBe(true);

      openExtensionTab('privacy-policy.html');
      expect(ffApi.tabs.create).toHaveBeenCalledWith({
        url: `${FIREFOX_ORIGIN}/privacy-policy.html`,
        active: true,
      });

      openExtensionOptions('#intelligence');
      expect(ffApi.tabs.create).toHaveBeenCalledWith({
        url: `${FIREFOX_ORIGIN}/options.html#intelligence`,
        active: true,
      });

      delete (globalThis as any).chrome;
      delete (ffApi as any).sidebarAction;
      expect(supportsSidePanelOpen()).toBe(false);
    });

    it('entrypoints/sidepanel/index.html disables open_at_install and marks sidepanel-html', () => {
      const sidepanelHtml = fs.readFileSync(
        path.resolve(__dirname, '../entrypoints/sidepanel/index.html'),
        'utf-8',
      );
      expect(sidepanelHtml).toContain('class="sidepanel-html"');
      expect(sidepanelHtml).toContain('<meta name="manifest.open_at_install" content="false"');
    });

    it('background.ts registers keepalive port and sidebarAction.open via global browser without chrome', () => {
      delete (globalThis as any).chrome;
      let onConnectListener: ((port: any) => void) | undefined;
      let onMenuClickListener: ((info: any, tab?: any) => void) | undefined;
      const sidebarOpen = vi.fn(async () => {});

      (globalThis as any).browser = {
        runtime: {
          id: FIREFOX_EXT_ID,
          getURL: (p = '') => `${FIREFOX_ORIGIN}/${p}`,
          onStartup: { addListener: vi.fn() },
          onInstalled: { addListener: vi.fn() },
          onMessage: { addListener: vi.fn() },
          onConnect: {
            addListener: vi.fn((cb) => {
              onConnectListener = cb;
            }),
          },
        },
        tabs: {
          onUpdated: { addListener: vi.fn() },
          onRemoved: { addListener: vi.fn() },
        },
        alarms: {
          create: vi.fn(),
          clear: vi.fn(),
          onAlarm: { addListener: vi.fn() },
        },
        permissions: {
          onAdded: { addListener: vi.fn() },
          getAll: vi.fn(async () => ({ permissions: [], origins: [] })),
        },
        storage: {
          local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
          session: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
        },
        contextMenus: {
          onClicked: {
            addListener: vi.fn((cb) => {
              onMenuClickListener = cb;
            }),
          },
        },
        sidebarAction: {
          open: sidebarOpen,
        },
      };

      const mainFn = (backgroundDef as any).main;
      expect(typeof mainFn).toBe('function');
      mainFn();

      expect(onConnectListener).toBeDefined();
      expect(onMenuClickListener).toBeDefined();

      // Context menu click invokes Firefox sidebarAction.open() synchronously
      onMenuClickListener!({ menuItemId: 'open-side-panel' }, { id: 1, windowId: 10 });
      expect(sidebarOpen).toHaveBeenCalledTimes(1);

      // Keepalive port accepts moz-extension:// sender and replies PONG to PING
      let portMessageHandler: ((msg: unknown) => void) | undefined;
      const internalPort = {
        name: 'siteradar-scan-keepalive',
        sender: { id: FIREFOX_EXT_ID, url: `${FIREFOX_ORIGIN}/popup.html` },
        disconnect: vi.fn(),
        postMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn((cb) => {
            portMessageHandler = cb;
          }),
        },
      };
      onConnectListener!(internalPort);
      expect(internalPort.disconnect).not.toHaveBeenCalled();
      expect(portMessageHandler).toBeDefined();
      portMessageHandler!({ type: 'PING' });
      expect(internalPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PONG' }),
      );

      // Keepalive port rejects untrusted content-script sender
      const untrustedPort = {
        name: 'siteradar-scan-keepalive',
        sender: { id: FIREFOX_EXT_ID, url: 'https://example.com/', tab: { id: 1 }, frameId: 0 },
        disconnect: vi.fn(),
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() },
      };
      onConnectListener!(untrustedPort);
      expect(untrustedPort.disconnect).toHaveBeenCalledTimes(1);
    });

    it('strips port numbers in FirefoxMV3Adapter permission requests and matches them in consumePendingPermissionScan', async () => {
      delete (globalThis as any).chrome;
      const containsMock = vi.fn(async () => true);
      const requestMock = vi.fn(async () => true);
      (globalThis as any).browser = {
        runtime: {
          id: FIREFOX_EXT_ID,
          getURL: (p = '') => `${FIREFOX_ORIGIN}/${p}`,
        },
        permissions: {
          contains: containsMock,
          request: requestMock,
          remove: vi.fn(async () => true),
        },
      };

      const adapter = new FirefoxMV3Adapter();
      expect(await adapter.hasPermissions({ origins: ['http://127.0.0.1:40121/*'] })).toBe(true);
      expect(containsMock).toHaveBeenCalledWith({ origins: ['http://127.0.0.1/*'] });

      expect(await adapter.requestPermissions({ origins: ['http://localhost:3000/*'] })).toBe(true);
      expect(requestMock).toHaveBeenCalledWith({ origins: ['http://localhost/*'] });

      const mockAdapter = new MockBrowserAdapter();
      await savePendingPermissionScan(mockAdapter, {
        origins: ['http://localhost:8080/*'],
        mode: 'full',
        tabId: 5,
        url: 'http://localhost:8080/',
        refreshPage: true,
        createdAt: Date.now(),
      });

      const consumed = await consumePendingPermissionScan(mockAdapter, ['http://localhost/*']);
      expect(consumed).toMatchObject({ mode: 'full', tabId: 5 });
    });

    it('renders visible permission wait feedback on ModeSelector while awaiting host permission prompt', () => {
      (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      try {
        act(() => {
          root.render(
            createElement(ModeSelector, {
              selectedMode: 'full',
              onSelectMode: () => {},
              onStartInspection: () => {},
              disabled: false,
              isRequestingPermission: true,
            }),
          );
        });

        expect(container.textContent).toContain('Waiting for site permission');
        expect(container.textContent).toContain('Allow site access in the browser address-bar prompt');
      } finally {
        act(() => {
          root.unmount();
        });
        container.remove();
      }
    });
  });
});
