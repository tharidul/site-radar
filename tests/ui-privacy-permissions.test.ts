import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import {
  getRequiredOriginPermissions,
  ensureOriginPermission,
} from '../entrypoints/popup/App';

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

  it('MED-11: getRequiredOriginPermissions scopes origins by inspection mode and scheme', () => {
    expect(getRequiredOriginPermissions('https://example.com/blog/post?a=1', 'quick')).toEqual([
      'https://example.com/*',
    ]);
    expect(getRequiredOriginPermissions('http://localhost:8080/app', 'full')).toEqual([
      'http://localhost:8080/*',
    ]);
    expect(getRequiredOriginPermissions('https://example.com/', 'deep')).toEqual(['*://*/*']);
    expect(getRequiredOriginPermissions('chrome://settings', 'quick')).toEqual([]);
    expect(getRequiredOriginPermissions('about:blank', 'deep')).toEqual([]);
    expect(getRequiredOriginPermissions(undefined, 'quick')).toEqual([]);
  });

  it('MED-11: ensureOriginPermission requests runtime permissions and handles denial or unsupported environments', async () => {
    const mockAdapter = new MockBrowserAdapter();
    const reqSpy = vi.spyOn(mockAdapter, 'requestPermissions');

    const okQuick = await ensureOriginPermission('https://example.com/page', 'quick', mockAdapter);
    expect(okQuick.granted).toBe(true);
    expect(reqSpy).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });

    const okDeep = await ensureOriginPermission('https://example.com/page', 'deep', mockAdapter);
    expect(okDeep.granted).toBe(true);
    expect(reqSpy).toHaveBeenCalledWith({ origins: ['*://*/*'] });

    const deniedAdapter = new MockBrowserAdapter();
    vi.spyOn(deniedAdapter, 'requestPermissions').mockResolvedValue(false);
    const denied = await ensureOriginPermission('https://example.com/page', 'quick', deniedAdapter);
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('https://example.com/*');

    const nonHttp = await ensureOriginPermission('chrome://extensions', 'quick', deniedAdapter);
    expect(nonHttp.granted).toBe(true);

    const throwingAdapter = new MockBrowserAdapter();
    vi.spyOn(throwingAdapter, 'requestPermissions').mockRejectedValue(
      new Error('Permissions API unavailable'),
    );
    const fallback = await ensureOriginPermission(
      'https://example.com/page',
      'quick',
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
});
