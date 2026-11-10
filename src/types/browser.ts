/**
 * @file src/types/browser.ts
 * @description Browser abstraction layer contracts encapsulating Chrome MV3
 * and Firefox MV3 API differences behind a unified adapter interface.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 7.
 */

/**
 * Supported browser engine / flavor identifiers.
 */
export type BrowserName = 'chrome' | 'firefox' | 'mock';

/**
 * Normalized browser tab representation.
 */
export interface TabInfo {
  /** Tab identifier assigned by the browser */
  id: number;
  /** Full URL of the document loaded in the tab */
  url?: string;
  /** Document title */
  title?: string;
  /** Protocol, host, and port origin */
  origin?: string;
  /** Window identifier containing the tab */
  windowId?: number;
  /** Whether the tab is running in an incognito / private browsing window */
  incognito: boolean;
  /** Whether this tab is active within its window */
  active: boolean;
  /** Tab loading status */
  status?: string;
}

/** Alias for BrowserTab to maintain compatibility across modules */
export type BrowserTab = TabInfo;

/**
 * Permission request payload for optional permissions and host origins.
 */
export interface PermissionRequest {
  /** Optional API permissions (e.g. 'storage') */
  permissions?: string[];
  /** Origin match patterns (e.g. ['https://example.com/*']) */
  origins?: string[];
}

/**
 * Script execution options for content script or function injection.
 */
export interface ScriptExecutionOptions<Args extends unknown[] = unknown[], R = unknown> {
  /** ID of the target tab where script should be injected */
  tabId: number;
  /** Extension path to a JS file to inject (optional if func is provided) */
  file?: string;
  /** Files array alternative */
  files?: string[];
  /** Function to execute inside the tab context */
  func?: (...args: Args) => R;
  /** Arguments to pass into the injected function */
  args?: Args;
  /** Execution world: 'ISOLATED' for extension content script, 'MAIN' for page context */
  world?: 'ISOLATED' | 'MAIN';
  /** Whether to inject into all subframes in addition to main frame */
  allFrames?: boolean;
}

/** Alias for ExecuteScriptOptions */
export type ExecuteScriptOptions<Args extends unknown[] = unknown[], R = unknown> = ScriptExecutionOptions<Args, R>;

/**
 * Extension storage area identifier.
 */
export type StorageArea = 'local' | 'session' | 'sync';

/**
 * Feature capability flags detected for the active browser environment.
 */
export interface BrowserCapabilities {
  /** Supports chrome.scripting or browser.scripting */
  hasScriptingApi: boolean;
  /** Supports webRequest API (subject to MV3 limitations) */
  hasWebRequest: boolean;
  /** Supports declarativeNetRequest API */
  hasDeclarativeNetRequest: boolean;
  /** Supports session storage via extension storage API */
  supportsSessionStorage: boolean;
}

/**
 * Universal browser abstraction adapter interface.
 * Implemented separately for Chrome (ChromeMV3Adapter), Firefox (FirefoxMV3Adapter), and testing (MockBrowserAdapter).
 */
export interface BrowserAdapter {
  /** Name of the active browser flavor */
  readonly browserType: BrowserName;
  readonly name?: BrowserName;

  /** Capability flags for current browser */
  readonly capabilities?: BrowserCapabilities;

  /**
   * Retrieves tab information for a specified tab ID.
   * @param tabId Target tab identifier.
   * @returns TabInfo or null if not found.
   */
  getTab(tabId: number): Promise<TabInfo | null>;

  /**
   * Retrieves the currently active tab in the current window.
   * @returns Active TabInfo or null if none active.
   */
  getActiveTab(): Promise<TabInfo | null>;

  /**
   * Queries tabs matching criteria.
   */
  queryTabs(query: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]>;

  /**
   * Reloads a specified tab and waits for it to finish loading.
   * @param tabId Target tab identifier.
   * @param options Reload and timeout settings.
   */
  reloadTab(tabId: number, options?: { bypassCache?: boolean; timeoutMs?: number; signal?: AbortSignal }): Promise<void>;

  /**
   * Executes a script or function in the specified tab context.
   * @param options Script injection parameters.
   * @returns Return values array of the injected function per frame.
   */
  executeScript<Args extends unknown[], R>(options: ScriptExecutionOptions<Args, R>): Promise<R[]>;

  /**
   * Retrieves items from extension storage (local or session).
   * @param keys Keys to retrieve, or null for all keys.
   * @param area Storage area ('local' | 'session' | 'sync')
   */
  getStorage<T = unknown>(keys: string | string[] | null, area?: StorageArea): Promise<Record<string, T>>;

  /**
   * Stores items into extension storage.
   * @param items Key-value pairs to persist.
   * @param area Storage area ('local' | 'session' | 'sync')
   */
  setStorage(items: Record<string, unknown>, area?: StorageArea): Promise<void>;

  /**
   * Removes items from extension storage.
   * @param keys Key or array of keys to remove.
   * @param area Storage area ('local' | 'session' | 'sync')
   */
  removeStorage(keys: string | string[], area?: StorageArea): Promise<void>;

  /**
   * Clears all items from extension storage in given area.
   * @param area Storage area ('local' | 'session' | 'sync')
   */
  clearStorage(area?: StorageArea): Promise<void>;

  /**
   * Prompts user for optional permissions or host origins.
   * @param permissions Permission set requested.
   * @returns True if granted, false if denied.
   */
  requestPermissions(permissions: PermissionRequest): Promise<boolean>;

  /**
   * Checks whether the extension currently possesses the specified permissions.
   * @param permissions Permission set to check.
   */
  hasPermissions(permissions: PermissionRequest): Promise<boolean>;

  /**
   * Removes optional permissions previously granted.
   * @param permissions Permission set to remove.
   */
  removePermissions(permissions: PermissionRequest): Promise<boolean>;

  /**
   * Sends a message to the runtime / background.
   * @param message Message payload.
   */
  sendMessage<M = unknown, R = unknown>(message: M): Promise<R>;

  /**
   * Sends a message to a specific tab content script.
   * @param tabId Destination tab ID.
   * @param message Message payload.
   */
  sendTabMessage<M = unknown, R = unknown>(tabId: number, message: M): Promise<R>;

  /**
   * Converts an extension relative path to a fully qualified URL.
   * @param path Relative path within the extension.
   */
  getURL(path: string): string;
}
