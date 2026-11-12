
import type {
  BrowserAdapter,
  TabInfo,
  ScriptExecutionOptions,
  PermissionRequest,
  StorageArea,
  BrowserCapabilities,
} from './types';

export class ChromeMV3Adapter implements BrowserAdapter {
  readonly browserType = 'chrome' as const;
  readonly name = 'chrome' as const;

  readonly capabilities: BrowserCapabilities = {
    hasScriptingApi: true,
    hasWebRequest: false,
    hasDeclarativeNetRequest: true,
    supportsSessionStorage: true,
  };

  private getStorageArea(area: StorageArea = 'local'): chrome.storage.StorageArea {
    if (area === 'session' && chrome.storage?.session) {
      return chrome.storage.session;
    }
    if (area === 'sync' && chrome.storage?.sync) {
      return chrome.storage.sync;
    }
    return chrome.storage.local;
  }

  async getActiveTab(): Promise<TabInfo | null> {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0 || !tabs[0]?.url) {
      tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    }
    if (!tabs || tabs.length === 0) return null;
    const t = tabs[0];
    if (!t || t.id === undefined) return null;

    return {
      id: t.id,
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      origin: t.url ? new URL(t.url).origin : undefined,
      windowId: t.windowId,
      incognito: Boolean(t.incognito),
      active: Boolean(t.active),
      status: t.status,
    };
  }

  async getTab(tabId: number): Promise<TabInfo | null> {
    try {
      const t = await chrome.tabs.get(tabId);
      if (!t || t.id === undefined) return null;
      return {
        id: t.id,
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl,
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
    const tabs = await chrome.tabs.query(query);
    return tabs
      .filter((t) => t.id !== undefined)
      .map((t) => ({
        id: t.id!,
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl,
        origin: t.url ? new URL(t.url).origin : undefined,
        windowId: t.windowId,
        incognito: Boolean(t.incognito),
        active: Boolean(t.active),
        status: t.status,
      }));
  }

  async reloadTab(tabId: number, options?: { bypassCache?: boolean; timeoutMs?: number; signal?: AbortSignal }): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.reload) {
      return;
    }

    const bypassCache = Boolean(options?.bypassCache);
    const timeoutMs = options?.timeoutMs ?? 15000;
    const signal = options?.signal;

    if (signal?.aborted) {
      throw signal.reason;
    }

    return new Promise<void>((resolve, reject) => {
      let timer: any = null;
      let cleanup: () => void = () => {};

      const handleUpdated = (updatedTabId: number, changeInfo: { status?: string }) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          cleanup();
          resolve();
        }
      };

      const handleRemoved = (removedTabId: number) => {
        if (removedTabId === tabId) {
          cleanup();
          reject(new Error('Target tab was closed while reloading'));
        }
      };

      const handleAbort = () => {
        cleanup();
        reject(signal?.reason || new Error('Tab reload cancelled'));
      };

      cleanup = () => {
        if (timer) clearTimeout(timer);
        if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
          chrome.tabs.onUpdated.removeListener(handleUpdated);
        }
        if (typeof chrome !== 'undefined' && chrome.tabs?.onRemoved) {
          chrome.tabs.onRemoved.removeListener(handleRemoved);
        }
        if (signal) {
          signal.removeEventListener('abort', handleAbort);
        }
      };

      if (signal) {
        signal.addEventListener('abort', handleAbort);
      }

      if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.addListener(handleUpdated);
      }
      if (typeof chrome !== 'undefined' && chrome.tabs?.onRemoved) {
        chrome.tabs.onRemoved.addListener(handleRemoved);
      }

      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);

      try {
        chrome.tabs.reload(tabId, { bypassCache }, () => {
          if (chrome.runtime?.lastError) {
            cleanup();
            reject(new Error(chrome.runtime.lastError.message));
          }
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  async executeScript<Args extends unknown[], R>(options: ScriptExecutionOptions<Args, R>): Promise<R[]> {
    const target: chrome.scripting.InjectionTarget = {
      tabId: options.tabId,
      allFrames: options.allFrames,
    };

    let results: chrome.scripting.InjectionResult<R>[];

    if (options.func) {
      results = await chrome.scripting.executeScript({
        target,
        world: options.world || 'ISOLATED',
        func: options.func,
        args: options.args as Args,
      });
    } else {
      const files = options.files || (options.file ? [options.file] : []);
      results = await chrome.scripting.executeScript({
        target,
        world: options.world || 'ISOLATED',
        files,
      });
    }

    return results.map((r) => r.result as R);
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
    const res = await chrome.permissions.contains(request as chrome.permissions.Permissions);
    return Boolean(res);
  }

  async requestPermissions(request: PermissionRequest): Promise<boolean> {
    const res = await chrome.permissions.request(request as chrome.permissions.Permissions);
    return Boolean(res);
  }

  async removePermissions(request: PermissionRequest): Promise<boolean> {
    const res = await chrome.permissions.remove(request as chrome.permissions.Permissions);
    return Boolean(res);
  }

  async getAllPermissions(): Promise<PermissionRequest> {
    const res = await chrome.permissions.getAll();
    return {
      permissions: res.permissions || [],
      origins: res.origins || [],
    };
  }

  async sendMessage<M = unknown, R = unknown>(message: M): Promise<R> {
    return (await chrome.runtime.sendMessage(message)) as R;
  }

  async sendTabMessage<M = unknown, R = unknown>(tabId: number, message: M): Promise<R> {
    return (await chrome.tabs.sendMessage(tabId, message)) as R;
  }

  getURL(path: string): string {
    return chrome.runtime.getURL(path);
  }
}

export { ChromeMV3Adapter as ChromeAdapter };
