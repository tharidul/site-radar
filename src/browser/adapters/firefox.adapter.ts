/**
 * @file src/browser/adapters/firefox.adapter.ts
 * @description Firefox Manifest V3 browser adapter wrapping browser.* / Gecko WebExtension APIs.
 */

import type {
  BrowserAdapter,
  TabInfo,
  ScriptExecutionOptions,
  PermissionRequest,
  StorageArea,
  BrowserCapabilities,
} from './types';

// Declare browser for Gecko runtime environments
declare const browser: any;

export class FirefoxMV3Adapter implements BrowserAdapter {
  readonly browserType = 'firefox' as const;
  readonly name = 'firefox' as const;

  readonly capabilities: BrowserCapabilities = {
    hasScriptingApi: true,
    hasWebRequest: true,
    hasDeclarativeNetRequest: true,
    supportsSessionStorage: true,
  };

  private get api() {
    return typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? (chrome as any) : null);
  }

  private getStorageArea(area: StorageArea = 'local'): any {
    const api = this.api;
    if (!api || !api.storage) {
      throw new Error('Extension storage API is not available in current environment');
    }
    if (area === 'session' && api.storage.session) {
      return api.storage.session;
    }
    if (area === 'sync' && api.storage.sync) {
      return api.storage.sync;
    }
    return api.storage.local;
  }

  async getActiveTab(): Promise<TabInfo | null> {
    const api = this.api;
    if (!api || !api.tabs) return null;
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0 || tabs[0].id === undefined) return null;
    const t = tabs[0];
    return {
      id: t.id,
      url: t.url,
      title: t.title,
      origin: t.url ? new URL(t.url).origin : undefined,
      windowId: t.windowId,
      incognito: Boolean(t.incognito),
      active: Boolean(t.active),
      status: t.status,
    };
  }

  async getTab(tabId: number): Promise<TabInfo | null> {
    const api = this.api;
    if (!api || !api.tabs) return null;
    try {
      const t = await api.tabs.get(tabId);
      if (!t || t.id === undefined) return null;
      return {
        id: t.id,
        url: t.url,
        title: t.title,
        origin: t.url ? new URL(t.url).origin : undefined,
        windowId: t.windowId,
        incognito: Boolean(t.incognito),
        active: Boolean(t.active),
        status: t.status,
      };
    } catch {
      return null;
    }
  }

  async queryTabs(query: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]> {
    const api = this.api;
    if (!api || !api.tabs) return [];
    const tabs = await api.tabs.query(query);
    return tabs
      .filter((t: any) => t.id !== undefined)
      .map((t: any) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        origin: t.url ? new URL(t.url).origin : undefined,
        windowId: t.windowId,
        incognito: Boolean(t.incognito),
        active: Boolean(t.active),
        status: t.status,
      }));
  }

  async executeScript<Args extends unknown[], R>(options: ScriptExecutionOptions<Args, R>): Promise<R[]> {
    const api = this.api;
    if (!api || !api.scripting) {
      throw new Error('Scripting API unavailable in current environment');
    }

    const target: any = {
      tabId: options.tabId,
      allFrames: options.allFrames,
    };

    const scriptDetails: any = { target };
    if (options.world) {
      scriptDetails.world = options.world;
    }

    if (options.func) {
      scriptDetails.func = options.func;
      scriptDetails.args = options.args;
    } else if (options.files) {
      scriptDetails.files = options.files;
    } else if (options.file) {
      scriptDetails.files = [options.file];
    }

    const results = await api.scripting.executeScript(scriptDetails);
    return results ? results.map((r: any) => r.result as R) : [];
  }

  async getStorage<T = unknown>(keys: string | string[] | null, area: StorageArea = 'local'): Promise<Record<string, T>> {
    const storageArea = this.getStorageArea(area);
    return (await storageArea.get(keys)) as Record<string, T>;
  }

  async setStorage(items: Record<string, unknown>, area: StorageArea = 'local'): Promise<void> {
    const storageArea = this.getStorageArea(area);
    await storageArea.set(items);
  }

  async removeStorage(keys: string | string[], area: StorageArea = 'local'): Promise<void> {
    const storageArea = this.getStorageArea(area);
    await storageArea.remove(keys);
  }

  async clearStorage(area: StorageArea = 'local'): Promise<void> {
    const storageArea = this.getStorageArea(area);
    await storageArea.clear();
  }

  async hasPermissions(request: PermissionRequest): Promise<boolean> {
    const api = this.api;
    if (!api || !api.permissions) return false;
    return await api.permissions.contains(request);
  }

  async requestPermissions(request: PermissionRequest): Promise<boolean> {
    const api = this.api;
    if (!api || !api.permissions) return false;
    return await api.permissions.request(request);
  }

  async removePermissions(request: PermissionRequest): Promise<boolean> {
    const api = this.api;
    if (!api || !api.permissions) return false;
    return await api.permissions.remove(request);
  }

  async sendMessage<M = unknown, R = unknown>(message: M): Promise<R> {
    const api = this.api;
    if (!api || !api.runtime) {
      throw new Error('Runtime messaging unavailable');
    }
    return (await api.runtime.sendMessage(message)) as R;
  }

  async sendTabMessage<M = unknown, R = unknown>(tabId: number, message: M): Promise<R> {
    const api = this.api;
    if (!api || !api.tabs) {
      throw new Error('Tabs messaging unavailable');
    }
    return (await api.tabs.sendMessage(tabId, message)) as R;
  }

  getURL(path: string): string {
    const api = this.api;
    if (!api || !api.runtime) {
      return path;
    }
    return api.runtime.getURL(path);
  }
}

export { FirefoxMV3Adapter as FirefoxAdapter };
