import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotsParser } from '../src/crawler/robots';
import { BoundedSpider } from '../src/crawler/spider';
import {
  ResponsiveCollector,
  MAX_TAP_TARGET_ELEMENTS,
} from '../src/collectors/page/responsive.collector';
import { messageBus } from '../src/messaging/bus';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { setBrowserAdapter } from '../src/browser/adapters';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import { consentManager } from '../src/intelligence';
import { BadgeService } from '../src/services/badge.service';
import backgroundDef from '../entrypoints/background';

describe('LOW-07: RobotsParser typed getters & BoundedSpider integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes getAllowed(), getDisallowed(), and getUserAgent() returning defensive copies', () => {
    const parser = new RobotsParser('SiteRadarBot');
    parser.parse(`
      User-agent: SiteRadarBot
      Allow: /public/
      Allow: /docs/
      Disallow: /admin/
      Disallow: /private/
      Sitemap: https://example.com/sitemap.xml
    `);

    expect(parser.getUserAgent()).toBe('siteradarbot');
    expect(parser.getAllowed()).toEqual(['/public/', '/docs/']);
    expect(parser.getDisallowed()).toEqual(['/admin/', '/private/']);
    expect(parser.getSitemaps()).toEqual(['https://example.com/sitemap.xml']);

    // Mutating returned arrays must not mutate internal parser state
    const allowed = parser.getAllowed();
    const disallowed = parser.getDisallowed();
    allowed.push('/mutated/');
    disallowed.push('/mutated-disallow/');

    expect(parser.getAllowed()).toEqual(['/public/', '/docs/']);
    expect(parser.getDisallowed()).toEqual(['/admin/', '/private/']);
  });

  it('populates CrawlResult.robots via RobotsParser getters in BoundedSpider.crawl', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/robots.txt')) {
        return new Response(
          [
            'User-agent: *',
            'Allow: /blog/',
            'Disallow: /admin/',
            'Sitemap: https://example.com/sitemap.xml',
          ].join('\n'),
          { status: 200 },
        );
      }
      return new Response('<html><head><title>Home</title></head><body>Ok</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });

    const spider = new BoundedSpider({ maxPages: 1, maxDepth: 0 });
    const result = await spider.crawl('https://example.com/');

    expect(result.status).toBe('completed');
    expect(result.robots).toEqual({
      userAgent: '*',
      allowed: ['/blog/'],
      disallowed: ['/admin/'],
      sitemaps: ['https://example.com/sitemap.xml'],
    });
  });
});

describe('LOW-08: ResponsiveCollector tap target evaluation cap', () => {
  it('caps queried interactive elements to <= 200 before calling getBoundingClientRect()', () => {
    expect(MAX_TAP_TARGET_ELEMENTS).toBe(200);

    const doc = document.implementation.createHTMLDocument('Large DOM');
    const container = doc.body;
    const totalElements = 350;
    let rectCalls = 0;

    for (let i = 0; i < totalElements; i++) {
      const btn = doc.createElement('button');
      btn.textContent = `Button ${i}`;
      Object.defineProperty(btn, 'getBoundingClientRect', {
        configurable: true,
        value: () => {
          rectCalls++;
          // First 10 undersized, rest adequately sized
          return i < 10
            ? { width: 20, height: 20, top: 0, left: 0, bottom: 20, right: 20 }
            : { width: 48, height: 48, top: 0, left: 0, bottom: 48, right: 48 };
        },
      });
      container.appendChild(btn);
    }

    const collector = new ResponsiveCollector();
    const result = collector.collect({
      document: doc,
      window: globalThis.window,
      url: 'https://example.com/',
    });

    expect(rectCalls).toBe(200);
    expect(rectCalls).toBeLessThanOrEqual(200);
    expect(result.data?.tapTargetsEvaluation).toEqual({
      total: 200,
      undersized: 10,
    });
    expect(result.limitations.some((l) => l.includes('200 of 350'))).toBe(true);
  });

  it('evaluates all elements when count is below the 200 cap', () => {
    const doc = document.implementation.createHTMLDocument('Small DOM');
    let rectCalls = 0;

    for (let i = 0; i < 5; i++) {
      const link = doc.createElement('a');
      link.href = '#';
      Object.defineProperty(link, 'getBoundingClientRect', {
        configurable: true,
        value: () => {
          rectCalls++;
          return i < 2
            ? { width: 16, height: 16, top: 0, left: 0, bottom: 16, right: 16 }
            : { width: 50, height: 50, top: 0, left: 0, bottom: 50, right: 50 };
        },
      });
      doc.body.appendChild(link);
    }

    const collector = new ResponsiveCollector();
    const result = collector.collect({
      document: doc,
      window: globalThis.window,
      url: 'https://example.com/',
    });

    expect(rectCalls).toBe(5);
    expect(result.data?.tapTargetsEvaluation).toEqual({
      total: 5,
      undersized: 2,
    });
  });
});

describe('LOW-09: Background context menu deduplication & tab listener scoping', () => {
  const originalChrome = (globalThis as any).chrome;
  let adapter: MockBrowserAdapter;
  let capturedRuntimeListener: ((msg: any, sender: any, sendResponse: any) => boolean) | undefined;
  let capturedOnInstalledListener: ((details: { reason: string }) => void) | undefined;
  let capturedTabUpdatedListener:
    | ((tabId: number, changeInfo: { status?: string; url?: string; title?: string; favIconUrl?: string }) => void)
    | undefined;
  let capturedTabRemovedListener: ((tabId: number) => void) | undefined;
  let callOrder: string[];

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    setBrowserAdapter(adapter);
    callOrder = [];

    (messageBus as any).runtimeListenerAttached = false;
    (messageBus as any).localListeners.clear();

    (globalThis as any).chrome = {
      runtime: {
        id: 'abcdefghijklmnopabcdefghijklmnop',
        lastError: undefined,
        getURL: vi.fn((p: string) => `chrome-extension://abcdefghijklmnopabcdefghijklmnop/${p}`),
        onMessage: {
          addListener: vi.fn((fn) => {
            capturedRuntimeListener = fn;
          }),
        },
        onInstalled: {
          addListener: vi.fn((fn) => {
            capturedOnInstalledListener = fn;
          }),
        },
      },
      contextMenus: {
        removeAll: vi.fn((cb?: () => void) => {
          callOrder.push('removeAll');
          cb?.();
        }),
        create: vi.fn((_props: any, cb?: () => void) => {
          callOrder.push('create');
          cb?.();
        }),
      },
      tabs: {
        create: vi.fn(),
        onUpdated: {
          addListener: vi.fn((fn) => {
            capturedTabUpdatedListener = fn;
          }),
        },
        onRemoved: {
          addListener: vi.fn((fn) => {
            capturedTabRemovedListener = fn;
          }),
        },
      },
      action: {
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
        setTitle: vi.fn().mockResolvedValue(undefined),
        setBadgeTextColor: vi.fn().mockResolvedValue(undefined),
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

  it('calls contextMenus.removeAll() before contextMenus.create() on install and update', () => {
    expect(capturedOnInstalledListener).toBeDefined();

    capturedOnInstalledListener!({ reason: 'update' });
    expect(callOrder).toEqual(['removeAll', 'create']);
    expect((globalThis as any).chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-side-panel' }),
      expect.any(Function),
    );
  });

  it('skips irrelevant changeInfo and untracked tabs in tabs.onUpdated, while clearing tracked audited tabs', async () => {
    expect(capturedTabUpdatedListener).toBeDefined();
    expect(capturedTabRemovedListener).toBeDefined();

    const clearSpy = vi.spyOn(BadgeService, 'clear').mockResolvedValue();

    // Untracked tab loading should be ignored
    capturedTabUpdatedListener!(999, { status: 'loading' });
    expect(clearSpy).not.toHaveBeenCalled();

    // Untracked tab removal should be ignored
    capturedTabRemovedListener!(999);
    expect(clearSpy).not.toHaveBeenCalled();

    // Trigger START_INSPECTION on tabId 42 so it becomes tracked
    vi.spyOn(consentManager, 'ensureLoaded').mockResolvedValue();
    vi.spyOn(inspectionOrchestrator, 'startInspection').mockResolvedValue({} as any);
    vi.spyOn(inspectionOrchestrator, 'getSession').mockReturnValue({
      scanId: 'scan-42',
      mode: 'full',
      targetUrl: 'https://example.com',
      tabId: 42,
      state: 'completed',
      startedAt: Date.now(),
    });

    const internalSender = {
      id: 'abcdefghijklmnopabcdefghijklmnop',
      url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html',
    };

    await new Promise<any>((resolve) => {
      capturedRuntimeListener!(
        {
          id: 'start-42',
          type: MESSAGE_CHANNELS.START_INSPECTION,
          payload: { mode: 'full', tabId: 42 },
          timestamp: Date.now(),
        },
        internalSender,
        resolve,
      );
    });

    clearSpy.mockClear();

    // Irrelevant changeInfo updates on tracked tab 42 must be skipped
    capturedTabUpdatedListener!(42, { title: 'Updated Title' });
    capturedTabUpdatedListener!(42, { favIconUrl: 'https://example.com/favicon.ico' });
    capturedTabUpdatedListener!(42, { status: 'complete' });
    expect(clearSpy).not.toHaveBeenCalled();

    // Navigation (url change) on tracked tab 42 clears badge once and untracks tab
    capturedTabUpdatedListener!(42, { url: 'https://example.com/next' });
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith(42);

    // Subsequent updates on now-untracked tab 42 should be ignored
    clearSpy.mockClear();
    capturedTabUpdatedListener!(42, { status: 'loading' });
    expect(clearSpy).not.toHaveBeenCalled();

    // Re-track tab 43 via START_INSPECTION and verify tabs.onRemoved clears it
    await new Promise<any>((resolve) => {
      capturedRuntimeListener!(
        {
          id: 'start-43',
          type: MESSAGE_CHANNELS.START_INSPECTION,
          payload: { mode: 'full', tabId: 43 },
          timestamp: Date.now(),
        },
        internalSender,
        resolve,
      );
    });
    clearSpy.mockClear();
    capturedTabRemovedListener!(43);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith(43);
  });
});
