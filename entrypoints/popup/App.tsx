
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { WebsiteInspection, InspectionMode, AuditFinding, Severity } from '@/types/inspection';
import type { TabInfo } from '@/types/browser';
import type { CrawlLimits } from '@/types/crawler';
import { MESSAGE_CHANNELS, type ScanProgressEvent } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import { validateScheme, type SchemeValidationResult } from '@/security/scheme-validator';
import {
  clearPendingPermissionScan,
  ensureEphemeralBrowserSessionPermissions,
  savePendingPermissionScan,
} from '@/security/ephemeral-permissions';
import { isSameOrigin } from '@/security/url-normalizer';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';
import { getExtensionApi, openExtensionOptions, supportsSidePanelOpen } from './ext-api';

import { Header } from './components/Header';
import { TabBar, type DashboardTab } from './components/TabBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ModeSelector } from './components/ModeSelector';
import { LiveProgressBar } from './components/LiveProgressBar';
import { FindingsExplorer } from './components/FindingsExplorer';
import { ModuleAccordions } from './components/ModuleAccordions';
import { ResourcesView } from './components/ResourcesView';
import { CookiesView } from './components/CookiesView';
import { AboutView } from './components/AboutView';
import { HeadersView } from './components/HeadersView';
import { SocialPreviewView } from './components/SocialPreviewView';

export type ScanStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface LiveMetricsSnapshot {
  resourceCount: number;
  wireTransferBytes: number;
  decodedBytes: number;
  cacheHitCount: number;
  cacheHitBytes: number;
  opaqueResourceCount: number;
}

/** Returns true only when live metrics polling should be active on the Overview tab. */
export function shouldPollLiveMetrics(
  scanStatus: ScanStatus,
  activeDashboardTab: DashboardTab,
  tabId?: number,
): boolean {
  return scanStatus === 'completed' && activeDashboardTab === 'overview' && Boolean(tabId);
}

/**
 * Returns the previous metrics reference unchanged when all 6 numeric counters match
 * so React skips unnecessary root re-renders during 1.2s polling.
 */
export function reconcileLiveMetrics(
  prev: LiveMetricsSnapshot | null,
  next: LiveMetricsSnapshot,
): LiveMetricsSnapshot {
  if (
    prev &&
    prev.resourceCount === next.resourceCount &&
    prev.wireTransferBytes === next.wireTransferBytes &&
    prev.decodedBytes === next.decodedBytes &&
    prev.cacheHitCount === next.cacheHitCount &&
    prev.cacheHitBytes === next.cacheHitBytes &&
    prev.opaqueResourceCount === next.opaqueResourceCount
  ) {
    return prev;
  }

  return {
    resourceCount: next.resourceCount,
    wireTransferBytes: next.wireTransferBytes,
    decodedBytes: next.decodedBytes,
    cacheHitCount: next.cacheHitCount,
    cacheHitBytes: next.cacheHitBytes,
    opaqueResourceCount: next.opaqueResourceCount,
  };
}

export function getRequiredOriginPermissions(
  url: string | undefined,
  _mode?: InspectionMode,
): string[] {
  if (!url) return [];

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return [];
  }

  return [`${parsed.protocol}//${parsed.host}/*`];
}

export async function ensureOriginPermission(
  url: string | undefined,
  mode: InspectionMode,
  adapter = getBrowserAdapter(),
): Promise<{ granted: boolean; reason?: string }> {
  const origins = getRequiredOriginPermissions(url, mode);
  if (origins.length === 0) {
    return { granted: true };
  }

  try {
    if (adapter.browserType !== 'mock') {
      const extApi = getExtensionApi();
      const hasPermissionsApi = typeof extApi?.permissions?.request === 'function';
      if (!hasPermissionsApi) {
        return { granted: true };
      }
    }

    const granted = await adapter.requestPermissions({ origins });
    if (!granted) {
      return {
        granted: false,
        reason: `Host permission (${origins[0]}) is required to inspect this site.`,
      };
    }
    return { granted: true };
  } catch {
    return { granted: true };
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTab?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TabErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Tab rendering failed:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center space-y-3">
          <div className="text-[#152E40] dark:text-[#CEFF52] font-bold text-sm">Failed to render this view</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto font-mono">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              this.props.fallbackTab?.();
            }}
            className="px-3 py-1.5 rounded-lg bg-[#CEFF52] text-[#152E40] text-xs font-bold hover:bg-[#bbf03e] transition-colors cursor-pointer"
          >
            Back to Overview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App({ isSidepanel: propIsSidepanel }: { isSidepanel?: boolean } = {}) {
  const isSidepanel = propIsSidepanel ?? (typeof window !== 'undefined' && window.location.pathname.includes('sidepanel'));
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [selectedMode, setSelectedMode] = useState<InspectionMode>('full');
  const [inspection, setInspection] = useState<WebsiteInspection | null>(null);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [activeTab, setActiveTab] = useState<TabInfo | null>(null);
  const [schemeValidation, setSchemeValidation] = useState<SchemeValidationResult>({ valid: true });
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('overview');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<Severity | 'all'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [hasOriginPermission, setHasOriginPermission] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [refreshPage, setRefreshPage] = useState<boolean>(true);
  const activeScanIdRef = useRef<string | null>(null);
  const pendingCancelRef = useRef<boolean>(false);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricsSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const adapter = getBrowserAdapter();
        const [savedTheme, tab] = await Promise.all([
          loadSavedTheme().catch(() => 'dark' as AppTheme),
          adapter.getActiveTab().catch(() => null),
          ensureEphemeralBrowserSessionPermissions(adapter).catch(() => {}),
        ]);

        if (mounted) {
          if (savedTheme) {
            setTheme(savedTheme);
            applyThemeToDom(savedTheme);
          }
          if (tab) {
            setActiveTab(tab);
            const validation = validateScheme(tab.url || '');
            setSchemeValidation(validation);
          }
        }

        if (tab?.id && tab?.url) {
          const stateRes = await messageBus
            .sendToBackground(MESSAGE_CHANNELS.GET_INSPECTION_STATE, {
              tabId: tab.id,
              url: tab.url,
            })
            .catch(() => null);

          if (mounted && stateRes) {
            const targetCandidate = stateRes.inspection?.target?.url || (stateRes as any).targetUrl;
            const isMatch = Boolean(
              targetCandidate &&
              (tab.url === targetCandidate || isSameOrigin(tab.url, targetCandidate))
            );

            if (stateRes.state === 'running' && isMatch) {
              setScanStatus('running');
              if (stateRes.progress) {
                setProgress(stateRes.progress);
                if (stateRes.progress.scanId) {
                  activeScanIdRef.current = stateRes.progress.scanId;
                }
              }
            } else if ((stateRes.state === 'completed' || stateRes.inspection) && stateRes.inspection && isMatch) {
              setScanStatus('completed');
              setInspection(stateRes.inspection);
            } else {
              setScanStatus('idle');
              setInspection(null);
              setProgress(null);
            }
          }
        } else if (mounted) {
          setScanStatus('idle');
          setInspection(null);
          setProgress(null);
        }
      } catch (err: any) {
        console.warn('Initialization error in popup:', err);
      }
    }

    initialize();

    const handleTabUpdated = (
      updatedTabId: number,
      changeInfo: { url?: string; status?: string; favIconUrl?: string },
    ) => {
      if (!mounted) return;
      if (changeInfo.favIconUrl) {
        setActiveTab((prev) =>
          prev && prev.id === updatedTabId ? { ...prev, favIconUrl: changeInfo.favIconUrl } : prev,
        );
      }
      if (changeInfo.url) {
        const newUrl = changeInfo.url;
        setActiveTab((prev) => {
          if (prev && prev.id === updatedTabId) {
            return { ...prev, url: newUrl, favIconUrl: changeInfo.favIconUrl ?? undefined };
          }
          return prev;
        });
        const validation = validateScheme(newUrl);
        setSchemeValidation(validation);

        setInspection((curr) => {
          if (!curr) return null;
          if (!isSameOrigin(newUrl, curr.target.url)) {
            setScanStatus('idle');
            setProgress(null);
            return null;
          }
          return curr;
        });
      }
    };

    const extApi = getExtensionApi();
    if (extApi?.tabs?.onUpdated) {
      extApi.tabs.onUpdated.addListener(handleTabUpdated);
    }

    const handleTabActivated = async () => {
      if (!mounted) return;
      try {
        const adapter = getBrowserAdapter();
        const tab = await adapter.getActiveTab().catch(() => null);
        if (mounted && tab) {
          setActiveTab(tab);
          const validation = validateScheme(tab.url || '');
          setSchemeValidation(validation);
        }
      } catch {
      }
    };

    if (extApi?.tabs?.onActivated) {
      extApi.tabs.onActivated.addListener(handleTabActivated);
    }

    const unsubProgress = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_PROGRESS,
      (event: ScanProgressEvent) => {
        if (!mounted || pendingCancelRef.current) return;
        if (event.scanId) {
          activeScanIdRef.current = event.scanId;
        }
        setScanStatus('running');
        setProgress(event);
      },
    );

    const unsubCompleted = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_COMPLETED,
      (payload: { scanId: string; inspection?: WebsiteInspection }) => {
        if (!mounted || pendingCancelRef.current) return;
        activeScanIdRef.current = null;
        setScanStatus('completed');
        if (payload.inspection) {
          setInspection(payload.inspection);
        }
      },
    );

    const unsubFailed = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_FAILED,
      (payload: { scanId: string; error: string }) => {
        if (!mounted || pendingCancelRef.current) return;
        activeScanIdRef.current = null;
        setScanStatus('failed');
        setErrorMessage(payload.error || 'Audit scan failed');
      },
    );

    return () => {
      mounted = false;
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      if (extApi?.tabs?.onUpdated) {
        extApi.tabs.onUpdated.removeListener(handleTabUpdated);
      }
      if (extApi?.tabs?.onActivated) {
        extApi.tabs.onActivated.removeListener(handleTabActivated);
      }
    };
  }, []);

  // CRIT-03: Keepalive port connection to service worker during active scans
  useEffect(() => {
    if (scanStatus !== 'running') return;
    const extApi = getExtensionApi();
    if (!extApi?.runtime?.connect) return;

    let port: chrome.runtime.Port | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    try {
      port = extApi.runtime.connect({ name: 'siteradar-scan-keepalive' });
      port?.postMessage('PING');

      pingInterval = setInterval(() => {
        try {
          port?.postMessage('PING');
        } catch {
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 20000);

      port?.onDisconnect.addListener(() => {
        if (pingInterval) clearInterval(pingInterval);
        port = null;
      });
    } catch (err) {
      console.warn('Failed to establish keepalive port:', err);
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (port) {
        try {
          port.disconnect();
        } catch {}
      }
    };
  }, [scanStatus]);

  useEffect(() => {
    if (scanStatus !== 'completed' || !activeTab?.id) {
      setLiveMetrics(null);
      return;
    }

    if (!shouldPollLiveMetrics(scanStatus, activeDashboardTab, activeTab.id)) {
      return;
    }

    const tabId = activeTab.id;
    let isSubscribed = true;

    const pollLiveMetrics = async () => {
      try {
        const res = await messageBus.sendToTab(
          tabId,
          MESSAGE_CHANNELS.GET_LIVE_METRICS,
          undefined,
        );
        if (isSubscribed && res && res.success && typeof res.resourceCount === 'number') {
          setLiveMetrics((prev) => reconcileLiveMetrics(prev, res));
        }
      } catch {
        // Tab may have navigated or content script not ready
      }
    };

    pollLiveMetrics();
    const interval = setInterval(pollLiveMetrics, 1200);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [scanStatus, activeDashboardTab, activeTab?.id]);

  useEffect(() => {
    let active = true;
    const origins = getRequiredOriginPermissions(activeTab?.url, selectedMode);
    if (origins.length === 0) {
      setHasOriginPermission(true);
      return;
    }

    const adapter = getBrowserAdapter();
    const checkPermission = async () => {
      try {
        const granted = await adapter.hasPermissions({ origins });
        if (active) setHasOriginPermission(granted);
      } catch {
        if (active) setHasOriginPermission(null);
      }
    };
    void checkPermission();

    const extApi = getExtensionApi();
    const onPermsChanged = () => {
      void checkPermission();
    };
    try {
      extApi?.permissions?.onAdded?.addListener?.(onPermsChanged);
      extApi?.permissions?.onRemoved?.addListener?.(onPermsChanged);
    } catch {
      // Ignore environments without permissions change events
    }

    return () => {
      active = false;
      try {
        extApi?.permissions?.onAdded?.removeListener?.(onPermsChanged);
        extApi?.permissions?.onRemoved?.removeListener?.(onPermsChanged);
      } catch {}
    };
  }, [activeTab?.url, selectedMode]);

  const handleStartInspection = useCallback(async () => {
    if (!schemeValidation.valid) return;

    const adapter = getBrowserAdapter();
    const requiredOrigins = getRequiredOriginPermissions(activeTab?.url, selectedMode);
    if (requiredOrigins.length > 0) {
      // Fire-and-forget before permissions.request() so Chrome/Firefox user gesture is preserved
      // and background permissions.onAdded can auto-start if the popup closes on prompt.
      void savePendingPermissionScan(adapter, {
        origins: requiredOrigins,
        mode: selectedMode,
        tabId: activeTab?.id,
        url: activeTab?.url,
        refreshPage,
        createdAt: Date.now(),
      });
    }

    setIsRequestingPermission(true);
    let firefoxCloseTimer: ReturnType<typeof setTimeout> | null = null;
    const permPromise = ensureOriginPermission(activeTab?.url, selectedMode, adapter);

    // Firefox keeps its toolbar popup open over the URL-bar permission doorhanger;
    // if permission isn't already granted and the prompt stays pending briefly, close
    // the popup so the prompt is clearly visible and background onAdded auto-starts on Allow.
    if (
      adapter.browserType === 'firefox' &&
      !isSidepanel &&
      requiredOrigins.length > 0 &&
      hasOriginPermission !== true
    ) {
      firefoxCloseTimer = setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 150);
    }

    let permissionResult: { granted: boolean; reason?: string };
    try {
      permissionResult = await permPromise;
    } finally {
      if (firefoxCloseTimer !== null) {
        clearTimeout(firefoxCloseTimer);
      }
      setIsRequestingPermission(false);
    }

    if (!permissionResult.granted) {
      void clearPendingPermissionScan(adapter);
      setScanStatus('failed');
      setErrorMessage(permissionResult.reason || 'Host permission was denied.');
      return;
    }

    pendingCancelRef.current = false;
    activeScanIdRef.current = null;
    setIsCancelling(false);
    setScanStatus('running');
    setErrorMessage(null);
    setInspection(null);
    setLiveMetrics(null);
    setProgress({
      scanId: '',
      mode: selectedMode,
      step: refreshPage
        ? 'Hard refreshing page (clearing cache) for accurate data usage...'
        : 'Initiating audit pipeline...',
      percent: 3,
      completedModules: 0,
      totalModules: selectedMode === 'full' ? 15 : 20,
      timestamp: Date.now(),
    });

    try {
      const stored = await adapter
        .getStorage<Partial<CrawlLimits> & { timeoutSeconds?: number }>(['crawlLimits'])
        .catch(() => null);
      const rawLimits = stored?.crawlLimits;
      let crawlLimits: Partial<CrawlLimits> | undefined;
      if (rawLimits && typeof rawLimits === 'object') {
        const normalized: Partial<CrawlLimits> = {
          ...(typeof rawLimits.maxPages === 'number' && Number.isFinite(rawLimits.maxPages) && rawLimits.maxPages > 0
            ? { maxPages: rawLimits.maxPages }
            : {}),
          ...(typeof rawLimits.maxDepth === 'number' && Number.isFinite(rawLimits.maxDepth) && rawLimits.maxDepth > 0
            ? { maxDepth: rawLimits.maxDepth }
            : {}),
          ...(typeof rawLimits.concurrency === 'number' && Number.isFinite(rawLimits.concurrency) && rawLimits.concurrency > 0
            ? { concurrency: rawLimits.concurrency }
            : {}),
          ...(typeof rawLimits.perPageTimeoutMs === 'number' &&
          Number.isFinite(rawLimits.perPageTimeoutMs) &&
          rawLimits.perPageTimeoutMs > 0
            ? { perPageTimeoutMs: rawLimits.perPageTimeoutMs }
            : typeof rawLimits.timeoutSeconds === 'number' &&
              Number.isFinite(rawLimits.timeoutSeconds) &&
              rawLimits.timeoutSeconds > 0
            ? { perPageTimeoutMs: rawLimits.timeoutSeconds * 1000 }
            : {}),
        };
        if (Object.keys(normalized).length > 0) {
          crawlLimits = normalized;
        }
      }

      if (pendingCancelRef.current) {
        return;
      }

      const res = await messageBus.sendToBackground(MESSAGE_CHANNELS.START_INSPECTION, {
        mode: selectedMode,
        tabId: activeTab?.id,
        crawlLimits,
        refreshPage,
      });

      if (pendingCancelRef.current) {
        if (res?.success && res.scanId) {
          await messageBus
            .sendToBackground(MESSAGE_CHANNELS.CANCEL_INSPECTION, {
              scanId: res.scanId,
            })
            .catch(() => {});
        }
        return;
      }

      if (!res.success) {
        setScanStatus('failed');
        setErrorMessage(res.error || 'Failed to start inspection');
        return;
      }

      if (res.scanId) {
        activeScanIdRef.current = res.scanId;
        setProgress((prev) => (prev ? { ...prev, scanId: res.scanId } : prev));
      }
    } catch (err: any) {
      if (pendingCancelRef.current) return;
      setScanStatus('failed');
      setErrorMessage(err?.message || 'Error communicating with background service worker');
    }
  }, [schemeValidation.valid, selectedMode, activeTab?.id, activeTab?.url, refreshPage, isSidepanel, hasOriginPermission]);

  const handleCancelInspection = useCallback(async () => {
    setIsCancelling(true);
    pendingCancelRef.current = true;
    const targetScanId = activeScanIdRef.current || progress?.scanId || '';
    try {
      if (targetScanId) {
        await messageBus.sendToBackground(MESSAGE_CHANNELS.CANCEL_INSPECTION, {
          scanId: targetScanId,
        });
      }
      setScanStatus('cancelled');
    } catch (err: any) {
      console.warn('Cancel error:', err);
      setScanStatus('cancelled');
    } finally {
      activeScanIdRef.current = null;
      setIsCancelling(false);
    }
  }, [progress?.scanId]);

  const handleClearResults = useCallback(async () => {
    pendingCancelRef.current = false;
    activeScanIdRef.current = null;
    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, undefined);
    } catch (err) {
      console.warn('Clear in-memory state error:', err);
    } finally {
      setScanStatus('idle');
      setInspection(null);
      setProgress(null);
      setLiveMetrics(null);
      setErrorMessage(null);
      setActiveSeverityFilter('all');
      setActiveCategoryFilter('all');
      setActiveDashboardTab('overview');
    }
  }, []);

  const handleOpenOptions = useCallback(() => {
    openExtensionOptions();
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const nextTheme: AppTheme = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDom(nextTheme);
      saveTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  const handleClose = useCallback(() => {
    try {
      window.close();
    } catch {
    }
  }, []);

  const canOpenSidePanel = !isSidepanel && supportsSidePanelOpen();

  const handleOpenSidePanel = useCallback(() => {
    try {
      const extApi = getExtensionApi();
      if (typeof extApi?.sidebarAction?.open === 'function') {
        // Call synchronously inside click handler to preserve Firefox user gesture
        void Promise.resolve(extApi.sidebarAction.open())
          .then(() => window.close())
          .catch((err) => {
            console.warn('Failed to open Firefox sidebar:', err);
          });
        return;
      }
      if (typeof extApi?.sidePanel?.open === 'function' && extApi.tabs?.query) {
        void Promise.resolve(extApi.tabs.query({ active: true, currentWindow: true }))
          .then((tabs: Array<{ windowId?: number }>) => {
            const tab = tabs?.[0];
            if (tab?.windowId) {
              return Promise.resolve(extApi.sidePanel.open({ windowId: tab.windowId })).then(() => {
                window.close();
              });
            }
          })
          .catch((err) => {
            console.warn('Failed to open side panel:', err);
          });
      }
    } catch (err) {
      console.warn('Failed to open side panel:', err);
    }
  }, []);

  const handleNavigateToIssues = useCallback((filter?: { severity?: Severity | 'all'; category?: string }) => {
    if (filter?.severity !== undefined) {
      setActiveSeverityFilter(filter.severity);
    }
    if (filter?.category !== undefined) {
      setActiveCategoryFilter(filter.category);
    }
    setActiveDashboardTab('issues');
  }, []);

  const issuesCount = useMemo(() => {
    if (!inspection?.findings) return 0;
    return inspection.findings.filter((f) => f.status === 'failed' || f.status === 'warning').length;
  }, [inspection?.findings]);

  return (
    <div
      data-theme={theme}
      className={`flex flex-col ${
        isSidepanel
          ? 'h-screen w-full min-w-0 rounded-none'
          : 'h-[600px] w-[580px] rounded-none'
      } bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none overflow-hidden ${theme}`}
    >
      <div className="shrink-0">
        <Header
          tabUrl={activeTab?.url}
          tabHostname={activeTab?.origin || activeTab?.url}
          faviconUrl={
            activeTab?.favIconUrl ||
            (inspection?.modules?.identity?.data as { favicon?: string } | undefined)?.favicon
          }
          schemeValid={schemeValidation.valid}
          schemeReason={schemeValidation.reason}
          hasInspectionData={inspection !== null || scanStatus === 'completed'}
          onClearResults={handleClearResults}
          onOptionsClick={handleOpenOptions}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onClose={isSidepanel ? undefined : handleClose}
          onOpenSidePanel={canOpenSidePanel ? handleOpenSidePanel : undefined}
          isSidepanel={isSidepanel}
        />
      </div>

      {scanStatus !== 'running' && (
        <div className="shrink-0 overflow-hidden">
          <TabBar
            activeTab={activeDashboardTab}
            onSelectTab={setActiveDashboardTab}
            issuesCount={issuesCount}
          />
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        {scanStatus === 'running' && (
          <div className="min-h-full w-full flex items-center justify-center">
            <LiveProgressBar
              progress={progress}
              onCancel={handleCancelInspection}
              isCancelling={isCancelling}
              targetHost={
                activeTab?.url
                  ? (() => {
                      try {
                        return new URL(activeTab.url).hostname || undefined;
                      } catch {
                        return undefined;
                      }
                    })()
                  : undefined
              }
            />
          </div>
        )}

        {scanStatus === 'cancelled' && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs flex items-center justify-between text-zinc-800 dark:text-zinc-200">
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
              <span className="text-[#CEFF52] font-bold mr-1.5">•</span>
              Inspection was cancelled.
            </span>
            <button
              type="button"
              onClick={() => {
                setScanStatus('idle');
                setActiveDashboardTab('overview');
              }}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
            >
              Back to Launcher
            </button>
          </div>
        )}

        {scanStatus === 'failed' && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span className="text-[#CEFF52] font-bold">•</span>
              <span>Inspection Failed</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{errorMessage || 'An unknown error occurred.'}</p>
            <button
              type="button"
              onClick={() => {
                setScanStatus('idle');
                setActiveDashboardTab('overview');
              }}
              className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        <TabErrorBoundary fallbackTab={() => setActiveDashboardTab('overview')}>
          {activeDashboardTab === 'overview' && (
            <>
              {scanStatus === 'running' ? null : inspection && scanStatus === 'completed' ? (
                <OverviewDashboard
                  inspection={inspection}
                  onNavigateToIssues={handleNavigateToIssues}
                  onNavigateToTab={setActiveDashboardTab}
                  liveMetrics={liveMetrics}
                />
              ) : (
                <ModeSelector
                  selectedMode={selectedMode}
                  onSelectMode={setSelectedMode}
                  onStartInspection={handleStartInspection}
                  disabled={!schemeValidation.valid || !activeTab}
                  disabledReason={schemeValidation.reason || 'No active tab detected'}
                  isRequestingPermission={isRequestingPermission}
                  refreshPage={refreshPage}
                  onToggleRefreshPage={setRefreshPage}
                />
              )}
            </>
          )}

          {activeDashboardTab === 'issues' && (
            inspection ? (
              <FindingsExplorer
                findings={inspection.findings}
                activeSeverityFilter={activeSeverityFilter}
                activeCategoryFilter={activeCategoryFilter}
                onSelectSeverityFilter={setActiveSeverityFilter}
                onSelectCategoryFilter={setActiveCategoryFilter}
                scores={inspection.scores}
              />
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No findings collected yet</div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Run an inspection from the Overview tab to detect security, SEO, performance, and accessibility issues.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab('overview')}
                  className="px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
                >
                  Go to Overview
                </button>
              </div>
            )
          )}

          {activeDashboardTab === 'headers' && (
            inspection ? (
              <HeadersView inspection={inspection} />
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">HTTP Response Headers</div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Run an inspection from the Overview tab to inspect raw server response headers, security directives, and cURL commands.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab('overview')}
                  className="px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
                >
                  Go to Overview
                </button>
              </div>
            )
          )}

          {activeDashboardTab === 'social' && (
            inspection ? (
              <SocialPreviewView inspection={inspection} />
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Social Media &amp; Search Preview</div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Run an inspection from the Overview tab to view live previews of Twitter/X cards, Facebook/LinkedIn feeds, and Google search snippets.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab('overview')}
                  className="px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
                >
                  Go to Overview
                </button>
              </div>
            )
          )}

          {activeDashboardTab === 'rules' && (
            inspection ? (
              <ModuleAccordions modules={inspection.modules as any} />
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Rules &amp; Standards</div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Run an audit from the Overview tab to view evaluated rules and specifications.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab('overview')}
                  className="px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
                >
                  Go to Overview
                </button>
              </div>
            )
          )}

          {activeDashboardTab === 'resources' && (
            inspection ? (
              <ResourcesView inspection={inspection} />
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Resource Inventory</div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Run an audit from the Overview tab to inspect network payloads, scripts, and stylesheets.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab('overview')}
                  className="px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
                >
                  Go to Overview
                </button>
              </div>
            )
          )}

          {activeDashboardTab === 'cookies' && (
            <div className="p-4">
              <CookiesView targetUrl={activeTab?.url || inspection?.target.url || ''} />
            </div>
          )}

          {activeDashboardTab === 'about' && (
            <AboutView />
          )}
        </TabErrorBoundary>
      </main>
    </div>
  );
}

export default App;
