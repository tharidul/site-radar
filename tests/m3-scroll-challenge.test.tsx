import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { PageVitalsCard } from '../entrypoints/popup/components/PageVitalsCard';
import { aggregateResourceMetrics } from '../src/collectors/page/resource-aggregator';
import type { PerformanceData, WebsiteInspection } from '../src/types/inspection';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

interface RenderResult {
  container: HTMLDivElement;
  unmount: () => void;
  getByText: (matcher: string | RegExp) => HTMLElement;
  queryByText: (matcher: string | RegExp) => HTMLElement | null;
  getByTitle: (matcher: string | RegExp) => HTMLElement;
  queryByTitle: (matcher: string | RegExp) => HTMLElement | null;
  getAllByText: (matcher: string | RegExp) => HTMLElement[];
}

function render(ui: React.ReactElement): RenderResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;

  act(() => {
    root = createRoot(container);
    root.render(ui);
  });

  const matchText = (nodeText: string, matcher: string | RegExp): boolean => {
    if (typeof matcher === 'string') {
      return nodeText.includes(matcher);
    }
    return matcher.test(nodeText);
  };

  const queryByText = (matcher: string | RegExp): HTMLElement | null => {
    const all = container.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent && matchText(el.textContent, matcher)) {
        const childMatch = Array.from(el.children).find(
          (child) => child.textContent && matchText(child.textContent, matcher)
        );
        if (!childMatch) {
          return el as HTMLElement;
        }
      }
    }
    return null;
  };

  const getByText = (matcher: string | RegExp): HTMLElement => {
    const el = queryByText(matcher);
    if (!el) {
      throw new Error(`Unable to find element with text: ${matcher}\nContainer: ${container.innerHTML}`);
    }
    return el;
  };

  const getAllByText = (matcher: string | RegExp): HTMLElement[] => {
    const results: HTMLElement[] = [];
    const all = container.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent && matchText(el.textContent, matcher)) {
        const childMatch = Array.from(el.children).find(
          (child) => child.textContent && matchText(child.textContent, matcher)
        );
        if (!childMatch) {
          results.push(el as HTMLElement);
        }
      }
    }
    return results;
  };

  const queryByTitle = (matcher: string | RegExp): HTMLElement | null => {
    const all = container.querySelectorAll('[title]');
    for (const el of all) {
      const title = el.getAttribute('title') || '';
      if (matchText(title, matcher)) {
        return el as HTMLElement;
      }
    }
    return null;
  };

  const getByTitle = (matcher: string | RegExp): HTMLElement => {
    const el = queryByTitle(matcher);
    if (!el) {
      throw new Error(`Unable to find element with title: ${matcher}\nContainer: ${container.innerHTML}`);
    }
    return el;
  };

  const unmount = () => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    container.remove();
  };

  return {
    container,
    unmount,
    getByText,
    queryByText,
    getAllByText,
    getByTitle,
    queryByTitle,
  };
}

function makeMockInspection(perfData?: Partial<PerformanceData>): WebsiteInspection {
  return {
    id: 'test-scroll-challenge-inspection',
    mode: 'quick',
    startedAt: 1700000000000,
    completedAt: 1700000001000,
    target: {
      url: 'https://challenge.siteradar.dev/products',
      origin: 'https://challenge.siteradar.dev',
      hostname: 'challenge.siteradar.dev',
      inspectedAt: 1700000000000,
    },
    browser: { name: 'chrome' },
    summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
    findings: [],
    modules: {
      performance: {
        module: 'performance',
        status: 'completed',
        collectedAt: 1700000000500,
        errors: [],
        limitations: [],
        sources: ['PerformanceCollector'],
        coverage: { expected: 4, collected: 4, unavailable: 0, supported: true },
        data: perfData as PerformanceData,
      },
    },
  };
}

describe('Milestone 3 Challenge Suite: Full Page Scrolled & Lazy Delta Telemetry', () => {
  let mountedResult: RenderResult | null = null;

  afterEach(() => {
    if (mountedResult) {
      mountedResult.unmount();
      mountedResult = null;
    }
    document.body.innerHTML = '';
  });

  describe('Case 1: Scrolled Lazy-Load Growth', () => {
    it('accurately calculates and renders lazy-load delta badge and full-page wire metric', () => {
      // Given: Initial wire: 200,000 bytes (195.3 KB), Scrolled wire: 500,000 bytes (488.3 KB)
      // Delta: 300,000 bytes -> 292.96875 KB -> +293 KB lazy
      const inspection = makeMockInspection({
        resourceCount: 15,
        wireTransferBytes: 200000,
        decodedBytes: 600000,
        scrolledResourceCount: 38,
        scrolledWireTransferBytes: 500000,
        scrolledDecodedBytes: 1500000,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // 1. Initial Wire display
      const initialWire = mountedResult.getByText('Wire: 195.3 KB');
      expect(initialWire).toBeDefined();

      // 2. Full Page Section & Scrolled Wire display
      const fullPageLabel = mountedResult.getByText('Full Page:');
      expect(fullPageLabel).toBeDefined();

      const scrolledWire = mountedResult.getByText('Wire: 488.3 KB');
      expect(scrolledWire).toBeDefined();

      // 3. Lazy delta badge: +293 KB lazy
      const lazyBadge = mountedResult.getByText('+293 KB lazy');
      expect(lazyBadge).toBeDefined();
      expect(lazyBadge.className).toContain('text-amber-700');

      // 4. Scrolled request count badge
      const scrolledReqs = mountedResult.getByText('(Scrolled • 38 reqs)');
      expect(scrolledReqs).toBeDefined();
    });

    it('preserves accuracy with static server-side rendering', () => {
      const inspection = makeMockInspection({
        resourceCount: 15,
        wireTransferBytes: 200000,
        decodedBytes: 600000,
        scrolledResourceCount: 38,
        scrolledWireTransferBytes: 500000,
        scrolledDecodedBytes: 1500000,
      });

      const html = renderToString(<PageVitalsCard inspection={inspection} />);
      expect(html).toContain('Wire: 195.3 KB');
      expect(html).toContain('Full Page:');
      expect(html).toContain('Wire: 488.3 KB');
      expect(html).toContain('+293 KB lazy');
      expect(html).toContain('(Scrolled • 38 reqs)');
    });
  });

  describe('Case 2: Zero Lazy Load', () => {
    it('omits lazy load delta badge when scrolled wire transfer is identical to initial wire transfer', () => {
      // Given: Initial wire: 200,000 bytes, Scrolled wire: 200,000 bytes
      // Delta: 0 bytes -> lazyWire === 0 -> NO lazy load badge rendered
      const inspection = makeMockInspection({
        resourceCount: 20,
        wireTransferBytes: 200000,
        decodedBytes: 500000,
        scrolledResourceCount: 20,
        scrolledWireTransferBytes: 200000,
        scrolledDecodedBytes: 500000,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // Initial and Full Page both display Wire: 195.3 KB
      const wireElements = mountedResult.getAllByText('Wire: 195.3 KB');
      expect(wireElements.length).toBe(2);

      // Full Page section is present
      expect(mountedResult.getByText('Full Page:')).toBeDefined();

      // Lazy delta badge must NOT exist
      const lazyBadge = mountedResult.queryByText(/\+.*lazy/);
      expect(lazyBadge).toBeNull();
      expect(mountedResult.container.innerHTML).not.toContain('+0 B lazy');
      expect(mountedResult.container.innerHTML).not.toContain('+0 KB lazy');
      expect(mountedResult.container.innerHTML).not.toContain(' lazy</span>');
    });
  });

  describe('Case 3: Scrolled Cache Hits & Opaque Assets', () => {
    it('renders cache hit and opaque warning badges in Full Page subsection with explanatory tooltips', () => {
      // Given: Scrolled page has 3 cached assets (75,000 bytes) and 5 opaque resources
      const inspection = makeMockInspection({
        resourceCount: 10,
        wireTransferBytes: 100000,
        decodedBytes: 200000,
        cacheHitCount: 0,
        cacheHitBytes: 0,
        opaqueResourceCount: 0,
        scrolledResourceCount: 25,
        scrolledWireTransferBytes: 250000,
        scrolledDecodedBytes: 600000,
        scrolledCacheHitCount: 3,
        scrolledCacheHitBytes: 75000, // 73.2 KB
        scrolledOpaqueResourceCount: 5,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // Verify Full Page cache badge
      const cacheBadge = mountedResult.getByText('3 cached (73.2 KB)');
      expect(cacheBadge).toBeDefined();
      expect(cacheBadge.className).toContain('text-emerald-700');

      const cacheTooltip = mountedResult.getByTitle(
        'Assets served from local browser cache without network transfer.'
      );
      expect(cacheTooltip).toBe(cacheBadge);

      // Verify Full Page TAO warning badge
      const opaqueBadge = mountedResult.getByText('5 cross-origin (no TAO)');
      expect(opaqueBadge).toBeDefined();
      expect(opaqueBadge.className).toContain('text-amber-700');

      const opaqueTooltip = mountedResult.getByTitle(
        'Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only.'
      );
      expect(opaqueTooltip).toBe(opaqueBadge);

      // Initial section should not have cache or opaque badges because initial counts were 0
      const initialBadges = mountedResult.getAllByText(/cached|cross-origin/);
      expect(initialBadges.length).toBe(2); // Only the 2 in Full Page
    });
  });

  describe('Case 4: Infinite Scroll Bounded Badge', () => {
    it('renders Infinite Feed (Bounded) chip with title when isInfiniteScrollDetected is true', () => {
      const inspection = makeMockInspection({
        resourceCount: 25,
        wireTransferBytes: 150000,
        scrolledResourceCount: 80,
        scrolledWireTransferBytes: 900000,
        isInfiniteScrollDetected: true,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      const infiniteChip = mountedResult.getByText('Infinite Feed (Bounded)');
      expect(infiniteChip).toBeDefined();
      expect(infiniteChip.className).toContain('bg-sky-500/10');
      expect(infiniteChip.className).toContain('text-sky-700');

      const infiniteTooltip = mountedResult.getByTitle(
        'This site appends infinite content on scroll. Measurement was safely bounded to initial loaded viewports.'
      );
      expect(infiniteTooltip).toBe(infiniteChip);
    });

    it('omits Infinite Feed chip when isInfiniteScrollDetected is false or undefined', () => {
      const inspection = makeMockInspection({
        resourceCount: 25,
        wireTransferBytes: 150000,
        scrolledResourceCount: 40,
        scrolledWireTransferBytes: 300000,
        isInfiniteScrollDetected: false,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      const infiniteChip = mountedResult.queryByText('Infinite Feed (Bounded)');
      expect(infiniteChip).toBeNull();
      expect(mountedResult.container.innerHTML).not.toContain('Infinite Feed');
    });
  });

  describe('Case 5: Scrolled Section Absent', () => {
    it('completely omits the Full Page subsection when scrolledData is absent, rendering initial cleanly', () => {
      const inspection = makeMockInspection({
        resourceCount: 18,
        wireTransferBytes: 350000,
        decodedBytes: 950000,
        cacheHitCount: 2,
        cacheHitBytes: 50000,
        opaqueResourceCount: 1,
        // No scrolled fields provided
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // Initial section must render completely
      expect(mountedResult.getByText('Data Usage:')).toBeDefined();
      expect(mountedResult.getByText('Wire: 341.8 KB')).toBeDefined();
      expect(mountedResult.getByText('Decoded: 927.7 KB')).toBeDefined();
      expect(mountedResult.getByText('(Initial • 18 reqs)')).toBeDefined();
      expect(mountedResult.getByText('2 cached (48.8 KB)')).toBeDefined();
      expect(mountedResult.getByText('1 cross-origin (no TAO)')).toBeDefined();

      // Full Page section must be completely absent
      const fullPageHeader = mountedResult.queryByText('Full Page:');
      expect(fullPageHeader).toBeNull();
      expect(mountedResult.queryByText(/Scrolled •/)).toBeNull();
      expect(mountedResult.queryByText(/lazy/)).toBeNull();
      expect(mountedResult.container.innerHTML).not.toContain('Full Page:');
    });

    it('renders cleanly when performance module data is completely empty/undefined', () => {
      const inspection: WebsiteInspection = {
        id: 'empty-perf-id',
        mode: 'quick',
        startedAt: 1700000000000,
        target: {
          url: 'https://example.com/',
          origin: 'https://example.com',
          hostname: 'example.com',
          inspectedAt: 1700000000000,
        },
        browser: { name: 'chrome' },
        summary: { completedModules: 0, partialModules: 0, failedModules: 0, totalFindings: 0 },
        findings: [],
        modules: {},
      };

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      expect(mountedResult.getByText('Data Usage:')).toBeDefined();
      expect(mountedResult.getByText('0 reqs')).toBeDefined();
      expect(mountedResult.queryByText('Full Page:')).toBeNull();
    });
  });

  describe('Case 6: Full Data Flow Integration via resource-aggregator.ts', () => {
    it('aggregates synthetic network entries through resource-aggregator and verifies complete DOM rendering', () => {
      const PAGE_URL = 'https://challenge.siteradar.dev/products';

      const mockNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 25,
        connectStart: 25,
        connectEnd: 60,
        requestStart: 60,
        responseStart: 95,
        domContentLoadedEventEnd: 350,
        loadEventEnd: 600,
        transferSize: 15000,
        encodedBodySize: 14500,
        decodedBodySize: 45000,
      } as PerformanceNavigationTiming;

      // Initial viewport resources
      const initialResources: PerformanceResourceTiming[] = [
        {
          name: 'https://challenge.siteradar.dev/js/bundle.js',
          initiatorType: 'script',
          transferSize: 85000,
          encodedBodySize: 84000,
          decodedBodySize: 220000,
        } as PerformanceResourceTiming,
        {
          name: 'https://challenge.siteradar.dev/css/styles.css',
          initiatorType: 'css',
          transferSize: 15000,
          encodedBodySize: 14000,
          decodedBodySize: 60000,
        } as PerformanceResourceTiming,
        // Cache hit
        {
          name: 'https://challenge.siteradar.dev/img/logo.svg',
          initiatorType: 'image',
          transferSize: 0,
          encodedBodySize: 25000,
          decodedBodySize: 25000,
        } as PerformanceResourceTiming,
        // Cross-origin opaque resource (no TAO)
        {
          name: 'https://cdn.external.com/tracker.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        } as PerformanceResourceTiming,
      ];

      // Scrolled full-page resources: initial + lazy loaded items
      const scrolledResources: PerformanceResourceTiming[] = [
        ...initialResources,
        // 2 lazy images loaded on scroll
        {
          name: 'https://challenge.siteradar.dev/img/lazy-1.jpg',
          initiatorType: 'image',
          transferSize: 120000,
          encodedBodySize: 118000,
          decodedBodySize: 120000,
        } as PerformanceResourceTiming,
        {
          name: 'https://challenge.siteradar.dev/img/lazy-2.jpg',
          initiatorType: 'image',
          transferSize: 130000,
          encodedBodySize: 128000,
          decodedBodySize: 130000,
        } as PerformanceResourceTiming,
        // 2 additional cached assets on scroll
        {
          name: 'https://challenge.siteradar.dev/fonts/inter.woff2',
          initiatorType: 'font',
          transferSize: 0,
          encodedBodySize: 32000,
          decodedBodySize: 32000,
        } as PerformanceResourceTiming,
        {
          name: 'https://challenge.siteradar.dev/img/icon-sprite.svg',
          initiatorType: 'image',
          transferSize: 0,
          encodedBodySize: 18000,
          decodedBodySize: 18000,
        } as PerformanceResourceTiming,
        // 2 additional opaque cross-origin resources on scroll
        {
          name: 'https://ads.adnetwork.com/tag.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        } as PerformanceResourceTiming,
        {
          name: 'https://analytics.tracker.org/collect',
          initiatorType: 'fetch',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        } as PerformanceResourceTiming,
      ];

      // Run shared aggregation engine for both phases
      const initialMetrics = aggregateResourceMetrics(initialResources, mockNav, PAGE_URL);
      const scrolledMetrics = aggregateResourceMetrics(scrolledResources, mockNav, PAGE_URL);

      // Verify aggregate outputs mathematically
      // Initial:
      // wire: nav(15000) + bundle(85000) + styles(15000) = 115000 (112.3 KB)
      // decoded: nav(45000) + bundle(220000) + styles(60000) + logo(25000) = 350000 (341.8 KB)
      // cacheHitCount: 1 (logo), cacheHitBytes: 25000 (24.4 KB)
      // opaqueCount: 1 (cdn.external.com)
      // totalRequests: 4 resources + 1 nav = 5
      expect(initialMetrics.wireTransferBytes).toBe(115000);
      expect(initialMetrics.decodedBytes).toBe(350000);
      expect(initialMetrics.cacheHitCount).toBe(1);
      expect(initialMetrics.cacheHitBytes).toBe(25000);
      expect(initialMetrics.opaqueResourceCount).toBe(1);
      expect(initialMetrics.totalRequests).toBe(5);

      // Scrolled:
      // wire: initial(115000) + lazy-1(120000) + lazy-2(130000) = 365000 (356.4 KB)
      // decoded: initial(350000) + lazy-1(120000) + lazy-2(130000) + inter(32000) + icon(18000) = 650000 (634.8 KB)
      // cacheHitCount: 1 + 2 = 3, cacheHitBytes: 25000 + 32000 + 18000 = 75000 (73.2 KB)
      // opaqueCount: 1 + 2 = 3
      // totalRequests: 5 initial + 6 lazy = 11
      expect(scrolledMetrics.wireTransferBytes).toBe(365000);
      expect(scrolledMetrics.decodedBytes).toBe(650000);
      expect(scrolledMetrics.cacheHitCount).toBe(3);
      expect(scrolledMetrics.cacheHitBytes).toBe(75000);
      expect(scrolledMetrics.opaqueResourceCount).toBe(3);
      expect(scrolledMetrics.totalRequests).toBe(11);

      // Construct PerformanceData conforming to schema
      const perfData: PerformanceData = {
        navigationTiming: {
          dnsLookupMs: 15,
          tcpConnectMs: 35,
          ttfbMs: 95,
          domLoadMs: 350,
          fullLoadMs: 600,
        },
        paintTiming: { fcpMs: 250 },
        webVitals: { lcpMs: 480, clsScore: 0.005 },
        resourceCount: initialMetrics.totalRequests,
        wireTransferBytes: initialMetrics.wireTransferBytes,
        decodedBytes: initialMetrics.decodedBytes,
        transferSizeApprox: initialMetrics.wireTransferBytes,
        decodedSizeApprox: initialMetrics.decodedBytes,
        cacheHitCount: initialMetrics.cacheHitCount,
        cacheHitBytes: initialMetrics.cacheHitBytes,
        opaqueResourceCount: initialMetrics.opaqueResourceCount,
        opaqueResourceOrigins: initialMetrics.opaqueResourceOrigins,
        categoryBreakdown: initialMetrics.categoryBreakdown,
        resourceTypes: initialMetrics.resourceTypes,
        scrolledResourceCount: scrolledMetrics.totalRequests,
        scrolledWireTransferBytes: scrolledMetrics.wireTransferBytes,
        scrolledDecodedBytes: scrolledMetrics.decodedBytes,
        scrolledTransferSizeApprox: scrolledMetrics.wireTransferBytes,
        scrolledDecodedSizeApprox: scrolledMetrics.decodedBytes,
        scrolledCacheHitCount: scrolledMetrics.cacheHitCount,
        scrolledCacheHitBytes: scrolledMetrics.cacheHitBytes,
        scrolledOpaqueResourceCount: scrolledMetrics.opaqueResourceCount,
        isInfiniteScrollDetected: false,
      };

      const inspection = makeMockInspection(perfData);
      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // Assert Navigation and Vitals
      expect(mountedResult.getByText('95ms')).toBeDefined(); // TTFB
      expect(mountedResult.getByText('250ms')).toBeDefined(); // FCP
      expect(mountedResult.getByText('480ms')).toBeDefined(); // LCP
      expect(mountedResult.getByText('600ms')).toBeDefined(); // Full load

      // Assert Initial Data Usage
      expect(mountedResult.getByText('Wire: 112.3 KB')).toBeDefined();
      expect(mountedResult.getByText('Decoded: 341.8 KB')).toBeDefined();
      expect(mountedResult.getByText('(Initial • 5 reqs)')).toBeDefined();
      expect(mountedResult.getByText('1 cached (24.4 KB)')).toBeDefined();
      expect(mountedResult.getByText('1 cross-origin (no TAO)')).toBeDefined();

      // Assert Full Page Scrolled Data Usage
      expect(mountedResult.getByText('Full Page:')).toBeDefined();
      expect(mountedResult.getByText('Wire: 356.4 KB')).toBeDefined();
      expect(mountedResult.getByText('Decoded: 634.8 KB')).toBeDefined();
      expect(mountedResult.getByText('(Scrolled • 11 reqs)')).toBeDefined();

      // Assert Lazy delta: (365000 - 115000) = 250000 bytes -> 244.140625 KB -> +244.1 KB lazy
      expect(mountedResult.getByText('+244.1 KB lazy')).toBeDefined();

      // Assert Scrolled Cache and TAO Badges
      expect(mountedResult.getByText('3 cached (73.2 KB)')).toBeDefined();
      expect(mountedResult.getByText('3 cross-origin (no TAO)')).toBeDefined();

      // Assert Accessibility Tooltips
      const wireTooltips = mountedResult.getAllByText(/Wire: /);
      expect(wireTooltips.length).toBe(2);
      expect(wireTooltips[0]?.getAttribute('title')).toContain('compressed bytes received over network');
      expect(wireTooltips[1]?.getAttribute('title')).toContain('compressed bytes received over network');

      const decodedTooltips = mountedResult.getAllByText(/Decoded: /);
      expect(decodedTooltips.length).toBe(2);
      expect(decodedTooltips[0]?.getAttribute('title')).toBe('Decoded reflects uncompressed size in memory.');
      expect(decodedTooltips[1]?.getAttribute('title')).toBe('Decoded reflects uncompressed size in memory.');
    });
  });

  describe('Adversarial Scenarios & Edge Cases', () => {
    it('Case 7: Clamps lazy wire delta to 0 and avoids negative lazy badge when scrolled bytes < initial bytes', () => {
      // Anomaly scenario: scrolledWireTransferBytes reported as less than initial wireTransferBytes
      const inspection = makeMockInspection({
        resourceCount: 10,
        wireTransferBytes: 300000, // 293 KB
        scrolledResourceCount: 12,
        scrolledWireTransferBytes: 200000, // 195.3 KB (< 300000)
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      expect(mountedResult.getByText('Wire: 293 KB')).toBeDefined();
      expect(mountedResult.getByText('Full Page:')).toBeDefined();
      expect(mountedResult.getByText('Wire: 195.3 KB')).toBeDefined();

      // Must NOT contain negative lazy badge
      expect(mountedResult.queryByText(/lazy/i)).toBeNull();
      expect(mountedResult.container.innerHTML).not.toContain('+-');
      expect(mountedResult.container.innerHTML).not.toContain('-97.7 KB');
    });

    it('Case 8: Gracefully falls back to legacy approx fields for both initial and scrolled sections', () => {
      // Legacy inspection without new wireTransferBytes / decodedBytes fields
      const inspection = makeMockInspection({
        resourceCount: 8,
        transferSizeApprox: 102400, // 100 KB
        decodedSizeApprox: 409600, // 400 KB
        scrolledResourceCount: 16,
        scrolledTransferSizeApprox: 307200, // 300 KB
        scrolledDecodedSizeApprox: 1024000, // 1000 KB
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      expect(mountedResult.getByText('Wire: 100 KB')).toBeDefined();
      expect(mountedResult.getByText('Decoded: 400 KB')).toBeDefined();
      expect(mountedResult.getByText('Full Page:')).toBeDefined();
      expect(mountedResult.getByText('Wire: 300 KB')).toBeDefined();
      expect(mountedResult.getByText('Decoded: 1000 KB')).toBeDefined();
      expect(mountedResult.getByText('+200 KB lazy')).toBeDefined(); // (300 - 100) KB
    });

    it('Case 9: Correctly displays cached lazy loads where wire transfer did not grow but cache hits did', () => {
      const inspection = makeMockInspection({
        resourceCount: 10,
        wireTransferBytes: 150000,
        decodedBytes: 300000,
        cacheHitCount: 0,
        scrolledResourceCount: 15,
        scrolledWireTransferBytes: 150000, // No new network wire transfer
        scrolledDecodedBytes: 700000, // Additional decoded bytes from cache
        scrolledCacheHitCount: 5,
        scrolledCacheHitBytes: 150000, // 146.5 KB
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      // Scrolled cache badge is visible
      expect(mountedResult.getByText('5 cached (146.5 KB)')).toBeDefined();
      // Scrolled decoded is visible
      expect(mountedResult.getByText('Decoded: 683.6 KB')).toBeDefined();
      // No wire lazy delta badge because wire didn't grow
      expect(mountedResult.queryByText(/lazy/i)).toBeNull();
    });

    it('Case 10: Supports multi-gigabyte scale on scrolled lazy load without numeric overflow or NaN', () => {
      const initialWire = 1.2 * 1024 * 1024 * 1024; // 1.2 GB = 1,288,490,188 bytes
      const scrolledWire = 3.5 * 1024 * 1024 * 1024; // 3.5 GB = 3,758,096,384 bytes
      // Delta = 2.3 GB

      const inspection = makeMockInspection({
        resourceCount: 500,
        wireTransferBytes: initialWire,
        scrolledResourceCount: 1200,
        scrolledWireTransferBytes: scrolledWire,
      });

      mountedResult = render(<PageVitalsCard inspection={inspection} />);

      expect(mountedResult.getByText('Wire: 1.2 GB')).toBeDefined();
      expect(mountedResult.getByText('Wire: 3.5 GB')).toBeDefined();
      expect(mountedResult.getByText('+2.3 GB lazy')).toBeDefined();
      expect(mountedResult.container.innerHTML).not.toContain('NaN');
      expect(mountedResult.container.innerHTML).not.toContain('undefined');
    });
  });
});
