
export type BrowserName = 'chrome' | 'firefox' | 'mock';

export interface TabInfo {
  id: number;
  url?: string;
  title?: string;
  origin?: string;
  windowId?: number;
  incognito: boolean;
  active: boolean;
  status?: string;
}

export type BrowserTab = TabInfo;

export interface PermissionRequest {
  permissions?: string[];
  origins?: string[];
}

export interface ScriptExecutionOptions<Args extends unknown[] = unknown[], R = unknown> {
  tabId: number;
  file?: string;
  files?: string[];
  func?: (...args: Args) => R;
  args?: Args;
  world?: 'ISOLATED' | 'MAIN';
  allFrames?: boolean;
}

export type ExecuteScriptOptions<Args extends unknown[] = unknown[], R = unknown> = ScriptExecutionOptions<Args, R>;

export type StorageArea = 'local' | 'session' | 'sync';

export interface BrowserCapabilities {
  hasScriptingApi: boolean;
  hasWebRequest: boolean;
  hasDeclarativeNetRequest: boolean;
  supportsSessionStorage: boolean;
}

export interface BrowserAdapter {
  readonly browserType: BrowserName;
  readonly name?: BrowserName;

  readonly capabilities?: BrowserCapabilities;

  getTab(tabId: number): Promise<TabInfo | null>;

  getActiveTab(): Promise<TabInfo | null>;

  queryTabs(query: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]>;

  reloadTab(tabId: number, options?: { bypassCache?: boolean; timeoutMs?: number; signal?: AbortSignal }): Promise<void>;

  executeScript<Args extends unknown[], R>(options: ScriptExecutionOptions<Args, R>): Promise<R[]>;

  getStorage<T = unknown>(keys: string | string[] | null, area?: StorageArea): Promise<Record<string, T>>;

  setStorage(items: Record<string, unknown>, area?: StorageArea): Promise<void>;

  removeStorage(keys: string | string[], area?: StorageArea): Promise<void>;

  clearStorage(area?: StorageArea): Promise<void>;

  requestPermissions(permissions: PermissionRequest): Promise<boolean>;

  hasPermissions(permissions: PermissionRequest): Promise<boolean>;

  removePermissions(permissions: PermissionRequest): Promise<boolean>;

  getAllPermissions(): Promise<PermissionRequest>;

  sendMessage<M = unknown, R = unknown>(message: M): Promise<R>;

  sendTabMessage<M = unknown, R = unknown>(tabId: number, message: M): Promise<R>;

  getURL(path: string): string;
}
