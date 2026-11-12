import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LiveProgressBar } from '../entrypoints/popup/components/LiveProgressBar';
import type { ScanProgressEvent } from '../src/types/messaging';

const ROOT = path.resolve(__dirname, '..');
const RING_CIRCUMFERENCE = 2 * Math.PI * 96;

function makeProgress(overrides: Partial<ScanProgressEvent> = {}): ScanProgressEvent {
  return {
    scanId: 'scan-123',
    mode: 'full',
    step: 'Running security checks...',
    module: 'security',
    percent: 45,
    completedModules: 6,
    totalModules: 15,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

describe('LiveProgressBar circular SVG progress ring UI', () => {
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

  function renderProgressBar(props: React.ComponentProps<typeof LiveProgressBar>): void {
    act(() => {
      root.render(React.createElement(LiveProgressBar, props));
    });
  }

  it('renders circular SVG progress ring, arc geometry, percentage with tabular-nums, and ARIA attributes', () => {
    const onCancel = vi.fn();
    renderProgressBar({
      progress: makeProgress({ percent: 60, module: 'performance', step: 'Measuring Core Web Vitals...' }),
      onCancel,
      targetHost: 'example.com',
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar!.getAttribute('aria-valuenow')).toBe('60');
    expect(progressbar!.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar!.getAttribute('aria-valuemax')).toBe('100');
    expect(progressbar!.getAttribute('aria-label')).toBe('Audit progress for example.com');
    expect(progressbar!.getAttribute('aria-valuetext')).toContain('60%');
    expect(progressbar!.getAttribute('aria-valuetext')).toContain('Performance');

    const arc = progressbar!.querySelector('circle.siteradar-progress-arc');
    expect(arc).not.toBeNull();
    expect(arc!.getAttribute('r')).toBe('96');
    expect(Number(arc!.getAttribute('stroke-dasharray'))).toBeCloseTo(RING_CIRCUMFERENCE, 4);
    expect(Number(arc!.getAttribute('stroke-dashoffset'))).toBeCloseTo(RING_CIRCUMFERENCE * 0.4, 4);

    const orbitSvg = progressbar!.querySelector('svg.siteradar-orbit-spin');
    expect(orbitSvg).not.toBeNull();
    const orbitCircle = orbitSvg!.querySelector('circle');
    expect(orbitCircle?.getAttribute('r')).toBe('81');

    const percentEl = Array.from(progressbar!.querySelectorAll('span')).find((el) =>
      el.textContent?.trim() === '60%',
    );
    expect(percentEl).toBeDefined();
    expect(percentEl!.className).toContain('tabular-nums');

    expect(container.textContent).toContain('example.com');
    expect(container.textContent).toContain('6 / 15 modules');
  });

  it('maps active module and phase steps to crisp icon and label inside the ring', () => {
    const onCancel = vi.fn();
    renderProgressBar({
      progress: makeProgress({ module: 'accessibility', step: 'Auditing WCAG rules...' }),
      onCancel,
    });

    const progressbar = container.querySelector('[role="progressbar"]')!;
    expect(progressbar.getAttribute('aria-label')).toBe('Audit progress');
    expect(progressbar.textContent).toContain('Accessibility');
    // Active Lucide icon + 2 ring SVGs = 3 SVGs inside progressbar
    expect(progressbar.querySelectorAll('svg').length).toBe(3);

    renderProgressBar({
      progress: makeProgress({
        module: undefined,
        step: 'Hard refreshing page (clearing cache) for accurate data usage...',
      }),
      onCancel,
    });
    expect(container.querySelector('[role="progressbar"]')!.textContent).toContain('Clearing Cache');

    renderProgressBar({
      progress: makeProgress({
        module: undefined,
        step: 'Finalizing audit score report...',
      }),
      onCancel,
    });
    expect(container.querySelector('[role="progressbar"]')!.textContent).toContain('Scoring Audit');

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion!.textContent).toBe('Finalizing audit score report...');
  });

  it('invokes onCancel callback when Cancel Scan is clicked and disables during isCancelling', () => {
    const onCancel = vi.fn();
    renderProgressBar({
      progress: makeProgress(),
      onCancel,
      isCancelling: false,
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel Scan'),
    );
    expect(cancelBtn).toBeDefined();
    expect(cancelBtn!.disabled).toBe(false);

    act(() => {
      cancelBtn!.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    renderProgressBar({
      progress: makeProgress(),
      onCancel,
      isCancelling: true,
    });

    const cancellingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelling...'),
    );
    expect(cancellingBtn).toBeDefined();
    expect(cancellingBtn!.disabled).toBe(true);

    act(() => {
      cancellingBtn!.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('handles null progress and clamps zero/out-of-range percentages cleanly', () => {
    const onCancel = vi.fn();
    renderProgressBar({
      progress: null,
      onCancel,
    });

    const progressbar = container.querySelector('[role="progressbar"]')!;
    expect(progressbar.getAttribute('aria-valuenow')).toBe('0');
    expect(progressbar.textContent).toContain('0%');
    expect(progressbar.textContent).toContain('Initializing');

    const arc = progressbar.querySelector('circle.siteradar-progress-arc')!;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(RING_CIRCUMFERENCE, 4);

    expect(container.textContent).toContain('0 / 10 modules');
    expect(container.textContent).toContain('Initializing audit pipeline...');

    renderProgressBar({
      progress: makeProgress({ percent: -15 }),
      onCancel,
      disablePacing: true,
    });
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('0');

    renderProgressBar({
      progress: makeProgress({ percent: 135 }),
      onCancel,
      disablePacing: true,
    });
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('100');
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 4);
  });

  it('paces rapid 3% -> 60% backend jumps smoothly and cycles showcase modules inside the ring', () => {
    vi.useFakeTimers();
    try {
      const onCancel = vi.fn();
      renderProgressBar({
        progress: makeProgress({
          module: undefined,
          percent: 3,
          completedModules: 0,
          totalModules: 15,
          step: 'Hard refreshing page (clearing cache) for accurate data usage...',
        }),
        onCancel,
      });

      const progressbar = container.querySelector('[role="progressbar"]')!;
      expect(progressbar.getAttribute('aria-valuenow')).toBe('3');

      // Backend suddenly jumps to 60% in a single burst
      renderProgressBar({
        progress: makeProgress({
          module: 'security',
          percent: 60,
          completedModules: 9,
          totalModules: 15,
          step: 'Auditing security headers...',
        }),
        onCancel,
      });

      // Should not teleport to 60% immediately
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeLessThan(60);

      // Advance 1 showcase tick (650ms): smoothly glides percent upward and displays queued module
      act(() => {
        vi.advanceTimersByTime(700);
      });
      const midPercent = Number(progressbar.getAttribute('aria-valuenow'));
      expect(midPercent).toBeGreaterThan(3);
      expect(midPercent).toBeLessThan(60);

      // Advance further so showcase steps through unshown audit modules once without repeating
      const seenLabels: string[] = [];
      for (let i = 0; i < 18; i++) {
        act(() => {
          vi.advanceTimersByTime(650);
        });
        const label = progressbar.querySelector('span:last-of-type')?.textContent?.trim() || '';
        if (label && seenLabels[seenLabels.length - 1] !== label) {
          seenLabels.push(label);
        }
      }

      // Each module shown only once; no wrap-around repeat of Website Identity after finishing
      expect(seenLabels.filter((l) => l === 'Website Identity').length).toBe(1);
      expect(seenLabels[seenLabels.length - 1]).toBe('Security');
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves reduced-motion CSS overrides and running-state flex centering in App.tsx', () => {
    const css = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/style.css'), 'utf-8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.siteradar-orbit-spin');
    expect(css).toContain('.siteradar-step-enter');
    expect(css).toContain('.siteradar-progress-arc');

    const appTsx = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/App.tsx'), 'utf-8');
    expect(appTsx).toContain('<main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">');
    expect(appTsx).toContain('min-h-full w-full flex items-center justify-center');
    expect(appTsx).toContain('targetHost={');
  });
});

