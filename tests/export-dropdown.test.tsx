
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { ExportDropdown } from '../entrypoints/popup/components/ExportDropdown';
import type { WebsiteInspection } from '../src/types/inspection';
import * as downloadModule from '../src/export/download';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockInspection: WebsiteInspection = {
  id: 'test-audit-dropdown',
  mode: 'quick',
  startedAt: 1700000000000,
  target: {
    url: 'https://example.com/',
    origin: 'https://example.com',
    hostname: 'example.com',
    inspectedAt: 1700000000000,
  },
  browser: { name: 'chrome' },
  summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
  findings: [],
  modules: {},
};

async function renderInteractive(ui: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(ui);
  });
  return container;
}

describe('ExportDropdown Component', () => {
  it('renders trigger button with proper accessible attributes via static render', () => {
    const html = renderToString(<ExportDropdown inspection={mockInspection} />);
    expect(html).toContain('Export');
    expect(html).toContain('title="Export or copy audit report"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('opens and closes menu upon trigger button click in interactive DOM', async () => {
    const container = await renderInteractive(<ExportDropdown inspection={mockInspection} />);
    const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    expect(container.querySelector('[role="menu"]')).toBeNull();

    await act(async () => {
      trigger.click();
    });

    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    expect(menu?.textContent).toContain('Copy JSON');
    expect(menu?.textContent).toContain('Export JSON');
    expect(menu?.textContent).toContain('Export HTML');

    await act(async () => {
      trigger.click();
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes menu when Escape key is pressed', async () => {
    const container = await renderInteractive(<ExportDropdown inspection={mockInspection} />);
    const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;

    await act(async () => {
      trigger.click();
    });
    expect(container.querySelector('[role="menu"]')).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('executes copyJsonReport when Copy JSON is selected', async () => {
    const copySpy = vi.spyOn(downloadModule, 'copyJsonReport').mockResolvedValue(true);
    const container = await renderInteractive(<ExportDropdown inspection={mockInspection} />);
    const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;

    await act(async () => {
      trigger.click();
    });

    const copyBtn = Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
      (b) => b.textContent?.includes('Copy JSON')
    ) as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();

    await act(async () => {
      copyBtn.click();
    });

    expect(copySpy).toHaveBeenCalledWith(mockInspection, { includeRawModules: false, pretty: true });
    expect(trigger.textContent).toContain('JSON Copied!');
    copySpy.mockRestore();
  });
});
