import type { BrowserAdapter } from '../types/browser';

export const BROWSER_PERMISSION_SESSION_KEY = 'siteradar_browser_session_id';
export const PENDING_PERMISSION_SCAN_KEY = 'siteradar_pending_permission_scan';
const PENDING_PERMISSION_SCAN_TTL_MS = 2 * 60 * 1000;

export interface PendingPermissionScan {
  origins: string[];
  mode: 'full' | 'deep';
  tabId?: number;
  url?: string;
  refreshPage?: boolean;
  createdAt: number;
}

let inFlightSessionInit: Promise<void> | null = null;

function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function supportsSessionStorage(adapter: BrowserAdapter): boolean {
  if (adapter.capabilities) {
    return adapter.capabilities.supportsSessionStorage;
  }
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.session);
}

/**
 * Revokes all runtime-granted optional host origins so site permissions do not
 * persist across browser restarts.
 */
export async function revokeAllGrantedOrigins(adapter: BrowserAdapter): Promise<string[]> {
  try {
    const granted = await adapter.getAllPermissions();
    const origins = (granted.origins || []).filter(
      (origin) => origin.startsWith('http://') || origin.startsWith('https://') || origin === '*://*/*' || origin === '<all_urls>',
    );

    if (origins.length === 0) {
      return [];
    }

    try {
      const removed = await adapter.removePermissions({ origins });
      if (removed) {
        return origins;
      }
    } catch {
      // Fall back to per-origin removal if one pattern cannot be removed in bulk
    }

    const removedList: string[] = [];
    for (const origin of origins) {
      try {
        if (await adapter.removePermissions({ origins: [origin] })) {
          removedList.push(origin);
        }
      } catch {
        // Ignore non-removable origins
      }
    }
    return removedList;
  } catch {
    return [];
  }
}

/**
 * Resets all granted website permissions and starts a fresh session marker.
 * Intended for browser startup / extension install handlers.
 */
export async function resetGrantedOriginPermissionsOnStartup(
  adapter: BrowserAdapter,
): Promise<string[]> {
  const revoked = await revokeAllGrantedOrigins(adapter);
  if (supportsSessionStorage(adapter)) {
    try {
      await adapter.setStorage(
        { [BROWSER_PERMISSION_SESSION_KEY]: generateSessionToken() },
        'session',
      );
    } catch {
      // Best-effort session marker write
    }
  }
  return revoked;
}

/**
 * Ensures any host permissions lingering from a closed browser session are
 * revoked when a new browser session begins (detected via `storage.session`,
 * which the browser clears automatically on close).
 */
export async function ensureEphemeralBrowserSessionPermissions(
  adapter: BrowserAdapter,
): Promise<void> {
  if (!supportsSessionStorage(adapter)) {
    return;
  }

  if (inFlightSessionInit) {
    return inFlightSessionInit;
  }

  inFlightSessionInit = (async () => {
    try {
      const stored = await adapter.getStorage<string>(
        [BROWSER_PERMISSION_SESSION_KEY],
        'session',
      );
      if (stored?.[BROWSER_PERMISSION_SESSION_KEY]) {
        return;
      }

      await revokeAllGrantedOrigins(adapter);
      await adapter.setStorage(
        { [BROWSER_PERMISSION_SESSION_KEY]: generateSessionToken() },
        'session',
      );
    } catch {
      // Best-effort cleanup
    } finally {
      inFlightSessionInit = null;
    }
  })();

  return inFlightSessionInit;
}

/**
 * Persists pending scan parameters right before triggering a runtime permission
 * prompt so background `permissions.onAdded` can auto-start the scan if the
 * popup closes while the user confirms the native browser prompt.
 */
export async function savePendingPermissionScan(
  adapter: BrowserAdapter,
  pending: PendingPermissionScan,
): Promise<void> {
  if (!supportsSessionStorage(adapter)) {
    return;
  }
  try {
    await adapter.setStorage({ [PENDING_PERMISSION_SCAN_KEY]: pending }, 'session');
  } catch {
    // Best-effort persistence
  }
}

export async function clearPendingPermissionScan(adapter: BrowserAdapter): Promise<void> {
  if (!supportsSessionStorage(adapter)) {
    return;
  }
  try {
    await adapter.removeStorage(PENDING_PERMISSION_SCAN_KEY, 'session');
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Reads and clears a matching pending permission scan when new host origins
 * are granted. Returns null if absent, expired, or unrelated to the granted origins.
 */
export async function consumePendingPermissionScan(
  adapter: BrowserAdapter,
  addedOrigins?: string[],
): Promise<PendingPermissionScan | null> {
  if (!supportsSessionStorage(adapter)) {
    return null;
  }

  try {
    const stored = await adapter.getStorage<PendingPermissionScan>(
      [PENDING_PERMISSION_SCAN_KEY],
      'session',
    );
    const pending = stored?.[PENDING_PERMISSION_SCAN_KEY];
    if (!pending || typeof pending !== 'object') {
      return null;
    }

    const isExpired =
      typeof pending.createdAt !== 'number' ||
      Date.now() - pending.createdAt > PENDING_PERMISSION_SCAN_TTL_MS;
    if (isExpired) {
      await clearPendingPermissionScan(adapter);
      return null;
    }

    if (addedOrigins && addedOrigins.length > 0 && Array.isArray(pending.origins)) {
      const grantedSet = new Set(addedOrigins);
      const matches =
        grantedSet.has('*://*/*') ||
        grantedSet.has('<all_urls>') ||
        pending.origins.some((origin) => grantedSet.has(origin));
      if (!matches) {
        return null;
      }
    }

    await clearPendingPermissionScan(adapter);
    return pending;
  } catch {
    return null;
  }
}

