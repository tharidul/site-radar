import type { BrowserAdapter } from '../types/browser';

export const BROWSER_PERMISSION_SESSION_KEY = 'siteradar_browser_session_id';

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

