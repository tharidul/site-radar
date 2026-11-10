import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PerformanceCollector } from '../src/collectors/page/performance.collector';
import { aggregateResourceMetrics } from '../src/collectors/page/resource-aggregator';
import { PageVitalsCard } from '../entrypoints/popup/components/PageVitalsCard';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import type { PerformanceData, WebsiteInspection } from '../src/types/inspection';
import type { IMessageBus } from '../src/messaging/bus';
import { createCollectionResult } from '../src/collectors/page/types';
import type { BrowserAdapter, TabInfo } from '../src/browser/adapters/types';

describe('Milestone 2 Empirical Dataflow & Backward Compatibility Challenge', () => {
  const PAGE_URL = 'https://siteradar.dev/dashboard';
  const PAGE_ORIGIN = 'https://siteradar.dev';

  describe('1. Initial Collection Outputs Contract & Byte Parity', () => {
    it('collector returns PerformanceData where transferSizeApprox strictly matches wireTransferBytes', () => {
      const mockNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 30,
        connectStart: 30,
        connectEnd: 80,
        requestStart: 80,
        responseStart: 120,
        domContentLoadedEventEnd: 450,
        loadEventEnd: 850,
        transferSize: 12500,
        encodedBodySize: 12000,
        decodedBodySize: 45000,
      } as PerformanceNavigationTiming;

      const mockResources = [
        {
          name: 'https://siteradar.dev/assets/app.js',
          initiatorType: 'script',
          transferSize: 35000,
          encodedBodySize: 34000,
          decodedBodySize: 110000,
        },
        {
          name: 'https://siteradar.dev/assets/style.css',
          initiatorType: 'css',
          transferSize: 8500,
          encodedBodySize: 8000,
          decodedBodySize: 32000,
        },
        // Cache hit: transferSize = 0, encodedBodySize > 0
        {
          name: 'https://siteradar.dev/assets/logo.png',
          initiatorType: 'img',
          transferSize: 0,
          encodedBodySize: 22000,
          decodedBodySize: 22000,
        },
        // Opaque cross-origin: transferSize = 0, body sizes = 0
        {
          name: 'https://cdn.thirdparty.com/lib.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ] as PerformanceResourceTiming[];

      const mockPerf = {
        getEntriesByType: (type: string) => {
          if (type === 'navigation') return [mockNav];
          if (type === 'resource') return mockResources;
          if (type === 'paint') {
            return [
              { name: 'first-paint', startTime: 250 },
              { name: 'first-contentful-paint', startTime: 310 },
            ];
          }
          return [];
        },
      };

      const collector = new PerformanceCollector();
      const result = collector.collect({
        url: PAGE_URL,
        document: { defaultView: { performance: mockPerf } } as any,
        window: { performance: mockPerf, location: { href: PAGE_URL, origin: PAGE_ORIGIN } } as any,
      });

      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
      const data = result.data!;

      // Verify strict contract shape
      expect(typeof data.resourceCount).toBe('number');
      expect(typeof data.wireTransferBytes).toBe('number');
      expect(typeof data.decodedBytes).toBe('number');
      expect(typeof data.transferSizeApprox).toBe('number');
      expect(typeof data.decodedSizeApprox).toBe('number');
      expect(typeof data.cacheHitCount).toBe('number');
      expect(typeof data.cacheHitBytes).toBe('number');
      expect(typeof data.opaqueResourceCount).toBe('number');
      expect(Array.isArray(data.opaqueResourceOrigins)).toBe(true);
      expect(typeof data.categoryBreakdown).toBe('object');

      // Byte parity check: transferSizeApprox strictly matches wireTransferBytes
      expect(data.transferSizeApprox).toBe(data.wireTransferBytes);
      expect(data.decodedSizeApprox).toBe(data.decodedBytes);

      // Value check:
      // wireTransferBytes = nav(12500) + app.js(35000) + style.css(8500) = 56000
      expect(data.wireTransferBytes).toBe(56000);
      expect(data.transferSizeApprox).toBe(56000);

      // decodedBytes = nav(45000) + app.js(110000) + style.css(32000) + logo.png(22000) = 209000
      expect(data.decodedBytes).toBe(209000);
      expect(data.decodedSizeApprox).toBe(209000);

      // Cache hit check: logo.png only
      expect(data.cacheHitCount).toBe(1);
      expect(data.cacheHitBytes).toBe(22000);

      // Opaque check: cdn.thirdparty.com
      expect(data.opaqueResourceCount).toBe(1);
      expect(data.opaqueResourceOrigins).toEqual(['https://cdn.thirdparty.com']);

      // Total requests = 4 resources + 1 navigation = 5
      expect(data.resourceCount).toBe(5);
    });

    it('handles 100% cached scenario: wireTransferBytes is 0, transferSizeApprox is 0, cacheHitBytes reflects bodies', () => {
      const mockNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        transferSize: 0,
        encodedBodySize: 5000,
        decodedBodySize: 15000,
      } as PerformanceNavigationTiming;

      const mockResources = [
        {
          name: 'https://siteradar.dev/cached-bundle.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 80000,
          decodedBodySize: 240000,
        },
      ] as PerformanceResourceTiming[];

      const mockPerf = {
        getEntriesByType: (type: string) => {
          if (type === 'navigation') return [mockNav];
          if (type === 'resource') return mockResources;
          return [];
        },
      };

      const collector = new PerformanceCollector();
      const result = collector.collect({
        url: PAGE_URL,
        document: { defaultView: { performance: mockPerf } } as any,
        window: { performance: mockPerf, location: { href: PAGE_URL, origin: PAGE_ORIGIN } } as any,
      });

      const data = result.data!;
      expect(data.wireTransferBytes).toBe(0);
      expect(data.transferSizeApprox).toBe(0);
      expect(data.cacheHitCount).toBe(2); // nav + cached-bundle
      expect(data.cacheHitBytes).toBe(85000);
      expect(data.decodedBytes).toBe(255000);
      expect(data.decodedSizeApprox).toBe(255000);
    });
  });

  describe('2. Content Script MEASURE_SCROLLED_PAGE Protocol & Aggregator Sync', () => {
    it('aggregates scrolled resources and produces complete payload conforming to MessageProtocol', () => {
      const scrolledResources = [
        {
          name: 'https://siteradar.dev/initial.js',
          initiatorType: 'script',
          transferSize: 10000,
          encodedBodySize: 9500,
          decodedBodySize: 30000,
        },
        // Lazy loaded on scroll:
        {
          name: 'https://siteradar.dev/lazy-image-1.webp',
          initiatorType: 'image',
          transferSize: 45000,
          encodedBodySize: 44000,
          decodedBodySize: 45000,
        },
        {
          name: 'https://siteradar.dev/lazy-image-2.webp',
          initiatorType: 'image',
          transferSize: 60000,
          encodedBodySize: 59000,
          decodedBodySize: 60000,
        },
        // Scrolled cached asset:
        {
          name: 'https://siteradar.dev/cached-avatar.jpg',
          initiatorType: 'image',
          transferSize: 0,
          encodedBodySize: 12000,
          decodedBodySize: 12000,
        },
        // Scrolled cross-origin opaque tracker:
        {
          name: 'https://analytics.external.com/collect',
          initiatorType: 'fetch',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ] as PerformanceResourceTiming[];

      const navEntry = {
        name: PAGE_URL,
        entryType: 'navigation',
        transferSize: 5000,
        encodedBodySize: 4800,
        decodedBodySize: 18000,
      } as PerformanceNavigationTiming;

      const aggregated = aggregateResourceMetrics(scrolledResources, navEntry, PAGE_URL);

      // Emulate content.ts MEASURE_SCROLLED_PAGE response construction
      const isInfiniteScroll = false;
      const scrollResponse = {
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

      // Verify all required fields in contract
      expect(scrollResponse.success).toBe(true);
      expect(scrollResponse.scrolledResourceCount).toBe(6); // 5 resources + 1 nav
      expect(scrollResponse.scrolledWireTransferBytes).toBe(120000); // 5000 + 10000 + 45000 + 60000
      expect(scrollResponse.scrolledTransferSizeApprox).toBe(120000);
      expect(scrollResponse.scrolledTransferSizeApprox).toBe(scrollResponse.scrolledWireTransferBytes);

      expect(scrollResponse.scrolledDecodedBytes).toBe(165000); // 18000 + 30000 + 45000 + 60000 + 12000
      expect(scrollResponse.scrolledDecodedSizeApprox).toBe(165000);
      expect(scrollResponse.scrolledDecodedSizeApprox).toBe(scrollResponse.scrolledDecodedBytes);

      expect(scrollResponse.scrolledCacheHitCount).toBe(1);
      expect(scrollResponse.scrolledCacheHitBytes).toBe(12000);
      expect(scrollResponse.scrolledOpaqueResourceCount).toBe(1);
      expect(scrollResponse.isInfiniteScroll).toBe(false);
    });
  });

  describe('3. Orchestrator Scrolled Fields Propagation', () => {
    it('orchestrator copies all scrolled fields onto perfData in inspection session', async () => {
      const adapter = new MockBrowserAdapter();
      // Cast browserType to 'chrome' to simulate real browser scroll measurement trigger
      (adapter as any).browserType = 'chrome';
      (adapter as any).name = 'chrome';

      const mockTab: TabInfo = {
        id: 77,
        url: PAGE_URL,
        origin: PAGE_ORIGIN,
        status: 'complete',
        active: true,
        incognito: false,
      };
      adapter.setMockTab(mockTab);

      // Prepare initial performance module data
      const initialPerfData: PerformanceData = {
        resourceCount: 10,
        wireTransferBytes: 150000,
        decodedBytes: 450000,
        transferSizeApprox: 150000,
        decodedSizeApprox: 450000,
        cacheHitCount: 2,
        cacheHitBytes: 50000,
        opaqueResourceCount: 1,
        opaqueResourceOrigins: ['https://tracker.com'],
        categoryBreakdown: {},
        resourceTypes: {},
      };

      // Prepare fake scroll measurement response
      const fakeScrollRes = {
        success: true,
        scrolledResourceCount: 42,
        scrolledTransferSizeApprox: 789000,
        scrolledDecodedSizeApprox: 2450000,
        scrolledWireTransferBytes: 789000,
        scrolledDecodedBytes: 2450000,
        scrolledCacheHitCount: 7,
        scrolledCacheHitBytes: 154000,
        scrolledOpaqueResourceCount: 3,
        isInfiniteScroll: true,
      };

      // Mock message bus handling ping, collector execution, and scroll measurement
      const mockBus: IMessageBus = {
        sendToBackground: vi.fn(),
        sendToTab: vi.fn().mockImplementation(async (tabId: number, channel: string, payload: any) => {
          if (channel === MESSAGE_CHANNELS.PING_CONTENT_SCRIPT) {
            return { pong: true };
          }
          if (channel === MESSAGE_CHANNELS.EXECUTE_COLLECTOR) {
            if (payload?.module === 'performance') {
              return {
                result: createCollectionResult<PerformanceData>({
                  module: 'performance',
                  status: 'completed',
                  data: initialPerfData,
                  coverage: { expected: 4, collected: 4, unavailable: 0, supported: true },
                }),
              };
            }
            return {
              result: createCollectionResult({
                module: payload?.module || 'unknown',
                status: 'completed',
                data: {},
                coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
              }),
            };
          }
          if (channel === MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE) {
            return fakeScrollRes;
          }
          return { success: true };
        }),
        onMessage: vi.fn(() => () => {}),
      };

      const orchestrator = new InspectionOrchestrator({
        browserAdapter: adapter as BrowserAdapter,
        bus: mockBus,
      });

      const inspection = await orchestrator.startInspection('quick', 77, {
        skipIntelligence: true,
        refreshPage: false,
      });

      expect(mockBus.sendToTab).toHaveBeenCalledWith(
        77,
        MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE,
        undefined
      );

      const perfModule = inspection.modules['performance'];
      expect(perfModule).toBeDefined();
      const perfData = perfModule?.data as PerformanceData;

      // Verify orchestrator faithfully copied every single scrolled metric
      expect(perfData.scrolledResourceCount).toBe(fakeScrollRes.scrolledResourceCount);
      expect(perfData.scrolledTransferSizeApprox).toBe(fakeScrollRes.scrolledTransferSizeApprox);
      expect(perfData.scrolledDecodedSizeApprox).toBe(fakeScrollRes.scrolledDecodedSizeApprox);
      expect(perfData.scrolledWireTransferBytes).toBe(fakeScrollRes.scrolledWireTransferBytes);
      expect(perfData.scrolledDecodedBytes).toBe(fakeScrollRes.scrolledDecodedBytes);
      expect(perfData.scrolledCacheHitCount).toBe(fakeScrollRes.scrolledCacheHitCount);
      expect(perfData.scrolledCacheHitBytes).toBe(fakeScrollRes.scrolledCacheHitBytes);
      expect(perfData.scrolledOpaqueResourceCount).toBe(fakeScrollRes.scrolledOpaqueResourceCount);
      expect(perfData.isInfiniteScrollDetected).toBe(true);
    });

    it('orchestrator safely handles scroll failure or rejection without breaking inspection', async () => {
      const adapter = new MockBrowserAdapter();
      (adapter as any).browserType = 'chrome';
      (adapter as any).name = 'chrome';

      const mockTab: TabInfo = {
        id: 88,
        url: PAGE_URL,
        origin: PAGE_ORIGIN,
        status: 'complete',
        active: true,
        incognito: false,
      };
      adapter.setMockTab(mockTab);

      const mockBus: IMessageBus = {
        sendToBackground: vi.fn(),
        sendToTab: vi.fn().mockImplementation(async (tabId: number, channel: string) => {
          if (channel === MESSAGE_CHANNELS.PING_CONTENT_SCRIPT) {
            return { pong: true };
          }
          if (channel === MESSAGE_CHANNELS.EXECUTE_COLLECTOR) {
            return {
              result: createCollectionResult({
                module: 'performance',
                status: 'completed',
                data: { resourceCount: 5, wireTransferBytes: 1000 },
                coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
              }),
            };
          }
          if (channel === MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE) {
            throw new Error('Tab disconnected');
          }
          return { success: true };
        }),
        onMessage: vi.fn(() => () => {}),
      };

      const orchestrator = new InspectionOrchestrator({
        browserAdapter: adapter as BrowserAdapter,
        bus: mockBus,
      });

      // Must complete without unhandled exception
      const inspection = await orchestrator.startInspection('quick', 88, {
        skipIntelligence: true,
        refreshPage: false,
      });

      expect(inspection).toBeDefined();
      const perfData = inspection.modules['performance']?.data as PerformanceData;
      expect(perfData.scrolledResourceCount).toBeUndefined();
    });
  });

  describe('4. PageVitalsCard Backward Compatibility & Rendering Safety', () => {
    function makeInspection(perfData?: Partial<PerformanceData>): WebsiteInspection {
      return {
        id: 'test-vitals-card-id',
        mode: 'quick',
        startedAt: Date.now(),
        completedAt: Date.now() + 200,
        target: {
          url: PAGE_URL,
          origin: PAGE_ORIGIN,
          hostname: 'siteradar.dev',
          inspectedAt: Date.now(),
        },
        browser: { name: 'chrome' },
        summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
        findings: [],
        modules: {
          performance: {
            module: 'performance',
            status: 'completed',
            collectedAt: Date.now(),
            errors: [],
            limitations: [],
            sources: [],
            coverage: { expected: 4, collected: 4, unavailable: 0, supported: true },
            data: perfData as PerformanceData,
          },
        },
      };
    }

    const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '');

    it('renders cleanly with full Milestone 2 PerformanceData schema', () => {
      const inspection = makeInspection({
        navigationTiming: {
          dnsLookupMs: 15,
          tcpConnectMs: 40,
          ttfbMs: 65,
          domLoadMs: 450,
          fullLoadMs: 950,
        },
        paintTiming: { fcpMs: 380, fpMs: 350 },
        webVitals: { lcpMs: 720, clsScore: 0.02, inpMs: 48 },
        resourceCount: 30,
        transferSizeApprox: 245000,
        decodedSizeApprox: 980000,
        wireTransferBytes: 245000,
        decodedBytes: 980000,
        cacheHitCount: 4,
        cacheHitBytes: 120000,
        opaqueResourceCount: 2,
        opaqueResourceOrigins: ['https://cdn.example.org', 'https://fonts.googleapis.com'],
        resourceTypes: { script: 12, css: 5, image: 13 },
        scrolledResourceCount: 45,
        scrolledTransferSizeApprox: 520000,
        scrolledDecodedSizeApprox: 1850000,
        scrolledWireTransferBytes: 520000,
        scrolledDecodedBytes: 1850000,
        scrolledCacheHitCount: 6,
        scrolledCacheHitBytes: 180000,
        scrolledOpaqueResourceCount: 3,
        isInfiniteScrollDetected: false,
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('65ms'); // TTFB
      expect(html).toContain('380ms'); // FCP
      expect(html).toContain('720ms'); // LCP
      expect(html).toContain('950ms'); // Full load
      expect(html).toContain('239.3 KB'); // 245000 / 1024
      expect(html).toContain('(Initial • 30 reqs)');
      expect(html).toContain('Full Page:');
      expect(html).toContain('507.8 KB'); // 520000 / 1024
      expect(html).toContain('(Scrolled • 45 reqs)');
      expect(html).toContain('+268.6 KB lazy'); // (520000 - 245000) / 1024
    });

    it('renders cleanly in 100% cache-hit scenario (transferBytes = 0)', () => {
      const inspection = makeInspection({
        navigationTiming: {
          dnsLookupMs: 0,
          tcpConnectMs: 0,
          ttfbMs: 12,
          domLoadMs: 120,
          fullLoadMs: 250,
        },
        resourceCount: 18,
        transferSizeApprox: 0,
        decodedSizeApprox: 850000,
        wireTransferBytes: 0,
        decodedBytes: 850000,
        cacheHitCount: 18,
        cacheHitBytes: 350000,
        opaqueResourceCount: 0,
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      // Should display decoded approximation (~830.1 KB) because transferBytes is 0
      expect(html).toContain('~830.1 KB');
      expect(html).toContain('(Initial • 18 reqs)');
    });

    it('renders cleanly in 100% opaque cross-origin scenario (transferBytes = 0, decodedBytes = 0)', () => {
      const inspection = makeInspection({
        resourceCount: 5,
        transferSizeApprox: 0,
        decodedSizeApprox: 0,
        wireTransferBytes: 0,
        decodedBytes: 0,
        cacheHitCount: 0,
        cacheHitBytes: 0,
        opaqueResourceCount: 5,
        opaqueResourceOrigins: ['https://tracker.com'],
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      // Should fall back to request count
      expect(html).toContain('5 reqs');
      expect(html).toContain('(Initial • 5 reqs)');
    });

    it('renders infinite scroll feed badge when isInfiniteScrollDetected is true', () => {
      const inspection = makeInspection({
        resourceCount: 20,
        transferSizeApprox: 100000,
        decodedSizeApprox: 300000,
        scrolledResourceCount: 65,
        scrolledTransferSizeApprox: 800000,
        scrolledDecodedSizeApprox: 2000000,
        isInfiniteScrollDetected: true,
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Infinite Feed (Bounded)');
      expect(html).toContain('Full Page:');
      expect(html).toContain('(Scrolled • 65 reqs)');
    });

    it('renders safely when performance data is completely empty', () => {
      const inspection = makeInspection({});

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('—'); // TTFB / FCP / LCP missing
      expect(html).toContain('0 reqs');
    });

    it('renders safely with legacy performance data without M2 fields', () => {
      const inspection = makeInspection({
        resourceCount: 10,
        transferSizeApprox: 50000,
        // No wireTransferBytes, cacheHitCount, etc.
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('48.8 KB');
      expect(html).toContain('(Initial • 10 reqs)');
    });

    it('handles multi-gigabyte payload numbers without formatting error or NaN', () => {
      const largeBytes = 4 * 1024 * 1024 * 1024; // 4 GB
      const inspection = makeInspection({
        resourceCount: 1500,
        transferSizeApprox: largeBytes,
        decodedSizeApprox: largeBytes * 3,
        wireTransferBytes: largeBytes,
        decodedBytes: largeBytes * 3,
      });

      const html = cleanHtml(renderToString(<PageVitalsCard inspection={inspection} />));

      expect(html).toContain('4 GB');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
    });
  });
});
