/**
 * @file src/browser/adapters/index.ts
 * @description Adapter factory with environment detection and test injection support.
 */

import type { BrowserAdapter } from './types';
import { ChromeMV3Adapter } from './chrome.adapter';
import { FirefoxMV3Adapter } from './firefox.adapter';

// Declare browser for Gecko runtime detection
declare const browser: any;

let activeAdapter: BrowserAdapter | null = null;

/**
 * Returns the active BrowserAdapter instance.
 * Automatically selects FirefoxMV3Adapter or ChromeMV3Adapter based on runtime globals,
 * unless overridden via setBrowserAdapter (e.g. for testing with MockBrowserAdapter).
 */
export function getBrowserAdapter(): BrowserAdapter {
  if (activeAdapter) return activeAdapter;

  if (typeof browser !== 'undefined' && browser.runtime?.id) {
    activeAdapter = new FirefoxMV3Adapter();
  } else {
    activeAdapter = new ChromeMV3Adapter();
  }

  return activeAdapter;
}

/**
 * Overrides the active BrowserAdapter instance (useful for unit testing).
 * @param adapter The adapter to inject, or null to reset to auto-detection.
 */
export function setBrowserAdapter(adapter: BrowserAdapter | null): void {
  activeAdapter = adapter;
}

export * from './types';
export * from './chrome.adapter';
export * from './firefox.adapter';
export * from './mock.adapter';
