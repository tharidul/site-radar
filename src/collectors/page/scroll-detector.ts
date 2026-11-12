import { categorizeResource } from './resource-aggregator';

export type LayoutScrollType =
  | 'fixed-height'
  | 'app-shell'
  | 'finite'
  | 'long-page'
  | 'infinite-feed';

export type ScrollConfidence = 'high' | 'medium' | 'low';

export interface ScrollTargetDetection {
  layoutMode: 'fixed-height' | 'app-shell' | 'document';
  isFixedHeight: boolean;
  scrollContainer: HTMLElement | null;
  viewportHeight: number;
  initialScrollHeight: number;
  maxScrollTop: number;
  signals: string[];
}

export interface FeedDomSignals {
  hasRoleFeed: boolean;
  homogeneousCardClusterCount: number;
  hasVirtualizationHints: boolean;
  hasVerticalScrollSnap: boolean;
}

export interface FiniteCounterSignals {
  hasPagination: boolean;
  hasReachableFooter: boolean;
}

export interface ScrollObservation {
  target: ScrollTargetDetection;
  initialHeight: number;
  finalHeight: number;
  viewportHeight: number;
  stepsExecuted: number;
  reachedBottom: boolean;
  clampedEarly: boolean;
  growthWaves: number;
  totalGrowthPx: number;
  tailAppendWaves: number;
  tailAppendedNodes: number;
  newFetchXhrCount: number;
  feedLikeRequestCount: number;
  requestWaves: number;
  feedDom: FeedDomSignals;
  finiteSignals: FiniteCounterSignals;
  quiescenceTimedOut: boolean;
}

export interface ScrollClassification {
  layoutScrollType: LayoutScrollType;
  isFixedHeight: boolean;
  isInfiniteScroll: boolean;
  scrollConfidence: ScrollConfidence;
  scrollSignals: string[];
}

export interface ScrollMeasureOptions {
  stepFraction?: number;
  stepDurationMs?: number;
  foldPauseMs?: number;
  maxSteps?: number;
  maxDurationMs?: number;
  quiescenceQuietMs?: number;
  quiescenceMaxWaitMs?: number;
  scrollBackDurationMs?: number;
}

export interface ScrollMeasureResult extends ScrollClassification {
  stepsExecuted: number;
  reachedBottom: boolean;
  clampedEarly: boolean;
  initialHeight: number;
  finalHeight: number;
  quiescenceTimedOut: boolean;
}

const DEFAULT_STEP_FRACTION = 0.75;
const DEFAULT_STEP_DURATION_MS = 400;
const DEFAULT_FOLD_PAUSE_MS = 400;
const DEFAULT_MAX_STEPS = 10;
const DEFAULT_MAX_DURATION_MS = 12_000;
const DEFAULT_QUIESCENCE_QUIET_MS = 600;
const DEFAULT_QUIESCENCE_MAX_WAIT_MS = 2_500;
const SCROLL_OVERFLOW_TOLERANCE_PX = 20;
const APP_SHELL_MIN_VIEWPORT_RATIO = 0.35;
const LONG_PAGE_VIEWPORT_MULTIPLIER = 4;

const FEED_URL_PATTERN =
  /([?&](page|p|cursor|after|before|offset|skip|from|next|limit|count|load_?more|since_id|max_id)=|\/(api|graphql|v\d+)\/.*(feed|timeline|posts|items|articles|comments|list|scroll|more|stream)|\/(feed|timeline|load-?more|infinite-scroll))/i;

const IGNORED_MUTATION_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR']);

function safeGetComputedStyle(win: Window, el: Element | null): CSSStyleDeclaration | null {
  if (!el || typeof win.getComputedStyle !== 'function') return null;
  try {
    return win.getComputedStyle(el);
  } catch {
    return null;
  }
}

function getEffectiveOverflowY(style: CSSStyleDeclaration | null, el?: Element | null): string {
  const inlineStyle = (el as HTMLElement | null | undefined)?.style;
  const oy = (style?.overflowY || inlineStyle?.overflowY || '').trim().toLowerCase();
  if (oy) return oy;
  const o = (style?.overflow || inlineStyle?.overflow || '').trim().toLowerCase();
  if (!o) return '';
  const parts = o.split(/\s+/);
  return (parts.length >= 2 ? parts[1] : parts[0]) ?? '';
}

function isOverflowLocked(overflowVal: string): boolean {
  return overflowVal === 'hidden' || overflowVal === 'clip';
}

function isOverflowScrollable(overflowVal: string): boolean {
  return overflowVal === 'auto' || overflowVal === 'scroll' || overflowVal === 'overlay';
}

function isElementHidden(style: CSSStyleDeclaration | null, el?: Element | null): boolean {
  const inlineStyle = (el as HTMLElement | null | undefined)?.style;
  const display = (style?.display || inlineStyle?.display || '').trim().toLowerCase();
  const visibility = (style?.visibility || inlineStyle?.visibility || '').trim().toLowerCase();
  return display === 'none' || visibility === 'hidden';
}

function getPerformance(win: Window): Performance | undefined {
  return win.performance || (typeof performance !== 'undefined' ? performance : undefined);
}

function getResourceEntries(win: Window): PerformanceResourceTiming[] {
  const perf = getPerformance(win);
  if (!perf || typeof perf.getEntriesByType !== 'function') return [];
  try {
    return (perf.getEntriesByType('resource') || []) as PerformanceResourceTiming[];
  } catch {
    return [];
  }
}

function isFetchOrXhrEntry(entry: PerformanceResourceTiming): boolean {
  const init = (entry.initiatorType || '').toLowerCase();
  if (init === 'fetch' || init === 'xmlhttprequest') return true;
  return categorizeResource(entry) === 'fetch/xhr';
}

/**
 * Checks whether a resource URL matches common pagination, cursor, or infinite-feed API patterns.
 */
export function isFeedLikeResourceUrl(url: string): boolean {
  if (!url) return false;
  return FEED_URL_PATTERN.test(url);
}

function getRootScrollHeight(doc: Document, viewportHeight: number): number {
  const docEl = doc.documentElement;
  const body = doc.body;
  return Math.max(
    body ? body.scrollHeight || 0 : 0,
    body ? body.offsetHeight || 0 : 0,
    docEl ? docEl.clientHeight || 0 : 0,
    docEl ? docEl.scrollHeight || 0 : 0,
    docEl ? docEl.offsetHeight || 0 : 0,
    viewportHeight,
  );
}

function findAppShellContainer(
  doc: Document,
  win: Window,
  viewportHeight: number,
  docElLocked: boolean,
): HTMLElement | null {
  const minClientHeight = Math.round(viewportHeight * APP_SHELL_MIN_VIEWPORT_RATIO);
  const candidates: HTMLElement[] = [];

  if (docElLocked && doc.body) {
    candidates.push(doc.body);
  }

  const queried = doc.querySelectorAll('main, [role="main"], #app, #root, #__next, section, div, article');
  const limit = Math.min(queried.length, 400);
  for (let i = 0; i < limit; i++) {
    const el = queried[i];
    if (el && el.nodeType === 1) {
      candidates.push(el as HTMLElement);
    }
  }

  let bestEl: HTMLElement | null = null;
  let bestScore = -1;

  for (const el of candidates) {
    const style = safeGetComputedStyle(win, el);
    if (isElementHidden(style, el)) continue;

    const overflowY = getEffectiveOverflowY(style, el);
    if (!isOverflowScrollable(overflowY)) continue;

    const clientHeight = el.clientHeight || 0;
    const scrollHeight = el.scrollHeight || 0;
    if (clientHeight < minClientHeight) continue;
    if (scrollHeight <= clientHeight + SCROLL_OVERFLOW_TOLERANCE_PX) continue;

    const tag = el.tagName?.toUpperCase() || '';
    const isMain = tag === 'MAIN' || el.getAttribute('role') === 'main';
    const scrollRoom = scrollHeight - clientHeight;
    const score = clientHeight * 10 + Math.min(scrollRoom, viewportHeight * 10) + (isMain ? 5000 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  return bestEl;
}

/**
 * Inspects documentElement, body, and potential inner scroll containers to determine
 * whether the page is fixed-height (non-scrollable), an app-shell with an inner scroll
 * container, or a normal scrollable document.
 */
export function detectScrollTarget(doc: Document, win: Window): ScrollTargetDetection {
  const docEl = doc.documentElement;
  const body = doc.body;
  const viewportHeight = win.innerHeight || docEl?.clientHeight || 800;

  const docElStyle = safeGetComputedStyle(win, docEl);
  const bodyStyle = safeGetComputedStyle(win, body);

  const docElOverflowY = getEffectiveOverflowY(docElStyle, docEl);
  const bodyOverflowY = getEffectiveOverflowY(bodyStyle, body);

  const docElLocked = isOverflowLocked(docElOverflowY);
  const bodyLocked = isOverflowLocked(bodyOverflowY);
  const bodyPosition = (bodyStyle?.position || body?.style?.position || '').trim().toLowerCase();
  const bodyFixed = bodyPosition === 'fixed';

  // In CSS, body overflow propagates to the viewport when html has visible/empty overflow
  const viewportLockedByBody = !docElLocked && bodyLocked && !isOverflowScrollable(docElOverflowY);
  const rootStyleLocked = docElLocked || viewportLockedByBody || bodyFixed;

  const rootScrollHeight = getRootScrollHeight(doc, viewportHeight);
  const hasRootOverflow = rootScrollHeight > viewportHeight + SCROLL_OVERFLOW_TOLERANCE_PX;

  const documentCanScroll = !rootStyleLocked && hasRootOverflow;
  if (documentCanScroll) {
    return {
      layoutMode: 'document',
      isFixedHeight: false,
      scrollContainer: null,
      viewportHeight,
      initialScrollHeight: rootScrollHeight,
      maxScrollTop: Math.max(0, rootScrollHeight - viewportHeight),
      signals: [],
    };
  }

  const signals: string[] = [];
  if (docElLocked) signals.push('html-overflow-locked');
  if (bodyLocked) signals.push('body-overflow-locked');
  if (bodyFixed) signals.push('body-position-fixed');
  if (!hasRootOverflow) signals.push('no-document-overflow');

  const appShell = findAppShellContainer(doc, win, viewportHeight, docElLocked);
  if (appShell) {
    const containerScrollHeight = appShell.scrollHeight || 0;
    const containerClientHeight = appShell.clientHeight || viewportHeight;
    return {
      layoutMode: 'app-shell',
      isFixedHeight: false,
      scrollContainer: appShell,
      viewportHeight: containerClientHeight,
      initialScrollHeight: containerScrollHeight,
      maxScrollTop: Math.max(0, containerScrollHeight - containerClientHeight),
      signals: ['app-shell-container', ...signals],
    };
  }

  return {
    layoutMode: 'fixed-height',
    isFixedHeight: true,
    scrollContainer: null,
    viewportHeight,
    initialScrollHeight: rootScrollHeight,
    maxScrollTop: 0,
    signals: signals.length > 0 ? signals : ['fixed-height-viewport'],
  };
}

function getHomogeneousClusterMaxCount(root: Element): number {
  const containers = root.querySelectorAll('main, [role="feed"], section, ul, ol, div');
  const limit = Math.min(containers.length, 250);
  let maxCluster = 0;

  for (let i = 0; i < limit; i++) {
    const container = containers[i];
    if (!container) continue;
    const containerTag = container.tagName?.toUpperCase() || '';
    if (
      containerTag === 'NAV' ||
      containerTag === 'HEADER' ||
      containerTag === 'FOOTER' ||
      containerTag === 'TBODY' ||
      containerTag === 'THEAD'
    ) {
      continue;
    }
    if (container.closest('nav, header, footer, table')) continue;

    const children = container.children;
    if (!children || children.length < 6) continue;

    const tagCounts = new Map<string, number>();
    const classCounts = new Map<string, number>();
    const childLimit = Math.min(children.length, 100);

    for (let j = 0; j < childLimit; j++) {
      const child = children[j];
      if (!child) continue;
      const tag = child.tagName?.toUpperCase() || '';
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') continue;

      const isCardLikeTag = tag === 'ARTICLE' || tag === 'LI' || child.getAttribute('role') === 'article';
      if (isCardLikeTag) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      const firstClass = typeof child.className === 'string'
        ? child.className.trim().split(/\s+/)[0]
        : '';
      if (firstClass) {
        const key = `${tag}.${firstClass}`;
        classCounts.set(key, (classCounts.get(key) || 0) + 1);
      }
    }

    for (const count of tagCounts.values()) {
      if (count > maxCluster) maxCluster = count;
    }
    for (const count of classCounts.values()) {
      if (count > maxCluster) maxCluster = count;
    }
  }

  return maxCluster;
}

function detectVirtualizationHints(doc: Document, win: Window, root: Element): boolean {
  if (
    root.querySelector(
      '[data-index], [data-item-index], [data-virtual-index], [data-virtuoso-item], [data-known-size]',
    )
  ) {
    return true;
  }

  // Check for synthetic tall spacer container with absolute / translateY positioned children
  const containers = root.querySelectorAll('div, ul, section');
  const limit = Math.min(containers.length, 150);
  for (let i = 0; i < limit; i++) {
    const el = containers[i] as HTMLElement;
    if (!el || el.children.length < 3) continue;

    const style = safeGetComputedStyle(win, el);
    const heightStr = style?.height || el.style?.height || '';
    const minHeightStr = style?.minHeight || el.style?.minHeight || '';
    const parsedHeight = parseFloat(heightStr) || parseFloat(minHeightStr) || 0;
    if (parsedHeight < 1500) continue;

    let virtualChildren = 0;
    const childCheckLimit = Math.min(el.children.length, 20);
    for (let j = 0; j < childCheckLimit; j++) {
      const child = el.children[j] as HTMLElement;
      const childStyle = safeGetComputedStyle(win, child);
      const pos = (childStyle?.position || child.style?.position || '').toLowerCase();
      const transform = (childStyle?.transform || child.style?.transform || '').toLowerCase();
      if (pos === 'absolute' && (transform.includes('translatey') || transform.includes('translate3d') || (child.style?.top && child.style.top !== '0px'))) {
        virtualChildren++;
      }
    }
    if (virtualChildren >= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Inspects DOM and CSS signals associated with infinite feeds and virtualized lists.
 */
export function detectFeedDomSignals(
  doc: Document,
  win: Window,
  scrollContainer?: HTMLElement | null,
): FeedDomSignals {
  const root: Element | null = scrollContainer || doc.body || doc.documentElement;
  if (!root) {
    return {
      hasRoleFeed: false,
      homogeneousCardClusterCount: 0,
      hasVirtualizationHints: false,
      hasVerticalScrollSnap: false,
    };
  }

  const hasRoleFeed = Boolean(root.querySelector('[role="feed"]'));
  const homogeneousCardClusterCount = getHomogeneousClusterMaxCount(root);
  const hasVirtualizationHints = detectVirtualizationHints(doc, win, root);

  const snapTargets = [scrollContainer, doc.documentElement, doc.body].filter(Boolean) as Element[];
  let hasVerticalScrollSnap = false;
  for (const target of snapTargets) {
    const style = safeGetComputedStyle(win, target);
    const snapType = (
      style?.scrollSnapType ||
      (target as HTMLElement).style?.scrollSnapType ||
      ''
    ).toLowerCase();
    if (/\b(y|both|block)\b/.test(snapType) && /\b(mandatory|proximity)\b/.test(snapType)) {
      hasVerticalScrollSnap = true;
      break;
    }
  }

  return {
    hasRoleFeed,
    homogeneousCardClusterCount,
    hasVirtualizationHints,
    hasVerticalScrollSnap,
  };
}

/**
 * Inspects finite-page counter-signals (pagination links/controls and reachable bottom footers).
 */
export function detectFiniteCounterSignals(
  doc: Document,
  win: Window,
  scrollContainer?: HTMLElement | null,
  finalHeight = 0,
  viewportHeight = 800,
): FiniteCounterSignals {
  const hasPagination = Boolean(
    doc.querySelector(
      'a[rel~="next"], link[rel~="next"], .pagination, [role="navigation"][aria-label*="pagination" i], [aria-label*="pagination" i], nav[aria-label*="page" i], .pager',
    ),
  );

  const scope: ParentNode = scrollContainer || doc.body || doc;
  const footers = scope.querySelectorAll('footer, [role="contentinfo"]');
  let hasReachableFooter = false;

  const currentScrollTop = scrollContainer ? scrollContainer.scrollTop || 0 : win.scrollY || 0;
  for (let i = 0; i < footers.length; i++) {
    const footer = footers[i] as HTMLElement;
    const style = safeGetComputedStyle(win, footer);
    if (isElementHidden(style, footer)) continue;

    if (typeof footer.getBoundingClientRect === 'function') {
      const rect = footer.getBoundingClientRect();
      const hasGeometry = rect.width > 0 || rect.height > 0 || rect.top !== 0 || rect.bottom !== 0;
      if (!hasGeometry) {
        // Unlaid-out DOM test environment (e.g. happy-dom without layout geometry)
        hasReachableFooter = true;
        break;
      }

      let docBottom = rect.bottom + currentScrollTop;
      if (scrollContainer && typeof scrollContainer.getBoundingClientRect === 'function') {
        const containerRect = scrollContainer.getBoundingClientRect();
        docBottom = rect.bottom - containerRect.top + currentScrollTop;
      }

      if (finalHeight <= 0 || docBottom >= finalHeight - viewportHeight * 1.75) {
        hasReachableFooter = true;
        break;
      }
    } else {
      hasReachableFooter = true;
      break;
    }
  }

  return {
    hasPagination,
    hasReachableFooter,
  };
}

/**
 * Multi-signal classifier distinguishing fixed-height viewports, app-shells,
 * finite pages, long finite pages, and genuine infinite-scroll feeds.
 */
export function classifyScrollBehavior(observation: ScrollObservation): ScrollClassification {
  const { target, finalHeight, viewportHeight } = observation;

  if (target.isFixedHeight || target.layoutMode === 'fixed-height') {
    return {
      layoutScrollType: 'fixed-height',
      isFixedHeight: true,
      isInfiniteScroll: false,
      scrollConfidence: 'high',
      scrollSignals: [...target.signals],
    };
  }

  const signals: string[] = [...target.signals];
  let infiniteScore = 0;

  // Dynamic height growth waves across distinct scroll steps
  if (observation.growthWaves >= 3) {
    infiniteScore += 4;
    signals.push(`repeated-growth-waves:${observation.growthWaves}`);
  } else if (observation.growthWaves === 2) {
    infiniteScore += 3;
    signals.push(`repeated-growth-waves:${observation.growthWaves}`);
  } else if (observation.growthWaves === 1 && observation.totalGrowthPx > 0) {
    signals.push(`single-height-expansion:+${Math.round(observation.totalGrowthPx)}px`);
  }

  // Tail DOM node appends observed via MutationObserver
  if (observation.tailAppendWaves >= 2) {
    infiniteScore += 2;
    signals.push(`tail-dom-appends:${observation.tailAppendedNodes}-across-${observation.tailAppendWaves}-steps`);
  } else if (observation.tailAppendWaves === 1 && observation.tailAppendedNodes >= 2) {
    infiniteScore += 1;
    signals.push(`tail-dom-appends:${observation.tailAppendedNodes}`);
  }

  // Scroll-triggered fetch/XHR activity
  const hasMultipleReqWaves = observation.requestWaves >= 2;
  const hasMultipleFeedReqs = observation.feedLikeRequestCount >= 2;
  if (hasMultipleReqWaves && hasMultipleFeedReqs) {
    infiniteScore += 3;
    signals.push(`scroll-fetch-waves:${observation.newFetchXhrCount}-reqs(${observation.requestWaves}-waves)`);
  } else if (hasMultipleReqWaves || hasMultipleFeedReqs) {
    infiniteScore += 2;
    signals.push(`scroll-fetch-waves:${observation.newFetchXhrCount}-reqs(${observation.requestWaves}-waves)`);
  } else if (observation.feedLikeRequestCount === 1) {
    infiniteScore += 1;
    signals.push('feed-pattern-xhr:1');
  }

  // Feed DOM & CSS signals
  if (observation.feedDom.hasRoleFeed) {
    infiniteScore += 2;
    signals.push('dom-role-feed');
  }
  if (observation.feedDom.hasVirtualizationHints) {
    infiniteScore += 2;
    signals.push('virtualized-list-hints');
  }
  if (observation.feedDom.hasVerticalScrollSnap) {
    infiniteScore += 2;
    signals.push('vertical-scroll-snap-feed');
  }
  if (observation.feedDom.homogeneousCardClusterCount >= 6) {
    infiniteScore += 1;
    signals.push(`repeated-card-cluster:${observation.feedDom.homogeneousCardClusterCount}`);
  }

  // Finite counter-signals
  if (observation.finiteSignals.hasPagination) {
    infiniteScore -= 2;
    signals.push('pagination-controls-present');
  }
  if (observation.finiteSignals.hasReachableFooter) {
    if (observation.growthWaves < 2) {
      infiniteScore -= 2;
      signals.push('stable-footer-reachable');
    } else {
      signals.push('footer-present');
    }
  }
  if (
    observation.reachedBottom &&
    observation.growthWaves === 0 &&
    observation.tailAppendWaves === 0 &&
    !observation.feedDom.hasVirtualizationHints
  ) {
    infiniteScore -= 1;
    signals.push('reached-static-bottom');
  }

  if (observation.clampedEarly) {
    signals.push('scroll-clamped-early');
  }
  if (observation.quiescenceTimedOut) {
    signals.push('quiescence-capped');
  }

  const isInfiniteScroll = infiniteScore >= 4;

  let layoutScrollType: LayoutScrollType;
  if (isInfiniteScroll) {
    layoutScrollType = 'infinite-feed';
  } else if (target.layoutMode === 'app-shell') {
    layoutScrollType = 'app-shell';
    if (finalHeight >= viewportHeight * LONG_PAGE_VIEWPORT_MULTIPLIER) {
      signals.push('long-scroll-container');
    }
  } else if (finalHeight >= viewportHeight * LONG_PAGE_VIEWPORT_MULTIPLIER) {
    layoutScrollType = 'long-page';
    signals.push(`tall-page:${(finalHeight / Math.max(1, viewportHeight)).toFixed(1)}x-viewport`);
  } else {
    layoutScrollType = 'finite';
  }

  let scrollConfidence: ScrollConfidence;
  if (isInfiniteScroll) {
    scrollConfidence = infiniteScore >= 6 ? 'high' : 'medium';
  } else if (observation.clampedEarly) {
    scrollConfidence =
      observation.finiteSignals.hasPagination || observation.finiteSignals.hasReachableFooter
        ? 'medium'
        : 'low';
  } else if (infiniteScore >= 2) {
    scrollConfidence = 'low';
  } else if (
    observation.finiteSignals.hasPagination ||
    observation.finiteSignals.hasReachableFooter ||
    observation.reachedBottom ||
    target.layoutMode === 'app-shell'
  ) {
    scrollConfidence = 'high';
  } else {
    scrollConfidence = 'medium';
  }

  return {
    layoutScrollType,
    isFixedHeight: false,
    isInfiniteScroll,
    scrollConfidence,
    scrollSignals: signals,
  };
}

function getScrollTop(container: HTMLElement | null, win: Window): number {
  return container ? container.scrollTop || 0 : win.scrollY || 0;
}

function getScrollLeft(container: HTMLElement | null, win: Window): number {
  return container ? container.scrollLeft || 0 : win.scrollX || 0;
}

function getScrollHeight(
  container: HTMLElement | null,
  doc: Document,
  viewportHeight: number,
): number {
  if (container) {
    return container.scrollHeight || viewportHeight;
  }
  return getRootScrollHeight(doc, viewportHeight);
}

function scrollTargetImmediate(
  container: HTMLElement | null,
  win: Window,
  top: number,
  left: number,
): void {
  if (container) {
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ left, top, behavior: 'instant' as ScrollBehavior });
    } else {
      container.scrollTop = top;
      container.scrollLeft = left;
    }
    return;
  }

  if (typeof win.scrollTo === 'function') {
    win.scrollTo({ left, top, behavior: 'instant' as ScrollBehavior });
  }
}

function smoothScrollTargetTo(
  container: HTMLElement | null,
  win: Window,
  targetTop: number,
  targetLeft: number,
  durationMs: number,
): Promise<void> {
  const startTop = getScrollTop(container, win);
  const startLeft = getScrollLeft(container, win);
  const deltaTop = targetTop - startTop;
  const deltaLeft = targetLeft - startLeft;

  if ((Math.abs(deltaTop) < 3 && Math.abs(deltaLeft) < 3) || durationMs <= 0) {
    scrollTargetImmediate(container, win, targetTop, targetLeft);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let firstFrameTime: number | null = null;
    let completed = false;
    let rafId: number | undefined;

    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(safetyTimer);
      if (rafId !== undefined && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(rafId);
      }
      scrollTargetImmediate(container, win, targetTop, targetLeft);
      resolve();
    };

    const safetyTimer = setTimeout(finish, durationMs + 400);

    if (typeof win.requestAnimationFrame !== 'function') {
      setTimeout(finish, durationMs);
      return;
    }

    const step = (currentTime: number) => {
      if (completed) return;
      if (firstFrameTime === null) {
        firstFrameTime = currentTime;
      }
      const elapsed = Math.max(0, currentTime - firstFrameTime);
      const progress = Math.min(1, elapsed / durationMs);
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      scrollTargetImmediate(
        container,
        win,
        startTop + deltaTop * ease,
        startLeft + deltaLeft * ease,
      );

      if (progress < 1) {
        rafId = win.requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    rafId = win.requestAnimationFrame(step);
  });
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTailContentElement(
  el: Element,
  scrollContainer: HTMLElement | null,
  currentScrollTop: number,
  currentHeight: number,
  viewportHeight: number,
): boolean {
  const tag = el.tagName?.toUpperCase() || '';
  if (IGNORED_MUTATION_TAGS.has(tag)) return false;
  if (el.closest('header, nav, [role="dialog"], [role="tooltip"], [role="alert"]')) {
    return false;
  }

  if (typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect();
    const hasGeometry = rect.width > 0 || rect.height > 0 || rect.top !== 0 || rect.bottom !== 0;
    if (hasGeometry) {
      let relativeTop = rect.top + currentScrollTop;
      if (scrollContainer && typeof scrollContainer.getBoundingClientRect === 'function') {
        const containerRect = scrollContainer.getBoundingClientRect();
        relativeTop = rect.top - containerRect.top + currentScrollTop;
      }
      return (
        relativeTop >= currentHeight * 0.45 ||
        relativeTop >= currentScrollTop + viewportHeight * 0.35
      );
    }
  }

  return true;
}

function countAddedContentNodes(
  mutations: MutationRecord[],
  scrollContainer: HTMLElement | null,
  currentScrollTop: number,
  currentHeight: number,
  viewportHeight: number,
): number {
  let count = 0;
  for (const m of mutations) {
    if (m.type !== 'childList' || !m.addedNodes) continue;
    for (let i = 0; i < m.addedNodes.length; i++) {
      const node = m.addedNodes[i];
      if (!node || node.nodeType !== 1) continue;
      if (
        isTailContentElement(
          node as Element,
          scrollContainer,
          currentScrollTop,
          currentHeight,
          viewportHeight,
        )
      ) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Waits for both new PerformanceResourceTiming entries and DOM childList mutations
 * to settle for `quietMs` (default 600ms), capped at `maxWaitMs` (default 2500ms).
 */
export function waitForScrollQuiescence(
  doc: Document,
  win: Window,
  options?: { quietMs?: number; maxWaitMs?: number; pollIntervalMs?: number },
): Promise<{ timedOut: boolean; newResourceCount: number; tailAppendedNodes: number }> {
  const quietMs = options?.quietMs ?? DEFAULT_QUIESCENCE_QUIET_MS;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_QUIESCENCE_MAX_WAIT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? 100;

  if (quietMs <= 0 || maxWaitMs <= 0) {
    return Promise.resolve({ timedOut: false, newResourceCount: 0, tailAppendedNodes: 0 });
  }

  const initialResCount = getResourceEntries(win).length;
  let lastResCount = initialResCount;
  let tailAppendedNodes = 0;
  let lastActivityAt = Date.now();
  const startedAt = lastActivityAt;

  return new Promise((resolve) => {
    let settled = false;
    let observer: MutationObserver | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pollTimer !== undefined) clearInterval(pollTimer);
      if (maxTimer !== undefined) clearTimeout(maxTimer);
    };

    const done = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        timedOut,
        newResourceCount: Math.max(0, lastResCount - initialResCount),
        tailAppendedNodes,
      });
    };

    const ObserverCtor =
      (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver ||
      (typeof MutationObserver !== 'undefined' ? MutationObserver : undefined);

    const observeTarget = doc.body || doc.documentElement;
    if (ObserverCtor && observeTarget) {
      try {
        observer = new ObserverCtor((mutations) => {
          let addedElements = 0;
          for (const m of mutations) {
            if (m.type !== 'childList' || !m.addedNodes) continue;
            for (let i = 0; i < m.addedNodes.length; i++) {
              const node = m.addedNodes[i];
              if (node && node.nodeType === 1) {
                const tag = (node as Element).tagName?.toUpperCase() || '';
                if (!IGNORED_MUTATION_TAGS.has(tag)) {
                  addedElements++;
                }
              }
            }
          }
          if (addedElements > 0) {
            tailAppendedNodes += addedElements;
            lastActivityAt = Date.now();
          }
        });
        observer.observe(observeTarget, { childList: true, subtree: true });
      } catch {
        observer = null;
      }
    }

    maxTimer = setTimeout(() => done(true), maxWaitMs);

    pollTimer = setInterval(() => {
      const now = Date.now();
      const currentResCount = getResourceEntries(win).length;
      if (currentResCount !== lastResCount) {
        lastResCount = currentResCount;
        lastActivityAt = now;
      }
      if (now - lastActivityAt >= quietMs) {
        done(false);
      } else if (now - startedAt >= maxWaitMs) {
        done(true);
      }
    }, pollIntervalMs);
  });
}

/**
 * Performs safe, paced viewport-by-viewport scrolling (skipping fixed-height pages
 * and targeting inner app-shell scroll containers when root overflow is locked),
 * waits for network/DOM quiescence, restores scroll position, and returns
 * multi-signal layout & scroll classification.
 */
export async function measureAndScrollPage(
  doc: Document,
  win: Window,
  options?: ScrollMeasureOptions,
): Promise<ScrollMeasureResult> {
  const stepFraction = options?.stepFraction ?? DEFAULT_STEP_FRACTION;
  const stepDurationMs = options?.stepDurationMs ?? DEFAULT_STEP_DURATION_MS;
  const foldPauseMs = options?.foldPauseMs ?? DEFAULT_FOLD_PAUSE_MS;
  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxDurationMs = options?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const quiescenceQuietMs = options?.quiescenceQuietMs ?? DEFAULT_QUIESCENCE_QUIET_MS;
  const quiescenceMaxWaitMs = options?.quiescenceMaxWaitMs ?? DEFAULT_QUIESCENCE_MAX_WAIT_MS;

  const target = detectScrollTarget(doc, win);
  if (target.isFixedHeight) {
    const classification = classifyScrollBehavior({
      target,
      initialHeight: target.initialScrollHeight,
      finalHeight: target.initialScrollHeight,
      viewportHeight: target.viewportHeight,
      stepsExecuted: 0,
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
    });

    return {
      ...classification,
      stepsExecuted: 0,
      reachedBottom: true,
      clampedEarly: false,
      initialHeight: target.initialScrollHeight,
      finalHeight: target.initialScrollHeight,
      quiescenceTimedOut: false,
    };
  }

  const container = target.scrollContainer;
  const origTop = getScrollTop(container, win);
  const origLeft = getScrollLeft(container, win);
  const initialHeight = target.initialScrollHeight;

  const baselineResourceCount = getResourceEntries(win).length;
  let stepsExecuted = 0;
  let reachedBottom = false;
  let clampedEarly = false;
  let growthWaves = 0;
  let totalGrowthPx = 0;
  let tailAppendWaves = 0;
  let tailAppendedNodes = 0;
  let requestWaves = 0;
  let stepTailAppends = 0;

  let activeStepHeight = initialHeight;
  let activeStepTop = origTop;

  const ObserverCtor =
    (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver ||
    (typeof MutationObserver !== 'undefined' ? MutationObserver : undefined);
  let stepObserver: MutationObserver | null = null;
  const observeTarget = container || doc.body || doc.documentElement;

  if (ObserverCtor && observeTarget) {
    try {
      stepObserver = new ObserverCtor((mutations) => {
        stepTailAppends += countAddedContentNodes(
          mutations,
          container,
          activeStepTop,
          activeStepHeight,
          target.viewportHeight,
        );
      });
      stepObserver.observe(observeTarget, { childList: true, subtree: true });
    } catch {
      stepObserver = null;
    }
  }

  const scrollStartAt = Date.now();
  let lastKnownHeight = initialHeight;
  let quiescenceTimedOut = false;
  let quiescenceTailNodes = 0;
  let feedDom: FeedDomSignals;
  let finiteSignals: FiniteCounterSignals;
  let finalHeight = initialHeight;

  try {
    for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
      if (Date.now() - scrollStartAt >= maxDurationMs) {
        break;
      }

      const posBefore = getScrollTop(container, win);
      const heightBefore = getScrollHeight(container, doc, target.viewportHeight);
      const clientHeight = container ? container.clientHeight || target.viewportHeight : target.viewportHeight;
      const currentMaxTop = Math.max(0, heightBefore - clientHeight);

      if (posBefore >= currentMaxTop - 5) {
        reachedBottom = true;
        break;
      }

      const stepPx = Math.max(100, Math.round(clientHeight * stepFraction));
      const nextTarget = Math.min(currentMaxTop, posBefore + stepPx);
      const expectedDelta = nextTarget - posBefore;
      if (expectedDelta <= 5) {
        reachedBottom = true;
        break;
      }

      activeStepHeight = heightBefore;
      activeStepTop = posBefore;
      stepTailAppends = 0;
      const stepResStart = getResourceEntries(win).length;

      await smoothScrollTargetTo(container, win, nextTarget, origLeft, stepDurationMs);
      await delay(foldPauseMs);

      stepsExecuted++;
      const posAfter = getScrollTop(container, win);
      const actualDelta = posAfter - posBefore;

      if (expectedDelta > 20 && actualDelta < Math.min(10, expectedDelta * 0.15)) {
        clampedEarly = true;
        break;
      }

      const heightAfter = getScrollHeight(container, doc, target.viewportHeight);
      lastKnownHeight = heightAfter;

      const growthPx = heightAfter - heightBefore;
      const minGrowthThreshold = Math.max(80, Math.round(clientHeight * 0.15));
      const isNearBottom = posAfter + clientHeight >= heightBefore - clientHeight * 1.25;

      if (growthPx >= minGrowthThreshold && (isNearBottom || stepTailAppends > 0)) {
        growthWaves++;
        totalGrowthPx += growthPx;
      }

      if (stepTailAppends > 0) {
        tailAppendWaves++;
        tailAppendedNodes += stepTailAppends;
      }

      const resourcesNow = getResourceEntries(win);
      let stepFetchXhr = 0;
      for (let r = stepResStart; r < resourcesNow.length; r++) {
        const entry = resourcesNow[r];
        if (entry && isFetchOrXhrEntry(entry)) {
          stepFetchXhr++;
        }
      }
      if (stepFetchXhr > 0) {
        requestWaves++;
      }

      const updatedMaxTop = Math.max(0, heightAfter - clientHeight);
      if (posAfter >= updatedMaxTop - 5 && growthPx < 20) {
        reachedBottom = true;
        break;
      }
    }
  } finally {
    if (stepObserver) {
      stepObserver.disconnect();
      stepObserver = null;
    }
  }

  const quiescence = await waitForScrollQuiescence(doc, win, {
    quietMs: quiescenceQuietMs,
    maxWaitMs: quiescenceMaxWaitMs,
  });
  quiescenceTimedOut = quiescence.timedOut;
  quiescenceTailNodes = quiescence.tailAppendedNodes;

  finalHeight = getScrollHeight(container, doc, target.viewportHeight);
  const minPostGrowth = Math.max(80, Math.round(target.viewportHeight * 0.15));
  if (finalHeight - lastKnownHeight >= minPostGrowth) {
    growthWaves++;
    totalGrowthPx += finalHeight - lastKnownHeight;
  }
  if (quiescenceTailNodes > 0) {
    tailAppendedNodes += quiescenceTailNodes;
    if (tailAppendWaves === 0) {
      tailAppendWaves = 1;
    }
  }

  const allResources = getResourceEntries(win);
  let newFetchXhrCount = 0;
  let feedLikeRequestCount = 0;
  for (let r = baselineResourceCount; r < allResources.length; r++) {
    const entry = allResources[r];
    if (entry && isFetchOrXhrEntry(entry)) {
      newFetchXhrCount++;
      if (isFeedLikeResourceUrl(entry.name || '')) {
        feedLikeRequestCount++;
      }
    }
  }
  if (quiescence.newResourceCount > 0 && newFetchXhrCount > 0 && requestWaves === 0) {
    requestWaves = 1;
  }

  feedDom = detectFeedDomSignals(doc, win, container);
  finiteSignals = detectFiniteCounterSignals(
    doc,
    win,
    container,
    finalHeight,
    target.viewportHeight,
  );

  // Restore original scroll position smoothly
  const currentPosAfter = getScrollTop(container, win);
  const returnDistance = Math.abs(currentPosAfter - origTop);
  if (returnDistance > 5) {
    const scrollBackDuration =
      options?.scrollBackDurationMs ??
      Math.min(700, Math.max(250, Math.round((returnDistance / 3000) * 1000)));
    await smoothScrollTargetTo(container, win, origTop, origLeft, scrollBackDuration);
  }

  const classification = classifyScrollBehavior({
    target,
    initialHeight,
    finalHeight,
    viewportHeight: target.viewportHeight,
    stepsExecuted,
    reachedBottom,
    clampedEarly,
    growthWaves,
    totalGrowthPx,
    tailAppendWaves,
    tailAppendedNodes,
    newFetchXhrCount,
    feedLikeRequestCount,
    requestWaves,
    feedDom,
    finiteSignals,
    quiescenceTimedOut,
  });

  return {
    ...classification,
    stepsExecuted,
    reachedBottom,
    clampedEarly,
    initialHeight,
    finalHeight,
    quiescenceTimedOut,
  };
}
