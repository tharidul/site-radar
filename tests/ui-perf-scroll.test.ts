import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  App,
  shouldPollLiveMetrics,
  reconcileLiveMetrics,
  type LiveMetricsSnapshot,
} from '../entrypoints/popup/App';
import { PageVitalsCard } from '../entrypoints/popup/components/PageVitalsCard';
import { setBrowserAdapter, MockBrowserAdapter } from '../src/browser/adapters';
import { messageBus } from '../src/messaging/bus';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import type { WebsiteInspection, PerformanceData } from '../src/types/inspection';

const ROOT = path.resolve(__dirname, '..');

function createMinimalInspection(url = 'https://example.com/'): WebsiteInspection {
  return {
    id: 'scan-1',
    mode: 'full',
    target: {
      url,
      origin: 'https://example.com',
      hostname: 'example.com',
      inspectedAt: 1_700_000_000_000,
    },
    browser: { name: 'chrome' },
    modules: {},
    findings: [],
    summary: {
      completedModules: 0,
      partialModules: 0,
      failedModules: 0,
      totalFindings: 0,
    },
    scores: {},
    startedAt: 1_700_000_000_000,
  };
}

describe('UI Scroll Performance & Polling Hardening', () => {
  it('shouldPollLiveMetrics gates polling strictly on completed scan, overview tab, and valid tabId', () => {
    expect(shouldPollLiveMetrics('completed', 'overview', 42)).toBe(true);

    expect(shouldPollLiveMetrics('idle', 'overview', 42)).toBe(false);
    expect(shouldPollLiveMetrics('running', 'overview', 42)).toBe(false);
    expect(shouldPollLiveMetrics('cancelled', 'overview', 42)).toBe(false);
    expect(shouldPollLiveMetrics('failed', 'overview', 42)).toBe(false);

    expect(shouldPollLiveMetrics('completed', 'issues', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'headers', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'resources', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'cookies', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'rules', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'social', 42)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'about', 42)).toBe(false);

    expect(shouldPollLiveMetrics('completed', 'overview', undefined)).toBe(false);
    expect(shouldPollLiveMetrics('completed', 'overview', 0)).toBe(false);
  });

  it('reconcileLiveMetrics preserves previous reference when all 6 numeric fields match', () => {
    const prev: LiveMetricsSnapshot = {
      resourceCount: 12,
      wireTransferBytes: 4096,
      decodedBytes: 8192,
      cacheHitCount: 4,
      cacheHitBytes: 1024,
      opaqueResourceCount: 1,
    };

    const unchanged = reconcileLiveMetrics(prev, { ...prev });
    expect(unchanged).toBe(prev);

    const changedResource = reconcileLiveMetrics(prev, { ...prev, resourceCount: 13 });
    expect(changedResource).not.toBe(prev);
    expect(changedResource.resourceCount).toBe(13);

    const changedWire = reconcileLiveMetrics(prev, { ...prev, wireTransferBytes: 5000 });
    expect(changedWire).not.toBe(prev);

    const changedDecoded = reconcileLiveMetrics(prev, { ...prev, decodedBytes: 9000 });
    expect(changedDecoded).not.toBe(prev);

    const changedCacheCount = reconcileLiveMetrics(prev, { ...prev, cacheHitCount: 5 });
    expect(changedCacheCount).not.toBe(prev);

    const changedCacheBytes = reconcileLiveMetrics(prev, { ...prev, cacheHitBytes: 2048 });
    expect(changedCacheBytes).not.toBe(prev);

    const changedOpaque = reconcileLiveMetrics(prev, { ...prev, opaqueResourceCount: 2 });
    expect(changedOpaque).not.toBe(prev);

    const fromNull = reconcileLiveMetrics(null, prev);
    expect(fromNull).toEqual(prev);
  });

  it('App.tsx gates live-metrics polling on overview tab, short-circuits unchanged updates, and uses a unified <main> scroller', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/App.tsx'), 'utf-8');

    expect(appSource).toContain("activeDashboardTab === 'overview'");
    expect(appSource).toContain('[scanStatus, activeDashboardTab, activeTab?.id]');
    expect(appSource).toContain('reconcileLiveMetrics');

    expect(appSource).toContain(
      '<main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">',
    );
    expect(appSource).not.toMatch(/<main\s+className=\{`[^`]*overflow-hidden/);
  });

  it('style.css pairs content-visibility: auto with contain-intrinsic-size on .deferred-list-item:nth-child(n+9)', () => {
    const css = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/style.css'), 'utf-8');

    const ruleMatch = css.match(/\.deferred-list-item:nth-child\(n\+9\)\s*\{([^}]*)\}/);
    expect(ruleMatch, 'Expected .deferred-list-item:nth-child(n+9) rule in style.css').not.toBeNull();
    const ruleBody = ruleMatch![1];
    expect(ruleBody).toMatch(/content-visibility\s*:\s*auto\s*;/);
    expect(ruleBody).toMatch(/contain-intrinsic-size\s*:\s*auto\s+none\s+auto\s+72px\s*;/);
  });

  describe('Rendered <App /> polling & unified scroller behavior', () => {
    let container: HTMLDivElement;
    let root: Root;
    let adapter: MockBrowserAdapter;

    beforeEach(() => {
      vi.useFakeTimers();
      (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
      if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = vi.fn();
      }
      adapter = new MockBrowserAdapter();
      adapter.setMockTab({
        id: 7,
        url: 'https://example.com/',
        title: 'Example',
        active: true,
        incognito: false,
        status: 'complete',
      });
      setBrowserAdapter(adapter);

      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      setBrowserAdapter(null);
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('stops GET_LIVE_METRICS polling when leaving overview tab, resumes on return, and avoids re-renders on identical metrics', async () => {
      const inspection = createMinimalInspection('https://example.com/');
      const metricsPayload = {
        success: true,
        resourceCount: 10,
        wireTransferBytes: 2048,
        decodedBytes: 4096,
        cacheHitCount: 3,
        cacheHitBytes: 512,
        opaqueResourceCount: 0,
      };

      vi.spyOn(messageBus, 'sendToBackground').mockImplementation(async (channel) => {
        if (channel === MESSAGE_CHANNELS.GET_INSPECTION_STATE) {
          return { state: 'completed', inspection } as never;
        }
        return {} as never;
      });

      const sendToTabSpy = vi.spyOn(messageBus, 'sendToTab').mockResolvedValue(metricsPayload as never);
      const onRender = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(
            React.Profiler,
            { id: 'popup-app', onRender },
            React.createElement(App, {}),
          ),
        );
      });

      // Flush initialize() promises, passive effects, and initial pollLiveMetrics()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });

      const mainEl = container.querySelector('main');
      expect(mainEl).not.toBeNull();
      expect(mainEl!.className).toBe('flex-1 min-h-0 overflow-y-auto overscroll-y-contain');

      expect(sendToTabSpy).toHaveBeenCalledWith(
        7,
        MESSAGE_CHANNELS.GET_LIVE_METRICS,
        undefined,
      );
      const callsAfterFirstTick = sendToTabSpy.mock.calls.length;
      const rendersAfterFirstPoll = onRender.mock.calls.length;

      // Advance three more 1200ms intervals with identical metrics -> polling fires, zero extra renders occur
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3600);
      });

      expect(sendToTabSpy.mock.calls.length).toBeGreaterThanOrEqual(callsAfterFirstTick + 3);
      expect(onRender.mock.calls.length).toBe(rendersAfterFirstPoll);

      // Switch to Issues tab -> polling must stop
      const issuesBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Issues'),
      );
      expect(issuesBtn).toBeDefined();

      await act(async () => {
        issuesBtn!.click();
      });

      const callsAfterLeavingOverview = sendToTabSpy.mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(3600);
        await Promise.resolve();
      });

      expect(sendToTabSpy.mock.calls.length).toBe(callsAfterLeavingOverview);
      expect(container.querySelector('main')!.className).toBe(
        'flex-1 min-h-0 overflow-y-auto overscroll-y-contain',
      );

      // Switch back to Overview -> polling resumes immediately
      const overviewBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Overview'),
      );
      expect(overviewBtn).toBeDefined();

      await act(async () => {
        overviewBtn!.click();
        await Promise.resolve();
      });

      expect(sendToTabSpy.mock.calls.length).toBeGreaterThan(callsAfterLeavingOverview);
    });
  });

  describe('PageVitalsCard scroll/layout classification chips', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    function renderWithPerfData(perfData: PerformanceData): void {
      const inspection = createMinimalInspection('https://example.com/');
      inspection.modules.performance = {
        module: 'performance',
        status: 'completed',
        collectedAt: 1_700_000_000_000,
        data: perfData,
        coverage: { expected: 1, collected: 1, unavailable: 0 },
        limitations: [],
        errors: [],
        sources: ['content-script'],
      };
      act(() => {
        root.render(React.createElement(PageVitalsCard, { inspection }));
      });
    }

    it('renders Fixed Height chip with confidence & signals tooltip and omits Infinite Feed chip', () => {
      renderWithPerfData({
        resourceCount: 10,
        wireTransferBytes: 4096,
        scrolledResourceCount: 10,
        scrolledWireTransferBytes: 4096,
        layoutScrollType: 'fixed-height',
        isFixedHeight: true,
        isInfiniteScrollDetected: false,
        scrollConfidence: 'high',
        scrollSignals: ['root overflow-y:hidden', 'no inner scroll container'],
      });

      const chip = container.querySelector('[data-scroll-layout="fixed-height"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toContain('Fixed Height');
      expect(chip!.getAttribute('title')).toContain('Confidence: high');
      expect(chip!.getAttribute('title')).toContain('Signals: root overflow-y:hidden, no inner scroll container');
      expect(container.querySelector('[data-scroll-layout="infinite-feed"]')).toBeNull();
      expect(container.textContent).not.toContain('Infinite Feed (Bounded)');
    });

    it('renders App Shell chip for app-shell layoutScrollType', () => {
      renderWithPerfData({
        resourceCount: 15,
        wireTransferBytes: 10240,
        scrolledResourceCount: 22,
        scrolledWireTransferBytes: 18432,
        layoutScrollType: 'app-shell',
        isFixedHeight: false,
        isInfiniteScrollDetected: false,
        scrollConfidence: 'high',
        scrollSignals: ['locked body with inner main scroller'],
      });

      const chip = container.querySelector('[data-scroll-layout="app-shell"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toContain('App Shell');
      expect(chip!.getAttribute('title')).toContain('inner scroll container');
      expect(chip!.getAttribute('title')).toContain('Confidence: high');
    });

    it('renders Long Page chip for long-page layoutScrollType without flagging infinite scroll', () => {
      renderWithPerfData({
        resourceCount: 20,
        wireTransferBytes: 25000,
        scrolledResourceCount: 35,
        scrolledWireTransferBytes: 60000,
        layoutScrollType: 'long-page',
        isFixedHeight: false,
        isInfiniteScrollDetected: false,
        scrollConfidence: 'high',
        scrollSignals: ['tall finite page >=6x viewport', 'footer reachable'],
      });

      const chip = container.querySelector('[data-scroll-layout="long-page"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toContain('Long Page');
      expect(chip!.getAttribute('title')).toContain('Signals: tall finite page >=6x viewport, footer reachable');
      expect(container.textContent).not.toContain('Infinite Feed (Bounded)');
    });

    it('renders Infinite Feed (Bounded) chip for infinite-feed layoutScrollType', () => {
      renderWithPerfData({
        resourceCount: 18,
        wireTransferBytes: 30000,
        scrolledResourceCount: 44,
        scrolledWireTransferBytes: 95000,
        layoutScrollType: 'infinite-feed',
        isFixedHeight: false,
        isInfiniteScrollDetected: true,
        scrollConfidence: 'high',
        scrollSignals: ['growthWaves=3', 'role=feed'],
      });

      const chip = container.querySelector('[data-scroll-layout="infinite-feed"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toContain('Infinite Feed (Bounded)');
      expect(chip!.getAttribute('title')).toContain('Confidence: high');
      expect(chip!.getAttribute('title')).toContain('Signals: growthWaves=3, role=feed');
    });

    it('omits scroll layout chip for standard finite pages and supports legacy fallback flags', () => {
      renderWithPerfData({
        resourceCount: 12,
        wireTransferBytes: 8000,
        scrolledResourceCount: 12,
        scrolledWireTransferBytes: 8000,
        layoutScrollType: 'finite',
        isFixedHeight: false,
        isInfiniteScrollDetected: false,
      });

      expect(container.querySelector('[data-scroll-layout]')).toBeNull();

      renderWithPerfData({
        resourceCount: 12,
        wireTransferBytes: 8000,
        isInfiniteScrollDetected: true,
      });
      const legacyInf = container.querySelector('[data-scroll-layout="infinite-feed"]');
      expect(legacyInf).not.toBeNull();
      expect(legacyInf!.textContent).toContain('Infinite Feed (Bounded)');

      renderWithPerfData({
        resourceCount: 12,
        wireTransferBytes: 8000,
        isFixedHeight: true,
      });
      const legacyFixed = container.querySelector('[data-scroll-layout="fixed-height"]');
      expect(legacyFixed).not.toBeNull();
      expect(legacyFixed!.textContent).toContain('Fixed Height');
    });
  });
});
