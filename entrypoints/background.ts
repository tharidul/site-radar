
import { defineBackground } from 'wxt/utils/define-background';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { isInternalExtensionSender, messageBus } from '../src/messaging/bus';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import { consentManager } from '../src/intelligence';
import { BadgeService } from '../src/services/badge.service';
import { getBrowserAdapter } from '../src/browser/adapters';
import {
  clearPendingPermissionScan,
  consumePendingPermissionScan,
  ensureEphemeralBrowserSessionPermissions,
  resetGrantedOriginPermissionsOnStartup,
} from '../src/security/ephemeral-permissions';
import type { CrawlLimits } from '../src/types/crawler';
import type { InspectionMode } from '../src/types/inspection';
import type { IntelligenceProviderType } from '../src/types/intelligence';

type StoredCrawlLimits = Partial<CrawlLimits> & { timeoutSeconds?: number };

function normalizeCrawlLimits(raw?: StoredCrawlLimits | null): Partial<CrawlLimits> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const normalized: Partial<CrawlLimits> = {};

  if (typeof raw.maxPages === 'number' && Number.isFinite(raw.maxPages) && raw.maxPages > 0) {
    normalized.maxPages = raw.maxPages;
  }
  if (typeof raw.maxDepth === 'number' && Number.isFinite(raw.maxDepth) && raw.maxDepth > 0) {
    normalized.maxDepth = raw.maxDepth;
  }
  if (typeof raw.concurrency === 'number' && Number.isFinite(raw.concurrency) && raw.concurrency > 0) {
    normalized.concurrency = raw.concurrency;
  }
  if (
    typeof raw.perPageTimeoutMs === 'number' &&
    Number.isFinite(raw.perPageTimeoutMs) &&
    raw.perPageTimeoutMs > 0
  ) {
    normalized.perPageTimeoutMs = raw.perPageTimeoutMs;
  } else if (
    typeof raw.timeoutSeconds === 'number' &&
    Number.isFinite(raw.timeoutSeconds) &&
    raw.timeoutSeconds > 0
  ) {
    normalized.perPageTimeoutMs = raw.timeoutSeconds * 1000;
  }
  if (
    typeof raw.maxSitemapEntries === 'number' &&
    Number.isFinite(raw.maxSitemapEntries) &&
    raw.maxSitemapEntries > 0
  ) {
    normalized.maxSitemapEntries = raw.maxSitemapEntries;
  }
  if (typeof raw.retryCount === 'number' && Number.isFinite(raw.retryCount) && raw.retryCount >= 0) {
    normalized.retryCount = raw.retryCount;
  }
  if (
    typeof raw.maxRedirects === 'number' &&
    Number.isFinite(raw.maxRedirects) &&
    raw.maxRedirects >= 0
  ) {
    normalized.maxRedirects = raw.maxRedirects;
  }
  if (typeof raw.sameOriginOnly === 'boolean') {
    normalized.sameOriginOnly = raw.sameOriginOnly;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isAuthorizedBackgroundSender(sender?: chrome.runtime.MessageSender | null): boolean {
  if (sender?.id === 'mock-sender' && (typeof chrome === 'undefined' || !chrome.runtime?.id)) {
    return true;
  }
  return isInternalExtensionSender(sender);
}

export default defineBackground(() => {
  void consentManager.ensureLoaded();
  void ensureEphemeralBrowserSessionPermissions(getBrowserAdapter());

  // Track tabs that currently have an active or completed audit badge
  const badgedTabIds = new Set<number>();

  const clearKeepaliveAlarm = (scanId: string) => {
    if (typeof chrome !== 'undefined' && chrome.alarms?.clear) {
      chrome.alarms.clear(`siteradar_keepalive_${scanId}`, () => {});
    }
  };

  const startBackgroundInspection = async (params: {
    mode: InspectionMode;
    tabId?: number;
    crawlLimits?: StoredCrawlLimits;
    externalConsent?: Record<string, boolean>;
    refreshPage?: boolean;
  }): Promise<{ success: boolean; scanId: string; error?: string }> => {
    const adapter = getBrowserAdapter();
    await clearPendingPermissionScan(adapter);

    const existing =
      typeof params.tabId === 'number'
        ? inspectionOrchestrator.getSession(undefined, params.tabId)
        : undefined;
    if (existing?.state === 'running') {
      return { success: true, scanId: existing.scanId };
    }

    const stored = await adapter
      .getStorage<StoredCrawlLimits>(['crawlLimits'])
      .catch(() => null);
    const storedLimits = normalizeCrawlLimits(stored?.crawlLimits);
    const payloadLimits = normalizeCrawlLimits(params.crawlLimits);
    const mergedLimits = { ...storedLimits, ...payloadLimits };
    const crawlLimits = Object.keys(mergedLimits).length > 0 ? mergedLimits : undefined;

    const options = {
      crawlLimits,
      externalConsent: params.externalConsent as any,
      refreshPage: params.refreshPage,
    };

    const inspectionPromise = inspectionOrchestrator.startInspection(params.mode, params.tabId, options);
    const session = inspectionOrchestrator.getSession();
    const scanId = session?.scanId || `scan_${Date.now()}`;

    if (typeof params.tabId === 'number' && params.tabId >= 0) {
      badgedTabIds.add(params.tabId);
    } else if (typeof session?.tabId === 'number' && session.tabId >= 0) {
      badgedTabIds.add(session.tabId);
    }

    // Schedule keepalive alarm to prevent MV3 idle termination during active scans
    if (typeof chrome !== 'undefined' && chrome.alarms?.create) {
      chrome.alarms.create(`siteradar_keepalive_${scanId}`, {
        periodInMinutes: 0.4,
      });
    }

    inspectionPromise
      .then(() => {
        const settledSession = inspectionOrchestrator.getSession(scanId);
        if (typeof settledSession?.tabId === 'number' && settledSession.tabId >= 0) {
          badgedTabIds.add(settledSession.tabId);
        }
      })
      .catch((err) => {
        const failedSession = inspectionOrchestrator.getSession(scanId);
        const failedTabId = failedSession?.tabId ?? params.tabId;
        if (typeof failedTabId === 'number') {
          badgedTabIds.delete(failedTabId);
        }
        console.warn('Inspection execution error:', err);
      })
      .finally(() => {
        clearKeepaliveAlarm(scanId);
      });

    return { success: true, scanId };
  };

  messageBus.onMessage(
    MESSAGE_CHANNELS.START_INSPECTION,
    async (payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        return {
          success: false,
          scanId: '',
          error: 'Unauthorized: Content scripts cannot initiate inspections',
        };
      }

      try {
        await consentManager.ensureLoaded();

        const mode: InspectionMode = payload?.mode === 'deep' ? 'deep' : 'full';
        const tabId = payload?.tabId;

        return await startBackgroundInspection({
          mode,
          tabId,
          crawlLimits: payload?.crawlLimits as StoredCrawlLimits | undefined,
          externalConsent: payload?.externalConsent,
          refreshPage: payload?.refreshPage,
        });
      } catch (err: any) {
        return { success: false, scanId: '', error: err?.message || 'Failed to start inspection' };
      }
    },
    { requireInternalSender: true },
  );

  // Auto-resume a pending scan when the user grants optional host permissions
  // (e.g. Chrome's native permission prompt closed the popup mid-click).
  const handlePermissionsAdded = async (added: { origins?: string[] }) => {
    try {
      const adapter = getBrowserAdapter();
      const pending = await consumePendingPermissionScan(adapter, added?.origins);
      if (!pending) {
        return;
      }
      await consentManager.ensureLoaded();
      await startBackgroundInspection({
        mode: pending.mode === 'deep' ? 'deep' : 'full',
        tabId: pending.tabId,
        refreshPage: pending.refreshPage,
      });
    } catch (err) {
      console.warn('Failed to auto-start inspection after permission grant:', err);
    }
  };

  try {
    const browserPermsApi = (globalThis as { browser?: { permissions?: { onAdded?: { addListener?: (cb: (p: { origins?: string[] }) => void) => void } } } }).browser?.permissions?.onAdded;
    if (typeof chrome !== 'undefined' && chrome.permissions?.onAdded?.addListener) {
      chrome.permissions.onAdded.addListener(handlePermissionsAdded);
    } else if (typeof browserPermsApi?.addListener === 'function') {
      browserPermsApi.addListener(handlePermissionsAdded);
    }
  } catch {
    // Ignore in environments where permissions.onAdded is stubbed as unimplemented
  }

  messageBus.onMessage(
    MESSAGE_CHANNELS.CANCEL_INSPECTION,
    async (payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        return {
          success: false,
          error: 'Unauthorized: Content scripts cannot cancel inspections',
        };
      }
      const scanId = payload?.scanId;
      if (!scanId) {
        return { success: false, error: 'scanId is required to cancel' };
      }
      clearKeepaliveAlarm(scanId);
      const session = inspectionOrchestrator.getSession(scanId);
      const cancelled = inspectionOrchestrator.cancelInspection(scanId);
      if (cancelled && typeof session?.tabId === 'number') {
        badgedTabIds.delete(session.tabId);
      }
      return { success: cancelled };
    },
    { requireInternalSender: true },
  );

  messageBus.onMessage(
    MESSAGE_CHANNELS.GET_INSPECTION_STATE,
    async (payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        throw new Error('Unauthorized: Content scripts cannot access inspection state');
      }
      let session = inspectionOrchestrator.getSession(payload?.scanId, payload?.tabId, payload?.url);
      if (!session) {
        session = await inspectionOrchestrator.restoreFromStorage(payload?.tabId, payload?.url);
      }
      return {
        state: session?.state || 'idle',
        inspection: session?.inspection,
        progress: session?.progress,
        targetUrl: session?.targetUrl,
      };
    },
    { requireInternalSender: true },
  );

  messageBus.onMessage(
    MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE,
    async (_payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        return { success: false };
      }
      badgedTabIds.clear();
      inspectionOrchestrator.clearSessions();
      return { success: true };
    },
    { requireInternalSender: true },
  );

  messageBus.onMessage(
    MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
    async (payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        throw new Error('Unauthorized: Content scripts cannot read consent state');
      }
      await consentManager.ensureLoaded();
      const provider = payload?.provider as IntelligenceProviderType;
      const granted = consentManager.hasConsent(provider);
      return { granted };
    },
    { requireInternalSender: true },
  );

  messageBus.onMessage(
    MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT,
    async (payload, sender) => {
      if (!isAuthorizedBackgroundSender(sender)) {
        return { success: false };
      }
      const provider = payload?.provider as IntelligenceProviderType;
      const granted = Boolean(payload?.granted);
      await consentManager.setConsent(provider, granted);
      return { success: true };
    },
    { requireInternalSender: true },
  );

  if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      badgedTabIds.clear();
      inspectionOrchestrator.clearSessions();
      BadgeService.clear();
      void resetGrantedOriginPermissionsOnStartup(getBrowserAdapter());
    });
  }

  if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      // Skip irrelevant updates (title, favicon, audible, status='complete', etc.)
      if (!changeInfo.url && changeInfo.status !== 'loading') {
        return;
      }

      // Only clear badges on tabs that have an active or audited badge
      if (!badgedTabIds.has(tabId)) {
        return;
      }

      const activeSession = inspectionOrchestrator.getSession(undefined, tabId);
      // Avoid wiping the scanning badge while an active scan reloads its target tab
      if (activeSession?.state === 'running' && !changeInfo.url) {
        return;
      }

      badgedTabIds.delete(tabId);
      BadgeService.clear(tabId);
    });
  }

  if (typeof chrome !== 'undefined' && chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (badgedTabIds.delete(tabId)) {
        BadgeService.clear(tabId);
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener((details) => {
      badgedTabIds.clear();
      inspectionOrchestrator.clearSessions();
      void resetGrantedOriginPermissionsOnStartup(getBrowserAdapter());

      // On first install, open the onboarding & MCP welcome tab
      if (details.reason === 'install') {
        try {
          if (chrome.tabs?.create && chrome.runtime?.getURL) {
            chrome.tabs.create({
              url: chrome.runtime.getURL('options.html#welcome'),
              active: true,
            });
          }
        } catch (err) {
          console.warn('Failed to open welcome onboarding tab:', err);
        }
      }

      if (chrome.contextMenus) {
        const registerContextMenus = () => {
          try {
            chrome.contextMenus.create(
              {
                id: 'open-side-panel',
                title: 'Open SiteRadar in Side Panel',
                contexts: ['all'],
              },
              () => {
                void chrome.runtime?.lastError;
              },
            );
          } catch {
          }
        };

        try {
          if (typeof chrome.contextMenus.removeAll === 'function') {
            chrome.contextMenus.removeAll(() => {
              void chrome.runtime?.lastError;
              registerContextMenus();
            });
          } else {
            registerContextMenus();
          }
        } catch {
        }
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === 'open-side-panel' && tab?.windowId && (chrome as any).sidePanel?.open) {
        try {
          await (chrome as any).sidePanel.open({ windowId: tab.windowId });
        } catch (err) {
          console.warn('Failed to open side panel from context menu:', err);
        }
      }
    });
  }

  // CRIT-03: Register onConnect listener for UI-driven port keepalive
  if (typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'siteradar-scan-keepalive') {
        if (!isInternalExtensionSender(port.sender)) {
          try {
            port.disconnect();
          } catch {}
          return;
        }
        port.onMessage.addListener((msg) => {
          if (msg === 'PING' || (msg && typeof msg === 'object' && (msg as any).type === 'PING')) {
            try {
              port.postMessage({ type: 'PONG', timestamp: Date.now() });
            } catch {}
          }
        });
      }
    });
  }

  // CRIT-03: Register onAlarm listener for background alarm keepalive
  if (typeof chrome !== 'undefined' && chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name.startsWith('siteradar_keepalive_')) {
        const scanId = alarm.name.replace('siteradar_keepalive_', '');
        const session = inspectionOrchestrator.getSession(scanId);
        if (!session || session.state !== 'running') {
          clearKeepaliveAlarm(scanId);
        }
      }
    });
  }
});
