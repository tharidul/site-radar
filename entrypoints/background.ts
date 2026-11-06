/**
 * @file entrypoints/background.ts
 * @description Background service worker orchestrating inspection lifecycles,
 * crawler coordination, external intelligence consent, and API key management.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, 8, 9, 10.
 */

import { defineBackground } from 'wxt/utils/define-background';
import { MESSAGE_CHANNELS } from '../src/types/messaging';
import { messageBus } from '../src/messaging/bus';
import { inspectionOrchestrator } from '../src/core/orchestrator';
import { consentManager, apiKeyManager } from '../src/intelligence';
import type { IntelligenceProviderType } from '../src/types/intelligence';

export default defineBackground(() => {
  // Start Inspection Channel
  messageBus.onMessage(MESSAGE_CHANNELS.START_INSPECTION, async (payload) => {
    try {
      const mode = payload?.mode || 'quick';
      const tabId = payload?.tabId;
      const options = {
        crawlLimits: payload?.crawlLimits,
        externalConsent: payload?.externalConsent,
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

  // Cancel Inspection Channel
  messageBus.onMessage(MESSAGE_CHANNELS.CANCEL_INSPECTION, async (payload) => {
    const scanId = payload?.scanId;
    if (!scanId) {
      return { success: false, error: 'scanId is required to cancel' };
    }
    const cancelled = inspectionOrchestrator.cancelInspection(scanId);
    return { success: cancelled };
  });

  // Get Inspection State Channel
  messageBus.onMessage(MESSAGE_CHANNELS.GET_INSPECTION_STATE, async (payload) => {
    const session = inspectionOrchestrator.getSession(payload?.scanId, payload?.tabId, payload?.url);
    return {
      state: session?.state || 'idle',
      inspection: session?.inspection,
      progress: session?.progress,
    };
  });

  // Clear In-Memory State Channel
  messageBus.onMessage(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, async () => {
    inspectionOrchestrator.clearSessions();
    return { success: true };
  });

  // Check External Consent Channel
  messageBus.onMessage(MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT, async (payload) => {
    const provider = payload?.provider as IntelligenceProviderType;
    const granted = consentManager.hasConsent(provider);
    return { granted };
  });

  // Set External Consent Channel
  messageBus.onMessage(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, async (payload) => {
    const provider = payload?.provider as IntelligenceProviderType;
    const granted = Boolean(payload?.granted);
    consentManager.setConsent(provider, granted);
    return { success: true };
  });

  // Get Configured Providers Channel
  messageBus.onMessage(MESSAGE_CHANNELS.GET_CONFIGURED_PROVIDERS, async () => {
    const configuredProviders = apiKeyManager.getConfiguredProviders();
    return { configuredProviders };
  });

  // Set API Key Channel
  messageBus.onMessage(MESSAGE_CHANNELS.SET_API_KEY, async (payload) => {
    try {
      if (!payload?.provider || !payload?.key) {
        return { success: false, error: 'Provider and key are required' };
      }
      apiKeyManager.setKey(payload.provider, payload.key, payload.isSessionOnly ?? true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to set API key' };
    }
  });

  // Remove API Key Channel
  messageBus.onMessage(MESSAGE_CHANNELS.REMOVE_API_KEY, async (payload) => {
    if (payload?.provider) {
      apiKeyManager.removeKey(payload.provider);
    }
    return { success: true };
  });

  // Zero-persistence guarantee: flush all in-memory audit sessions on browser startup & update
  if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      inspectionOrchestrator.clearSessions();
      apiKeyManager.clearAllKeys();
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      inspectionOrchestrator.clearSessions();
      apiKeyManager.clearAllKeys();
    });
  }
});
