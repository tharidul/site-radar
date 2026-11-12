
import type {
  BrowserAdapter,
  TabInfo,
  ScriptExecutionOptions,
  PermissionRequest,
  StorageArea,
  BrowserCapabilities,
} from './types';

export class MockBrowserAdapter implements BrowserAdapter {
  readonly browserType = 'mock' as const;
  readonly name = 'mock' as const;

  readonly capabilities: BrowserCapabilities = {
    hasScriptingApi: true,
    hasWebRequest: true,
    hasDeclarativeNetRequest: true,
    supportsSessionStorage: true,
  };

  public tabs: Map<number, TabInfo> = new Map();
  public storage: Record<StorageArea, Map<string, unknown>> = {
    local: new Map(),
    session: new Map(),
    sync: new Map(),
  };
  public grantedPermissions: PermissionRequest = { permissions: [], origins: [] };
  public injectedScripts: Array<ScriptExecutionOptions<any, any>> = [];
  public messageHandlers: Array<(msg: any) => any> = [];
  public tabMessageHandlers: Map<number, Array<(msg: any) => any>> = new Map();

  setMockTab(tab: TabInfo): void {
    const origin = tab.origin || (tab.url ? new URL(tab.url).origin : undefined);
    this.tabs.set(tab.id, { ...tab, origin });
  }

  addMessageHandler(handler: (msg: any) => any): void {
    this.messageHandlers.push(handler);
  }

  addTabMessageHandler(tabId: number, handler: (msg: any) => any): void {
    if (!this.tabMessageHandlers.has(tabId)) {
      this.tabMessageHandlers.set(tabId, []);
    }
    this.tabMessageHandlers.get(tabId)!.push(handler);
  }

  async getActiveTab(): Promise<TabInfo | null> {
    for (const tab of this.tabs.values()) {
      if (tab.active) return { ...tab };
    }
    return null;
  }

  async getTab(tabId: number): Promise<TabInfo | null> {
    const t = this.tabs.get(tabId);
    return t ? { ...t } : null;
  }

  async queryTabs(query: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]> {
    return Array.from(this.tabs.values())
      .filter((t) => {
        if (query.active !== undefined && t.active !== query.active) return false;
        return true;
      })
      .map((t) => ({ ...t }));
  }

  async reloadTab(tabId: number, options?: { bypassCache?: boolean; timeoutMs?: number; signal?: AbortSignal }): Promise<void> {
    if (options?.signal?.aborted) throw options.signal.reason;
    const t = this.tabs.get(tabId);
    if (t) {
      t.status = 'complete';
    }
  }

  async executeScript<Args extends unknown[], R>(options: ScriptExecutionOptions<Args, R>): Promise<R[]> {
    this.injectedScripts.push(options);
    if (options.func) {
      const args = options.args || ([] as unknown as Args);
      const res = options.func(...args);
      return [res];
    }
    return [] as R[];
  }

  async getStorage<T = unknown>(keys: string | string[] | null, area: StorageArea = 'local'): Promise<Record<string, T>> {
    const map = this.storage[area];
    const out: Record<string, T> = {};
    if (keys === null) {
      for (const [k, v] of map.entries()) {
        out[k] = v as T;
      }
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        if (map.has(k)) out[k] = map.get(k) as T;
      }
    } else if (typeof keys === 'string') {
      if (map.has(keys)) out[keys] = map.get(keys) as T;
    }
    return out;
  }

  async setStorage(items: Record<string, unknown>, area: StorageArea = 'local'): Promise<void> {
    const map = this.storage[area];
    for (const [k, v] of Object.entries(items)) {
      map.set(k, v);
    }
  }

  async removeStorage(keys: string | string[], area: StorageArea = 'local'): Promise<void> {
    const map = this.storage[area];
    const keyArr = Array.isArray(keys) ? keys : [keys];
    for (const k of keyArr) {
      map.delete(k);
    }
  }

  async clearStorage(area: StorageArea = 'local'): Promise<void> {
    this.storage[area].clear();
  }

  async hasPermissions(request: PermissionRequest): Promise<boolean> {
    const perms = request.permissions || [];
    const origins = request.origins || [];
    const hasPerms = perms.every((p) => this.grantedPermissions.permissions?.includes(p));
    const hasOrigins = origins.every((o) => this.grantedPermissions.origins?.includes(o));
    return hasPerms && hasOrigins;
  }

  async requestPermissions(request: PermissionRequest): Promise<boolean> {
    this.grantedPermissions.permissions = [
      ...(this.grantedPermissions.permissions || []),
      ...(request.permissions || []),
    ];
    this.grantedPermissions.origins = [
      ...(this.grantedPermissions.origins || []),
      ...(request.origins || []),
    ];
    return true;
  }

  async removePermissions(request: PermissionRequest): Promise<boolean> {
    const toRemovePerms = new Set(request.permissions || []);
    const toRemoveOrigins = new Set(request.origins || []);
    this.grantedPermissions.permissions = (this.grantedPermissions.permissions || []).filter(
      (p) => !toRemovePerms.has(p),
    );
    this.grantedPermissions.origins = (this.grantedPermissions.origins || []).filter(
      (o) => !toRemoveOrigins.has(o),
    );
    return true;
  }

  async getAllPermissions(): Promise<PermissionRequest> {
    return {
      permissions: [...(this.grantedPermissions.permissions || [])],
      origins: [...(this.grantedPermissions.origins || [])],
    };
  }

  async sendMessage<M = unknown, R = unknown>(message: M): Promise<R> {
    for (const handler of this.messageHandlers) {
      const res = await handler(message);
      if (res !== undefined) return res;
    }
    return {} as R;
  }

  async sendTabMessage<M = unknown, R = unknown>(tabId: number, message: M): Promise<R> {
    const handlers = this.tabMessageHandlers.get(tabId);
    if (handlers) {
      for (const handler of handlers) {
        const res = await handler(message);
        if (res !== undefined) return res;
      }
    }
    return this.sendMessage(message);
  }

  getURL(path: string): string {
    return `chrome-extension://mock-extension-id/${path.replace(/^\//, '')}`;
  }
}
