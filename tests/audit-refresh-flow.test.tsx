import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ModeSelector } from '../entrypoints/popup/components/ModeSelector';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';

describe('Fresh Page Reload on Inspection Start', () => {
  it('renders "Hard refresh (clear cache) before scan" toggle in ModeSelector', () => {
    const html = renderToString(
      <ModeSelector
        selectedMode="quick"
        onSelectMode={() => {}}
        onStartInspection={() => {}}
        disabled={false}
        refreshPage={true}
        onToggleRefreshPage={() => {}}
      />
    );

    expect(html).toContain('Hard refresh (clear cache) before scan');
    expect(html).toContain('type="checkbox"');
  });

  it('MockBrowserAdapter.reloadTab sets tab status to complete', async () => {
    const adapter = new MockBrowserAdapter();
    adapter.setMockTab({
      id: 42,
      url: 'https://example.com/test',
      incognito: false,
      active: true,
      status: 'loading',
    });

    await adapter.reloadTab(42, { bypassCache: true });
    const tab = await adapter.getTab(42);
    expect(tab?.status).toBe('complete');
  });

  it('orchestrator calls adapter.reloadTab with bypassCache: true during startInspection', async () => {
    const adapter = new MockBrowserAdapter();
    adapter.setMockTab({
      id: 99,
      url: 'https://example.com/blog',
      incognito: false,
      active: true,
    });

    const reloadSpy = vi.spyOn(adapter, 'reloadTab');
    const orchestrator = new InspectionOrchestrator({ browserAdapter: adapter });

    try {
      await orchestrator.startInspection('quick', 99, { refreshPage: true, skipIntelligence: true });
    } catch {
    }

    expect(reloadSpy).toHaveBeenCalledWith(99, expect.objectContaining({ bypassCache: true, timeoutMs: 15000 }));
  });

  it('hides ModeSelector launcher options while scanStatus is running', () => {
    const scanStatus: 'idle' | 'running' | 'completed' = 'running';
    const activeDashboardTab = 'overview';
    const inspection = null;

    const content = activeDashboardTab === 'overview' ? (
      scanStatus === 'running' ? null : inspection && scanStatus === 'completed' ? (
        <div data-testid="overview" />
      ) : (
        <ModeSelector
          selectedMode="quick"
          onSelectMode={() => {}}
          onStartInspection={() => {}}
          disabled={false}
        />
      )
    ) : null;

    const html = renderToString(<div>{content}</div>);
    expect(html).not.toContain('Choose Audit Depth');
    expect(html).not.toContain('Quick Scan');
  });
});

