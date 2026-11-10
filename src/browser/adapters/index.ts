
import type { BrowserAdapter } from './types';
import { ChromeMV3Adapter } from './chrome.adapter';
import { FirefoxMV3Adapter } from './firefox.adapter';

declare const browser: any;

let activeAdapter: BrowserAdapter | null = null;

export function getBrowserAdapter(): BrowserAdapter {
  if (activeAdapter) return activeAdapter;

  if (typeof browser !== 'undefined' && browser.runtime?.id) {
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
