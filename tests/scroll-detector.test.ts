import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isFeedLikeResourceUrl,
  detectScrollTarget,
  detectFeedDomSignals,
  detectFiniteCounterSignals,
  classifyScrollBehavior,
  waitForScrollQuiescence,
  measureAndScrollPage,
  type ScrollObservation,
} from '../src/collectors/page/scroll-detector';

function resetDom(): void {
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
  document.body.innerHTML = '';
}

function setViewport(height: number): void {
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
    configurable: true,
  });
}

function setRootHeights(scrollHeight: number, clientHeight?: number): void {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'offsetHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document.body, 'scrollHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document.body, 'offsetHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  if (clientHeight !== undefined) {
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: clientHeight,
      writable: true,
      configurable: true,
    });
  }
}

function installScrollableWindow(options: {
  initialY?: number;
  maxScrollY?: number;
  onScrollTo?: (y: number) => void;
} = {}): {
  positions: number[];
  scrollToSpy: ReturnType<typeof vi.fn>;
  setMaxScrollY: (max: number) => void;
} {
  let currentY = options.initialY ?? 0;
  let maxScrollY = options.maxScrollY ?? Number.POSITIVE_INFINITY;
  const positions: number[] = [];

  Object.defineProperty(window, 'scrollY', {
    get: () => currentY,
    configurable: true,
  });
  Object.defineProperty(window, 'scrollX', {
    get: () => 0,
    configurable: true,
  });

  const scrollToSpy = vi.fn((arg1: ScrollToOptions | number, arg2?: number) => {
    const rawTop = typeof arg1 === 'object' && arg1 !== null ? arg1.top ?? 0 : arg2 ?? 0;
    const clamped = Math.max(0, Math.min(maxScrollY, rawTop));
    currentY = clamped;
    positions.push(clamped);
    options.onScrollTo?.(clamped);
  });

  Object.defineProperty(window, 'scrollTo', {
    value: scrollToSpy,
    writable: true,
    configurable: true,
  });

  return {
    positions,
    scrollToSpy,
    setMaxScrollY: (max: number) => {
      maxScrollY = max;
    },
  };
}

function installResourceList(initial: Array<Partial<PerformanceResourceTiming>> = []): {
  entries: PerformanceResourceTiming[];
  pushEntry: (entry: Partial<PerformanceResourceTiming>) => void;
} {
  const entries: PerformanceResourceTiming[] = initial.map((item) => ({
    name: item.name ?? 'https://example.com/asset.js',
    entryType: 'resource',
    initiatorType: item.initiatorType ?? 'script',
    startTime: item.startTime ?? 0,
    duration: item.duration ?? 10,
    transferSize: item.transferSize ?? 1024,
    encodedBodySize: item.encodedBodySize ?? 1024,
    decodedBodySize: item.decodedBodySize ?? 2048,
  })) as PerformanceResourceTiming[];

  vi.spyOn(window.performance, 'getEntriesByType').mockImplementation((type: string) => {
    if (type === 'resource') return entries;
    return [];
  });

  return {
    entries,
    pushEntry: (item) => {
      entries.push({
        name: item.name ?? 'https://example.com/api/items',
        entryType: 'resource',
        initiatorType: item.initiatorType ?? 'fetch',
        startTime: item.startTime ?? 100,
        duration: item.duration ?? 25,
        transferSize: item.transferSize ?? 2048,
        encodedBodySize: item.encodedBodySize ?? 2048,
        decodedBodySize: item.decodedBodySize ?? 4096,
      } as PerformanceResourceTiming);
    },
  };
}

function makeBaseObservation(overrides: Partial<ScrollObservation> = {}): ScrollObservation {
  return {
    target: {
      layoutMode: 'document',
      isFixedHeight: false,
      scrollContainer: null,
      viewportHeight: 800,
      initialScrollHeight: 2400,
      maxScrollTop: 1600,
      signals: [],
    },
    initialHeight: 2400,
    finalHeight: 2400,
    viewportHeight: 800,
    stepsExecuted: 3,
    reachedBottom: true,
    clampedEarly: false,
    growthWaves: 0,
    totalGrowthPx: 0,
    tailAppendWaves: 0,
    tailAppendedNodes: 0,
    newFetchXhrCount: 0,
    feedLikeRequestCount: 0,
    requestWaves: 0,
    feedDom: {
      hasRoleFeed: false,
      homogeneousCardClusterCount: 0,
      hasVirtualizationHints: false,
      hasVerticalScrollSnap: false,
    },
    finiteSignals: {
      hasPagination: false,
      hasReachableFooter: false,
    },
    quiescenceTimedOut: false,
    ...overrides,
  };
}

describe('scroll-detector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDom();
    setViewport(800);
    setRootHeights(800, 800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetDom();
  });

  describe('1. Fixed-height websites & early scroll clamp protection', () => {
    it('classifies html/body overflow:hidden + 100vh as fixed-height and never calls window.scrollTo', async () => {
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      setRootHeights(800, 800);

      const { scrollToSpy } = installScrollableWindow();
      installResourceList();

      const target = detectScrollTarget(document, window);
      expect(target.layoutMode).toBe('fixed-height');
      expect(target.isFixedHeight).toBe(true);
      expect(target.scrollContainer).toBeNull();
      expect(target.maxScrollTop).toBe(0);

      const result = await measureAndScrollPage(document, window);
      expect(result.layoutScrollType).toBe('fixed-height');
      expect(result.isFixedHeight).toBe(true);
      expect(result.isInfiniteScroll).toBe(false);
      expect(result.stepsExecuted).toBe(0);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('classifies clipped overflowing children (scrollHeight > innerHeight) with overflow:hidden as fixed-height without scrolling halfway', async () => {
      document.documentElement.style.overflowY = 'hidden';
      document.body.style.overflowY = 'hidden';
      const clippedWrapper = document.createElement('div');
      clippedWrapper.style.height = '100vh';
      clippedWrapper.style.overflow = 'hidden';
      document.body.appendChild(clippedWrapper);

      // Even though scrollHeight exceeds viewport due to clipped children, root is overflow-locked
      // and no inner scrollable container exists.
      setRootHeights(2400, 800);
      const { scrollToSpy } = installScrollableWindow();
      installResourceList();

      const target = detectScrollTarget(document, window);
      expect(target.layoutMode).toBe('fixed-height');
      expect(target.isFixedHeight).toBe(true);
      expect(target.signals).toContain('html-overflow-locked');

      const result = await measureAndScrollPage(document, window);
      expect(result.layoutScrollType).toBe('fixed-height');
      expect(result.isFixedHeight).toBe(true);
      expect(result.isInfiniteScroll).toBe(false);
      expect(result.stepsExecuted).toBe(0);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('detects body position:fixed as non-scrollable fixed-height when no inner scroller exists', () => {
      document.body.style.position = 'fixed';
      setRootHeights(1800, 800);

      const target = detectScrollTarget(document, window);
      expect(target.layoutMode).toBe('fixed-height');
      expect(target.isFixedHeight).toBe(true);
      expect(target.signals).toContain('body-position-fixed');
    });

    it('stops cleanly on early scroll clamp when page locks halfway down', async () => {
      setRootHeights(3200, 800);
      // Window scroll freezes at 600px even though maxScrollTop is 2400px
      const { positions } = installScrollableWindow({ maxScrollY: 600 });
      installResourceList();

      const promise = measureAndScrollPage(document, window, {
        stepDurationMs: 100,
        foldPauseMs: 50,
        quiescenceQuietMs: 100,
        quiescenceMaxWaitMs: 300,
        scrollBackDurationMs: 50,
      });

      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.clampedEarly).toBe(true);
      expect(result.stepsExecuted).toBe(2);
      expect(result.isFixedHeight).toBe(false);
      expect(result.isInfiniteScroll).toBe(false);
      expect(result.scrollSignals).toContain('scroll-clamped-early');
      expect(Math.max(...positions)).toBe(600);
      expect(positions[positions.length - 1]).toBe(0);
    });
  });

  describe('2. App-shell websites', () => {
    it('detects locked body with scrollable inner <main> and targets inner container instead of window', async () => {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      setRootHeights(800, 800);

      const smallSidebar = document.createElement('div');
      smallSidebar.style.overflowY = 'auto';
      Object.defineProperty(smallSidebar, 'clientHeight', { value: 180, configurable: true });
      Object.defineProperty(smallSidebar, 'scrollHeight', { value: 900, configurable: true });

      const appMain = document.createElement('main');
      appMain.style.overflowY = 'auto';
      Object.defineProperty(appMain, 'clientHeight', { value: 720, configurable: true });
      Object.defineProperty(appMain, 'scrollHeight', { value: 2600, configurable: true });
      appMain.scrollTop = 0;
      appMain.scrollLeft = 0;

      const containerScrollPositions: number[] = [];
      const containerScrollToSpy = vi.fn((arg1: ScrollToOptions | number, arg2?: number) => {
        const top = typeof arg1 === 'object' && arg1 !== null ? arg1.top ?? 0 : arg2 ?? 0;
        const clamped = Math.max(0, Math.min(2600 - 720, top));
        appMain.scrollTop = clamped;
        containerScrollPositions.push(clamped);
      });
      appMain.scrollTo = containerScrollToSpy as unknown as typeof appMain.scrollTo;

      document.body.appendChild(smallSidebar);
      document.body.appendChild(appMain);

      const { scrollToSpy: windowScrollToSpy } = installScrollableWindow();
      installResourceList();

      const target = detectScrollTarget(document, window);
      expect(target.layoutMode).toBe('app-shell');
      expect(target.isFixedHeight).toBe(false);
      expect(target.scrollContainer).toBe(appMain);
      expect(target.viewportHeight).toBe(720);
      expect(target.maxScrollTop).toBe(1880);

      const promise = measureAndScrollPage(document, window, {
        stepDurationMs: 100,
        foldPauseMs: 50,
        quiescenceQuietMs: 100,
        quiescenceMaxWaitMs: 300,
        scrollBackDurationMs: 50,
      });

      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;

      expect(windowScrollToSpy).not.toHaveBeenCalled();
      expect(containerScrollToSpy).toHaveBeenCalled();
      expect(containerScrollPositions.some((y) => y > 0)).toBe(true);
      expect(containerScrollPositions[containerScrollPositions.length - 1]).toBe(0);
      expect(result.layoutScrollType).toBe('app-shell');
      expect(result.isFixedHeight).toBe(false);
      expect(result.isInfiniteScroll).toBe(false);
      expect(result.reachedBottom).toBe(true);
    });

    it('ignores small inner scrollable panels (< 35% of viewport) when root is locked', () => {
      document.documentElement.style.overflow = 'hidden';
      setRootHeights(800, 800);

      const tinyPanel = document.createElement('div');
      tinyPanel.style.overflowY = 'auto';
      Object.defineProperty(tinyPanel, 'clientHeight', { value: 200, configurable: true }); // < 0.35 * 800 = 280
      Object.defineProperty(tinyPanel, 'scrollHeight', { value: 1200, configurable: true });
      document.body.appendChild(tinyPanel);

      const target = detectScrollTarget(document, window);
      expect(target.layoutMode).toBe('fixed-height');
      expect(target.isFixedHeight).toBe(true);
      expect(target.scrollContainer).toBeNull();
    });
  });

  describe('3. Long finite websites (not misclassified as doom-scrolling)', () => {
    it('classifies a tall page (>= 6x viewport) with a one-time lazy-load expansion >25% as long-page', () => {
      const classification = classifyScrollBehavior(
        makeBaseObservation({
          target: {
            layoutMode: 'document',
            isFixedHeight: false,
            scrollContainer: null,
            viewportHeight: 800,
            initialScrollHeight: 4800, // 6x viewport
            maxScrollTop: 4000,
            signals: [],
          },
          initialHeight: 4800,
          finalHeight: 6400, // +33.3% one-time lazy expansion
          viewportHeight: 800,
          stepsExecuted: 7,
          reachedBottom: true,
          growthWaves: 1,
          totalGrowthPx: 1600,
          tailAppendWaves: 0,
          newFetchXhrCount: 1,
          feedLikeRequestCount: 0,
          requestWaves: 1,
          finiteSignals: {
            hasPagination: false,
            hasReachableFooter: true,
          },
        }),
      );

      expect(classification.layoutScrollType).toBe('long-page');
      expect(classification.isInfiniteScroll).toBe(false);
      expect(classification.isFixedHeight).toBe(false);
      expect(classification.scrollConfidence).toBe('high');
      expect(classification.scrollSignals).toContain('single-height-expansion:+1600px');
      expect(classification.scrollSignals).toContain('stable-footer-reachable');
    });

    it('uses pagination and reachable footer counter-signals to prevent false-positive infinite scroll', () => {
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', 'Pagination');
      const nextLink = document.createElement('a');
      nextLink.setAttribute('rel', 'next');
      nextLink.href = '/articles?page=2';
      nav.appendChild(nextLink);

      const footer = document.createElement('footer');
      footer.getBoundingClientRect = () =>
        ({ top: 5300, bottom: 5500, left: 0, right: 1200, width: 1200, height: 200, x: 0, y: 5300, toJSON: () => ({}) }) as DOMRect;

      document.body.appendChild(nav);
      document.body.appendChild(footer);

      const finite = detectFiniteCounterSignals(document, window, null, 5600, 800);
      expect(finite.hasPagination).toBe(true);
      expect(finite.hasReachableFooter).toBe(true);

      const classification = classifyScrollBehavior(
        makeBaseObservation({
          initialHeight: 5000,
          finalHeight: 5600,
          viewportHeight: 800,
          growthWaves: 1,
          totalGrowthPx: 600,
          tailAppendWaves: 1,
          tailAppendedNodes: 2,
          feedLikeRequestCount: 1,
          requestWaves: 1,
          feedDom: {
            hasRoleFeed: false,
            homogeneousCardClusterCount: 8,
            hasVirtualizationHints: false,
            hasVerticalScrollSnap: false,
          },
          finiteSignals: finite,
        }),
      );

      expect(classification.layoutScrollType).toBe('long-page');
      expect(classification.isInfiniteScroll).toBe(false);
      expect(classification.scrollSignals).toContain('pagination-controls-present');
      expect(classification.scrollSignals).toContain('stable-footer-reachable');
    });

    it('measureAndScrollPage classifies a 6x viewport article expanding once by >30% with a footer as long-page', async () => {
      let docHeight = 4800; // 6x 800px viewport
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'clientHeight', {
        value: 800,
        configurable: true,
      });

      const footer = document.createElement('footer');
      footer.textContent = 'Copyright 2026';
      footer.getBoundingClientRect = () => {
        const y = window.scrollY;
        const top = docHeight - 200 - y;
        return {
          top,
          bottom: top + 200,
          left: 0,
          right: 1200,
          width: 1200,
          height: 200,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      };
      document.body.appendChild(footer);

      let expandedOnce = false;
      installScrollableWindow({
        onScrollTo: (y) => {
          // One-time lazy-load expansion (+33% height) when reaching bottom half
          if (!expandedOnce && y >= 3200) {
            expandedOnce = true;
            docHeight = 6400;
          }
        },
      });
      installResourceList();

      const promise = measureAndScrollPage(document, window, {
        stepFraction: 0.75,
        stepDurationMs: 100,
        foldPauseMs: 50,
        maxSteps: 12,
        quiescenceQuietMs: 100,
        quiescenceMaxWaitMs: 300,
        scrollBackDurationMs: 50,
      });

      await vi.advanceTimersByTimeAsync(8000);
      const result = await promise;

      expect(result.initialHeight).toBe(4800);
      expect(result.finalHeight).toBe(6400);
      expect(result.layoutScrollType).toBe('long-page');
      expect(result.isInfiniteScroll).toBe(false);
      expect(result.isFixedHeight).toBe(false);
    });
  });

  describe('4. Doom-scrolling / infinite-feed websites', () => {
    it('recognizes feed-like API URLs and distinguishes them from static assets', () => {
      expect(isFeedLikeResourceUrl('https://api.example.com/v2/feed/posts?cursor=abc123')).toBe(true);
      expect(isFeedLikeResourceUrl('https://example.com/graphql?after=eyJpZCI6MTB9')).toBe(true);
      expect(isFeedLikeResourceUrl('https://example.com/articles?page=3&limit=20')).toBe(true);
      expect(isFeedLikeResourceUrl('https://cdn.example.com/images/hero-banner.webp')).toBe(false);
      expect(isFeedLikeResourceUrl('https://cdn.example.com/app.bundle.js')).toBe(false);
    });

    it('detects feed DOM & CSS signals: [role="feed"], homogeneous cards, virtualization, and vertical scroll-snap', () => {
      const feed = document.createElement('div');
      feed.setAttribute('role', 'feed');
      for (let i = 0; i < 8; i++) {
        const card = document.createElement('article');
        card.className = 'feed-card';
        card.setAttribute('data-index', String(i));
        feed.appendChild(card);
      }

      document.documentElement.style.scrollSnapType = 'y mandatory';
      document.body.appendChild(feed);

      const signals = detectFeedDomSignals(document, window);
      expect(signals.hasRoleFeed).toBe(true);
      expect(signals.homogeneousCardClusterCount).toBe(8);
      expect(signals.hasVirtualizationHints).toBe(true);
      expect(signals.hasVerticalScrollSnap).toBe(true);
    });

    it('detects synthetic spacer virtualization without data-index attributes', () => {
      const spacer = document.createElement('div');
      spacer.style.height = '4000px';
      for (let i = 0; i < 4; i++) {
        const row = document.createElement('div');
        row.style.position = 'absolute';
        row.style.transform = `translateY(${i * 120}px)`;
        spacer.appendChild(row);
      }
      document.body.appendChild(spacer);

      const signals = detectFeedDomSignals(document, window);
      expect(signals.hasVirtualizationHints).toBe(true);
    });

    it('classifies repeated growth waves + tail appends + feed requests as infinite-feed', () => {
      const classification = classifyScrollBehavior(
        makeBaseObservation({
          initialHeight: 2400,
          finalHeight: 7200,
          stepsExecuted: 6,
          reachedBottom: false,
          growthWaves: 3,
          totalGrowthPx: 4800,
          tailAppendWaves: 3,
          tailAppendedNodes: 15,
          newFetchXhrCount: 3,
          feedLikeRequestCount: 3,
          requestWaves: 3,
          feedDom: {
            hasRoleFeed: true,
            homogeneousCardClusterCount: 15,
            hasVirtualizationHints: false,
            hasVerticalScrollSnap: false,
          },
          finiteSignals: {
            hasPagination: false,
            hasReachableFooter: false,
          },
        }),
      );

      expect(classification.layoutScrollType).toBe('infinite-feed');
      expect(classification.isInfiniteScroll).toBe(true);
      expect(classification.isFixedHeight).toBe(false);
      expect(classification.scrollConfidence).toBe('high');
      expect(classification.scrollSignals).toContain('repeated-growth-waves:3');
      expect(classification.scrollSignals).toContain('dom-role-feed');
    });

    it('measureAndScrollPage detects infinite-feed across live scroll waves, tail MutationObserver appends, and feed XHRs', async () => {
      let docHeight = 2000;
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'clientHeight', {
        value: 800,
        configurable: true,
      });

      const feed = document.createElement('div');
      feed.setAttribute('role', 'feed');
      for (let i = 0; i < 6; i++) {
        const item = document.createElement('article');
        item.className = 'post-card';
        feed.appendChild(item);
      }
      document.body.appendChild(feed);

      const { pushEntry } = installResourceList();
      let wave = 0;

      installScrollableWindow({
        onScrollTo: (y) => {
          // Trigger a new growth wave whenever reaching near current bottom
          if (y + 800 >= docHeight - 600 && wave < 3) {
            wave++;
            docHeight += 1200;
            for (let k = 0; k < 3; k++) {
              const card = document.createElement('article');
              card.className = 'post-card';
              feed.appendChild(card);
            }
            pushEntry({
              name: `https://example.com/api/v1/feed?cursor=wave_${wave}`,
              initiatorType: 'fetch',
            });
          }
        },
      });

      const promise = measureAndScrollPage(document, window, {
        stepFraction: 0.75,
        stepDurationMs: 100,
        foldPauseMs: 80,
        maxSteps: 8,
        quiescenceQuietMs: 100,
        quiescenceMaxWaitMs: 300,
        scrollBackDurationMs: 50,
      });

      await vi.advanceTimersByTimeAsync(8000);
      const result = await promise;

      expect(result.layoutScrollType).toBe('infinite-feed');
      expect(result.isInfiniteScroll).toBe(true);
      expect(result.isFixedHeight).toBe(false);
      expect(result.finalHeight).toBeGreaterThan(result.initialHeight);
      expect(result.scrollSignals).toContain('dom-role-feed');
    });
  });

  describe('5. Slow stepped scrolling & network/DOM settle behavior', () => {
    it('advances viewport-by-viewport monotonically and restores original scroll position', async () => {
      setViewport(800);
      setRootHeights(2400, 800); // maxScrollTop = 1600; step = 600 -> folds at 600, 1200, 1600, then restore 0
      const { positions } = installScrollableWindow({ initialY: 0 });
      installResourceList();

      const promise = measureAndScrollPage(document, window, {
        stepFraction: 0.75,
        stepDurationMs: 300,
        foldPauseMs: 300,
        quiescenceQuietMs: 200,
        quiescenceMaxWaitMs: 500,
        scrollBackDurationMs: 200,
      });

      await vi.advanceTimersByTimeAsync(10_000);
      const result = await promise;

      expect(result.stepsExecuted).toBe(3);
      expect(result.reachedBottom).toBe(true);
      expect(result.layoutScrollType).toBe('finite');

      // Verify stepped fold targets (600, 1200, 1600) were visited in order before returning to 0
      expect(positions.some((y) => Math.round(y) === 600)).toBe(true);
      expect(positions.some((y) => Math.round(y) === 1200)).toBe(true);
      expect(positions.some((y) => Math.round(y) === 1600)).toBe(true);

      const first600Idx = positions.findIndex((y) => Math.round(y) === 600);
      const first1200Idx = positions.findIndex((y) => Math.round(y) === 1200);
      const first1600Idx = positions.findIndex((y) => Math.round(y) === 1600);
      expect(first600Idx).toBeGreaterThanOrEqual(0);
      expect(first1200Idx).toBeGreaterThan(first600Idx);
      expect(first1600Idx).toBeGreaterThan(first1200Idx);
      expect(positions[positions.length - 1]).toBe(0);
    });

    it('waitForScrollQuiescence waits for late resource entries and DOM mutations before resolving', async () => {
      const { pushEntry } = installResourceList([{ name: 'https://example.com/init.js' }]);

      let resolved:
        | { timedOut: boolean; newResourceCount: number; tailAppendedNodes: number }
        | undefined;

      const quiescencePromise = waitForScrollQuiescence(document, window, {
        quietMs: 600,
        maxWaitMs: 2500,
        pollIntervalMs: 100,
      }).then((res) => {
        resolved = res;
        return res;
      });

      // At 250ms, a late XHR resource arrives -> resets quiet timer
      await vi.advanceTimersByTimeAsync(250);
      expect(resolved).toBeUndefined();
      pushEntry({ name: 'https://example.com/api/lazy-chunk.json', initiatorType: 'fetch' });

      // At 550ms, a late DOM node is appended -> resets quiet timer again
      await vi.advanceTimersByTimeAsync(300);
      expect(resolved).toBeUndefined();
      const lazyBlock = document.createElement('section');
      document.body.appendChild(lazyBlock);
      await vi.advanceTimersByTimeAsync(50);

      // 400ms after DOM append (at 1000ms), should still be waiting for 600ms quiet window
      await vi.advanceTimersByTimeAsync(350);
      expect(resolved).toBeUndefined();

      // After full 600ms quiet window without new activity, settles cleanly
      await vi.advanceTimersByTimeAsync(350);
      const finalRes = await quiescencePromise;

      expect(finalRes.timedOut).toBe(false);
      expect(finalRes.newResourceCount).toBe(1);
      expect(finalRes.tailAppendedNodes).toBe(1);
    });

    it('waitForScrollQuiescence caps waiting at maxWaitMs and reports timedOut: true under continuous churn', async () => {
      const { pushEntry } = installResourceList();

      const interval = setInterval(() => {
        pushEntry({ name: 'https://example.com/api/poll', initiatorType: 'fetch' });
      }, 200);

      const quiescencePromise = waitForScrollQuiescence(document, window, {
        quietMs: 600,
        maxWaitMs: 1500,
        pollIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(1600);
      clearInterval(interval);

      const res = await quiescencePromise;
      expect(res.timedOut).toBe(true);
      expect(res.newResourceCount).toBeGreaterThanOrEqual(5);
    });

    it('measureAndScrollPage waits for post-scroll late resources and DOM growth during quiescence before returning', async () => {
      let docHeight = 1600;
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'scrollHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.body, 'offsetHeight', {
        get: () => docHeight,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, 'clientHeight', {
        value: 800,
        configurable: true,
      });

      const { pushEntry } = installResourceList();
      let lateScheduled = false;
      installScrollableWindow({
        onScrollTo: (y) => {
          if (!lateScheduled && y >= 600) {
            lateScheduled = true;
            // Simulate a late lazy fetch + image/section expansion arriving 300ms after reaching bottom
            setTimeout(() => {
              pushEntry({
                name: 'https://example.com/api/feed?page=2',
                initiatorType: 'fetch',
              });
              const extra = document.createElement('div');
              document.body.appendChild(extra);
              docHeight = 2200;
            }, 300);
          }
        },
      });

      const promise = measureAndScrollPage(document, window, {
        stepFraction: 0.75,
        stepDurationMs: 100,
        foldPauseMs: 50,
        quiescenceQuietMs: 400,
        quiescenceMaxWaitMs: 1500,
        scrollBackDurationMs: 50,
      });

      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;

      expect(result.quiescenceTimedOut).toBe(false);
      expect(result.initialHeight).toBe(1600);
      expect(result.finalHeight).toBe(2200);
      expect(result.scrollSignals).toContain('single-height-expansion:+600px');
    });
  });
});
