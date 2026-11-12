import { describe, it, expect, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { Header } from '../entrypoints/popup/components/Header';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import {
  getRequiredOriginPermissions,
  ensureOriginPermission,
} from '../entrypoints/popup/App';
import {
  BROWSER_PERMISSION_SESSION_KEY,
  PENDING_PERMISSION_SCAN_KEY,
  consumePendingPermissionScan,
  ensureEphemeralBrowserSessionPermissions,
  resetGrantedOriginPermissionsOnStartup,
  revokeAllGrantedOrigins,
  savePendingPermissionScan,
} from '../src/security/ephemeral-permissions';
import { setBrowserAdapter } from '../src/browser/adapters';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import backgroundDef from '../entrypoints/background';

const ROOT = path.resolve(__dirname, '..');

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe('UI Privacy, Permissions & Manifest Hardening (MED-05, MED-08, MED-09, MED-11, MED-14)', () => {
  it('MED-08: entrypoints contain zero external Google Fonts links or @import rules', () => {
    const entrypointFiles = collectFiles(path.join(ROOT, 'entrypoints'), [
      '.html',
      '.css',
      '.ts',
      '.tsx',
    ]);
    expect(entrypointFiles.length).toBeGreaterThan(0);

    for (const file of entrypointFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content, `${file} should not reference fonts.googleapis.com`).not.toContain(
        'fonts.googleapis.com',
      );
      expect(content, `${file} should not reference fonts.gstatic.com`).not.toContain(
        'fonts.gstatic.com',
      );
    }

    const popupCss = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/style.css'), 'utf-8');
    const optionsCss = fs.readFileSync(path.join(ROOT, 'entrypoints/options/options.css'), 'utf-8');
    expect(popupCss).toContain('system-ui');
    expect(optionsCss).toContain('system-ui');
  });

  it('MED-09: SocialPreviewView and entrypoints contain zero Google favicon proxy URLs', () => {
    const entrypointFiles = collectFiles(path.join(ROOT, 'entrypoints'), ['.ts', '.tsx', '.html']);
    for (const file of entrypointFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content, `${file} should not use google.com/s2/favicons`).not.toContain(
        'google.com/s2/favicons',
      );
    }

    const socialPreview = fs.readFileSync(
      path.join(ROOT, 'entrypoints/popup/components/SocialPreviewView.tsx'),
      'utf-8',
    );
    expect(socialPreview).toContain('<Globe');
  });

  it('MED-11 & MED-14: wxt.config.ts uses optional_host_permissions and Firefox strict_min_version 115.0', () => {
    const wxtConfig = fs.readFileSync(path.join(ROOT, 'wxt.config.ts'), 'utf-8');
    expect(wxtConfig).toContain('optional_host_permissions');
    expect(wxtConfig).not.toMatch(/\bhost_permissions\s*:/);
    expect(wxtConfig).toContain("strict_min_version: '115.0'");
    expect(wxtConfig).not.toContain("strict_min_version: '109.0'");

    const cwsDoc = fs.readFileSync(path.join(ROOT, 'CHROMEWEBSTORE.md'), 'utf-8');
    expect(cwsDoc).toContain('optional_host_permissions');
    expect(cwsDoc).not.toMatch(/•\s+host_permissions\s+\(/);
    expect(cwsDoc).not.toMatch(/\|\s*`\*:\/\/\*\/\*`\s*\|\s*host_permissions\s*\|/);
  });

  it('MED-11: getRequiredOriginPermissions scopes origins strictly to current site for both full and deep modes', () => {
    expect(getRequiredOriginPermissions('https://example.com/blog/post?a=1', 'full')).toEqual([
      'https://example.com/*',
    ]);
    expect(getRequiredOriginPermissions('http://localhost:8080/app', 'full')).toEqual([
      'http://localhost:8080/*',
    ]);
    expect(getRequiredOriginPermissions('https://example.com/sub/page', 'deep')).toEqual([
      'https://example.com/*',
    ]);
    expect(getRequiredOriginPermissions('chrome://settings', 'full')).toEqual([]);
    expect(getRequiredOriginPermissions('about:blank', 'deep')).toEqual([]);
    expect(getRequiredOriginPermissions(undefined, 'full')).toEqual([]);
  });

  it('MED-11: ensureOriginPermission requests runtime permissions for current site only and handles denial or unsupported environments', async () => {
    const mockAdapter = new MockBrowserAdapter();
    const reqSpy = vi.spyOn(mockAdapter, 'requestPermissions');

    const okFull = await ensureOriginPermission('https://example.com/page', 'full', mockAdapter);
    expect(okFull.granted).toBe(true);
    expect(reqSpy).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });

    const okDeep = await ensureOriginPermission('https://example.com/page', 'deep', mockAdapter);
    expect(okDeep.granted).toBe(true);
    expect(reqSpy).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });

    const deniedAdapter = new MockBrowserAdapter();
    vi.spyOn(deniedAdapter, 'requestPermissions').mockResolvedValue(false);
    const denied = await ensureOriginPermission('https://example.com/page', 'full', deniedAdapter);
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('https://example.com/*');

    const nonHttp = await ensureOriginPermission('chrome://extensions', 'full', deniedAdapter);
    expect(nonHttp.granted).toBe(true);

    const throwingAdapter = new MockBrowserAdapter();
    vi.spyOn(throwingAdapter, 'requestPermissions').mockRejectedValue(
      new Error('Permissions API unavailable'),
    );
    const fallback = await ensureOriginPermission(
      'https://example.com/page',
      'full',
      throwingAdapter,
    );
    expect(fallback.granted).toBe(true);
  });

  it('MED-05: popup App.tsx does not generate temporary scan_${Date.now()} IDs and tracks res.scanId / early cancel', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'entrypoints/popup/App.tsx'), 'utf-8');
    expect(appSource).not.toContain('scan_${Date.now()}');
    expect(appSource).toContain('res.scanId');
    expect(appSource).toContain('pendingCancelRef');
  });

  it('OptionsApp.tsx removes obsolete --no-sandbox reference', () => {
    const optionsSource = fs.readFileSync(
      path.join(ROOT, 'entrypoints/options/OptionsApp.tsx'),
      'utf-8',
    );
    expect(optionsSource).not.toContain('--no-sandbox');
  });

  it('ephemeral permissions: revokes lingering granted origins on new browser session or startup while preserving them during live session', async () => {
    const adapter = new MockBrowserAdapter();
    await adapter.requestPermissions({
      permissions: ['activeTab'],
      origins: ['https://example.com/*', 'https://other.test/*'],
    });

    // Simulate fresh browser launch (storage.session is empty after browser close)
    await ensureEphemeralBrowserSessionPermissions(adapter);

    const afterLaunch = await adapter.getAllPermissions();
    expect(afterLaunch.origins).toEqual([]);
    expect(afterLaunch.permissions).toEqual(['activeTab']);

    const sessionData = await adapter.getStorage<string>([BROWSER_PERMISSION_SESSION_KEY], 'session');
    expect(sessionData[BROWSER_PERMISSION_SESSION_KEY]).toBeTruthy();

    // Grant current site while browser session is live
    await adapter.requestPermissions({ origins: ['https://live-site.com/*'] });
    // Subsequent SW wakeups / popup opens within the same live session do NOT revoke it
    await ensureEphemeralBrowserSessionPermissions(adapter);
    const duringLiveSession = await adapter.getAllPermissions();
    expect(duringLiveSession.origins).toEqual(['https://live-site.com/*']);

    // Simulate explicit browser startup handler
    const revoked = await resetGrantedOriginPermissionsOnStartup(adapter);
    expect(revoked).toEqual(['https://live-site.com/*']);
    expect((await adapter.getAllPermissions()).origins).toEqual([]);

    // Direct helper test
    await adapter.requestPermissions({ origins: ['https://another.com/*'] });
    expect(await revokeAllGrantedOrigins(adapter)).toEqual(['https://another.com/*']);
    expect((await adapter.getAllPermissions()).origins).toEqual([]);
  });

  it('pending permission scan: saves, matches granted origins once, and rejects expired or mismatched origins', async () => {
    const adapter = new MockBrowserAdapter();

    await savePendingPermissionScan(adapter, {
      origins: ['https://example.com/*'],
      mode: 'deep',
      tabId: 42,
      url: 'https://example.com/',
      refreshPage: true,
      createdAt: Date.now(),
    });

    // Unrelated origin does not consume the pending scan
    const mismatch = await consumePendingPermissionScan(adapter, ['https://other.com/*']);
    expect(mismatch).toBeNull();

    // Matching origin consumes it once and clears session storage
    const matched = await consumePendingPermissionScan(adapter, ['https://example.com/*']);
    expect(matched).toMatchObject({
      mode: 'deep',
      tabId: 42,
      refreshPage: true,
    });
    const secondRead = await consumePendingPermissionScan(adapter, ['https://example.com/*']);
    expect(secondRead).toBeNull();

    // Expired entries (> 2 minutes) are discarded
    await adapter.setStorage(
      {
        [PENDING_PERMISSION_SCAN_KEY]: {
          origins: ['https://stale.com/*'],
          mode: 'deep',
          tabId: 7,
          createdAt: Date.now() - 3 * 60 * 1000,
        },
      },
      'session',
    );
    expect(await consumePendingPermissionScan(adapter, ['https://stale.com/*'])).toBeNull();
  });

  it('auto-starts pending deep scan in background when chrome.permissions.onAdded fires after popup prompt', async () => {
    const originalChrome = (globalThis as any).chrome;
    const adapter = new MockBrowserAdapter();
    setBrowserAdapter(adapter);

    let onAddedListener: ((added: { origins?: string[] }) => void | Promise<void>) | undefined;
    (globalThis as any).chrome = {
      runtime: { id: 'test-ext', onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onConnect: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
      tabs: { onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
      alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
      contextMenus: { onClicked: { addListener: vi.fn() } },
      permissions: {
        onAdded: {
          addListener: vi.fn((cb) => {
            onAddedListener = cb;
          }),
        },
      },
    };

    const startSpy = vi
      .spyOn(inspectionOrchestrator, 'startInspection')
      .mockResolvedValue({ id: 'scan_auto_1' } as any);
    vi.spyOn(inspectionOrchestrator, 'getSession').mockReturnValueOnce(undefined).mockReturnValue({
      scanId: 'scan_auto_1',
      tabId: 99,
      state: 'running',
    } as any);

    try {
      const mainFn = (backgroundDef as any).main;
      if (typeof mainFn === 'function') {
        mainFn();
      }
      expect(onAddedListener).toBeDefined();

      await savePendingPermissionScan(adapter, {
        origins: ['https://www.aliexpress.com/*'],
        mode: 'deep',
        tabId: 99,
        url: 'https://www.aliexpress.com/',
        refreshPage: true,
        createdAt: Date.now(),
      });

      await onAddedListener!({ origins: ['https://www.aliexpress.com/*'] });

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        'deep',
        99,
        expect.objectContaining({ refreshPage: true }),
      );
    } finally {
      setBrowserAdapter(null);
      (globalThis as any).chrome = originalChrome;
      vi.restoreAllMocks();
    }
  });
});

describe('Header favicon loading and safe fallback', () => {
  it('renders site favicon, falls back to origin /favicon.ico, rejects unsafe URLs, and falls back to Globe on error', () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const baseProps = {
      tabUrl: 'https://bodimak.lk/',
      tabHostname: 'bodimak.lk',
      schemeValid: true,
      hasInspectionData: false,
      onClearResults: () => {},
      onOptionsClick: () => {},
    };

    try {
      // 1. Explicit https faviconUrl renders <img> with no-referrer policy
      act(() => {
        root.render(
          createElement(Header, {
            ...baseProps,
            faviconUrl: 'https://bodimak.lk/icon.png',
          }),
        );
      });
      const img = container.querySelector(
        'img[referrerpolicy="no-referrer"]',
      ) as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('https://bodimak.lk/icon.png');
      expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');

      // 2. Omitted faviconUrl falls back to first-party ${origin}/favicon.ico
      act(() => {
        root.render(createElement(Header, baseProps));
      });
      const fallbackImg = container.querySelector(
        'img[referrerpolicy="no-referrer"]',
      ) as HTMLImageElement | null;
      expect(fallbackImg?.getAttribute('src')).toBe('https://bodimak.lk/favicon.ico');

      // 3. Error event hides favicon <img> and renders <Globe> SVG fallback
      act(() => {
        fallbackImg?.dispatchEvent(new Event('error'));
      });
      expect(container.querySelector('img[referrerpolicy="no-referrer"]')).toBeNull();
      expect(container.querySelector('svg.lucide-globe')).not.toBeNull();

      // 4. Unsafe schemes (e.g. javascript:) are ignored and never placed in img[src]
      act(() => {
        root.render(
          createElement(Header, {
            ...baseProps,
            tabUrl: 'chrome://settings',
            tabHostname: 'settings',
            schemeValid: false,
            faviconUrl: 'javascript:alert(1)',
          }),
        );
      });
      expect(container.querySelector('img[referrerpolicy="no-referrer"]')).toBeNull();
      expect(container.querySelector('svg.lucide-globe')).not.toBeNull();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
