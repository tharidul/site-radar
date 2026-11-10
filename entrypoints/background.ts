
import { defineBackground } from 'wxt/utils/define-background';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import { consentManager } from '../src/intelligence';
import type { IntelligenceProviderType } from '../src/types/intelligence';

export default defineBackground(() => {
  messageBus.onMessage(MESSAGE_CHANNELS.START_INSPECTION, async (payload) => {
    try {
      const mode = payload?.mode || 'quick';
      const tabId = payload?.tabId;
      const options = {
        crawlLimits: payload?.crawlLimits,
        externalConsent: payload?.externalConsent,
        refreshPage: payload?.refreshPage,
      };

      const inspectionPromise = inspectionOrchestrator.startInspection(mode, tabId, options);
      const session = inspectionOrchestrator.getSession();
      const scanId = session?.scanId || `scan_${Date.now()}`;
      inspectionPromise.catch((err) => {
        console.warn('Inspection execution error:', err);
      });
      return { success: true, scanId };
    } catch (err: any) {
      return { success: false, scanId: '', error: err?.message || 'Failed to start inspection' };
    }
  });

  messageBus.onMessage(MESSAGE_CHANNELS.CANCEL_INSPECTION, async (payload) => {
    const scanId = payload?.scanId;
    if (!scanId) {
      return { success: false, error: 'scanId is required to cancel' };
    }
    const cancelled = inspectionOrchestrator.cancelInspection(scanId);
    return { success: cancelled };
  });

  messageBus.onMessage(MESSAGE_CHANNELS.GET_INSPECTION_STATE, async (payload) => {
    const session = inspectionOrchestrator.getSession(payload?.scanId, payload?.tabId, payload?.url);
    return {
      state: session?.state || 'idle',
      inspection: session?.inspection,
      progress: session?.progress,
    };
  });

  messageBus.onMessage(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, async () => {
    inspectionOrchestrator.clearSessions();
    return { success: true };
  });

  messageBus.onMessage(MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT, async (payload) => {
    const provider = payload?.provider as IntelligenceProviderType;
    const granted = consentManager.hasConsent(provider);
    return { granted };
  });

  messageBus.onMessage(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, async (payload) => {
    const provider = payload?.provider as IntelligenceProviderType;
    const granted = Boolean(payload?.granted);
    consentManager.setConsent(provider, granted);
    return { success: true };
  });

  if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      inspectionOrchestrator.clearSessions();
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      inspectionOrchestrator.clearSessions();

      if (chrome.contextMenus) {
        try {
          chrome.contextMenus.create({
            id: 'open-side-panel',
            title: 'Open SiteRadar in Side Panel',
            contexts: ['all'],
          });
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
});
