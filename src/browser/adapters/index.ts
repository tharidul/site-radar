
import type { BrowserAdapter } from './types';
import { ChromeMV3Adapter } from './chrome.adapter';
import { FirefoxMV3Adapter } from './firefox.adapter';

declare const browser: any;
declare const chrome: any;

let activeAdapter: BrowserAdapter | null = null;

function isFirefoxEnvironment(): boolean {
  const runtimeBrowser =
    (globalThis as any).browser ?? (typeof browser !== 'undefined' ? browser : undefined);
  const runtimeChrome =
    (globalThis as any).chrome ?? (typeof chrome !== 'undefined' ? chrome : undefined);

  if (!runtimeBrowser || !runtimeBrowser.runtime?.id) {
    return false;
  }

  try {
    const extUrl =
      typeof runtimeBrowser.runtime.getURL === 'function' ? runtimeBrowser.runtime.getURL('') : '';
    if (typeof extUrl === 'string') {
      if (extUrl.startsWith('moz-extension://')) return true;
      if (extUrl.startsWith('chrome-extension://')) return false;
    }
  } catch {
    // Ignore getURL errors in mocked/restricted contexts
  }

  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    if (/Firefox\//i.test(navigator.userAgent)) return true;
    if (/(?:Chrome|Chromium|Edg)\//i.test(navigator.userAgent)) return false;
  }

  return typeof runtimeChrome === 'undefined' || !runtimeChrome?.runtime?.id;
}

export function getBrowserAdapter(): BrowserAdapter {
  if (activeAdapter) return activeAdapter;

  if (isFirefoxEnvironment()) {
    activeAdapter = new FirefoxMV3Adapter();
  } else {
    activeAdapter = new ChromeMV3Adapter();
  }

  return activeAdapter;
}

export function setBrowserAdapter(adapter: BrowserAdapter | null): void {
  activeAdapter = adapter;
}

export * from './types';
export * from './chrome.adapter';
export * from './firefox.adapter';
export * from './mock.adapter';
