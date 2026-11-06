/**
 * @file entrypoints/popup/App.tsx
 * @description Master extension popup coordinator.
 * Redesigned to match the exact Website Intelligence dashboard architecture:
 * Deep crimson wave header, Target Site bar, Tab bar (Overview, Issues, Rules, Resources, Report),
 * and the complete Overview Dashboard.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WebsiteInspection, InspectionMode, AuditFinding, Severity } from '@/types/inspection';
import type { TabInfo } from '@/types/browser';
import { MESSAGE_CHANNELS, type ScanProgressEvent } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import { validateScheme, type SchemeValidationResult } from '@/security/scheme-validator';
import { isSameOrigin } from '@/security/url-normalizer';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';

import { Header } from './components/Header';
import { TabBar, type DashboardTab } from './components/TabBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ModeSelector } from './components/ModeSelector';
import { LiveProgressBar } from './components/LiveProgressBar';
import { FindingsExplorer } from './components/FindingsExplorer';
import { ModuleAccordions } from './components/ModuleAccordions';
import { ResourcesView } from './components/ResourcesView';
import { AboutView } from './components/AboutView';

export type ScanStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

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
          <div className="text-rose-500 font-bold text-sm">Failed to render this view</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto font-mono">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              this.props.fallbackTab?.();
            }}
            className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
          >
            Back to Overview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [selectedMode, setSelectedMode] = useState<InspectionMode>('quick');
  const [inspection, setInspection] = useState<WebsiteInspection | null>(null);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [activeTab, setActiveTab] = useState<TabInfo | null>(null);
  const [schemeValidation, setSchemeValidation] = useState<SchemeValidationResult>({ valid: true });
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('overview');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<Severity | 'all'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [theme, setTheme] = useState<AppTheme>('dark');

  // Initial load: Fetch theme, active tab info and sync inspection state strictly for the current tab & URL
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const adapter = getBrowserAdapter();
        const [savedTheme, tab] = await Promise.all([
          loadSavedTheme().catch(() => 'dark' as AppTheme),
          adapter.getActiveTab().catch(() => null),
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

        // Query background inspection state strictly scoped to this tab and URL
        if (tab?.id && tab?.url) {
          const stateRes = await messageBus
            .sendToBackground(MESSAGE_CHANNELS.GET_INSPECTION_STATE, {
              tabId: tab.id,
              url: tab.url,
            })
            .catch(() => null);

          if (mounted && stateRes) {
            // Verify that the inspection target matches the active tab URL to prevent cross-site data retention
            const isMatch = Boolean(
              stateRes.inspection?.target?.url &&
              (tab.url === stateRes.inspection.target.url ||
               isSameOrigin(tab.url, stateRes.inspection.target.url))
            );

            if (stateRes.state === 'running' && isMatch) {
              setScanStatus('running');
              if (stateRes.progress) setProgress(stateRes.progress);
            } else if (stateRes.state === 'completed' && stateRes.inspection && isMatch) {
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

    // Listen for tab URL changes while popup is open to reset stale audit data
    const handleTabUpdated = (updatedTabId: number, changeInfo: { url?: string; status?: string }) => {
      if (!mounted) return;
      if (changeInfo.url) {
        const newUrl = changeInfo.url;
        setActiveTab((prev) => {
          if (prev && prev.id === updatedTabId) {
            return { ...prev, url: newUrl };
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

    if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
    }

    // Listen to live broadcast events from orchestrator
    const unsubProgress = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_PROGRESS,
      (event: ScanProgressEvent) => {
        if (!mounted) return;
        setScanStatus('running');
        setProgress(event);
      },
    );

    const unsubCompleted = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_COMPLETED,
      (payload: { scanId: string; inspection?: WebsiteInspection }) => {
        if (!mounted) return;
        setScanStatus('completed');
        if (payload.inspection) {
          setInspection(payload.inspection);
        }
      },
    );

    const unsubFailed = messageBus.onMessage(
      MESSAGE_CHANNELS.SCAN_FAILED,
      (payload: { scanId: string; error: string }) => {
        if (!mounted) return;
        setScanStatus('failed');
        setErrorMessage(payload.error || 'Audit scan failed');
      },
    );

    return () => {
      mounted = false;
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      }
    };
  }, []);

  // Launch inspection (rerender-memo)
  const handleStartInspection = useCallback(async () => {
    if (!schemeValidation.valid) return;

    setScanStatus('running');
    setErrorMessage(null);
    setInspection(null); // Clear previous inspection immediately when starting a new scan
    setProgress({
      scanId: `scan_${Date.now()}`,
      mode: selectedMode,
      step: 'Initiating audit pipeline...',
      percent: 5,
      completedModules: 0,
      totalModules: selectedMode === 'quick' ? 8 : selectedMode === 'full' ? 10 : 15,
      timestamp: Date.now(),
    });

    try {
      const res = await messageBus.sendToBackground(MESSAGE_CHANNELS.START_INSPECTION, {
        mode: selectedMode,
        tabId: activeTab?.id,
      });

      if (!res.success) {
        setScanStatus('failed');
        setErrorMessage(res.error || 'Failed to start inspection');
      }
    } catch (err: any) {
      setScanStatus('failed');
      setErrorMessage(err?.message || 'Error communicating with background service worker');
    }
  }, [schemeValidation.valid, selectedMode, activeTab?.id]);

  // Cancel in-flight inspection (rerender-memo)
  const handleCancelInspection = useCallback(async () => {
    setIsCancelling(true);
    try {
      if (progress?.scanId) {
        await messageBus.sendToBackground(MESSAGE_CHANNELS.CANCEL_INSPECTION, {
          scanId: progress.scanId,
        });
      }
      setScanStatus('cancelled');
    } catch (err: any) {
      console.warn('Cancel error:', err);
      setScanStatus('cancelled');
    } finally {
      setIsCancelling(false);
    }
  }, [progress?.scanId]);

  // In-memory results clear control (Feature 50): purges all transient audit data (rerender-memo)
  const handleClearResults = useCallback(async () => {
    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, undefined);
    } catch (err) {
      console.warn('Clear in-memory state error:', err);
    } finally {
      setScanStatus('idle');
      setInspection(null);
      setProgress(null);
      setErrorMessage(null);
      setActiveSeverityFilter('all');
      setActiveCategoryFilter('all');
      setActiveDashboardTab('overview');
    }
  }, []);

  // Open options page (rerender-memo)
  const handleOpenOptions = useCallback(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        const adapter = getBrowserAdapter();
        const optionsUrl = adapter.getURL('options.html');
        window.open(optionsUrl, '_blank');
      }
    } catch {
      window.open('options.html', '_blank');
    }
  }, []);

  // Theme toggle with functional state updater (rerender-functional-setstate, rerender-memo)
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
      // ignore
    }
  }, []);

  // Navigation from Overview cards to Issues (rerender-memo)
  const handleNavigateToIssues = useCallback((filter?: { severity?: Severity | 'all'; category?: string }) => {
    if (filter?.severity !== undefined) {
      setActiveSeverityFilter(filter.severity);
    }
    if (filter?.category !== undefined) {
      setActiveCategoryFilter(filter.category);
    }
    setActiveDashboardTab('issues');
  }, []);

  // Memoized count of active issues (rerender-memo)
  const issuesCount = useMemo(() => {
    if (!inspection?.findings) return 0;
    return inspection.findings.filter((f) => f.status === 'failed' || f.status === 'warning').length;
  }, [inspection?.findings]);

  return (
    <div
      data-theme={theme}
      className={`flex flex-col h-[600px] w-[580px] bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none overflow-hidden rounded-2xl ${theme}`}
    >
      {/* 1. Header with Dark Crimson Wave and URL strip (shrink-0 prevents flex crushing) */}
      <div className="shrink-0">
        <Header
          tabUrl={activeTab?.url}
          tabHostname={activeTab?.origin || activeTab?.url}
          schemeValid={schemeValidation.valid}
          schemeReason={schemeValidation.reason}
          hasInspectionData={inspection !== null || scanStatus === 'completed'}
          onClearResults={handleClearResults}
          onOptionsClick={handleOpenOptions}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onClose={handleClose}
        />
      </div>

      {/* 2. Navigation Tab Bar (shrink-0 prevents flex crushing) */}
      {inspection && scanStatus === 'completed' && (
        <div className="shrink-0">
          <TabBar
            activeTab={activeDashboardTab}
            onSelectTab={setActiveDashboardTab}
            issuesCount={issuesCount}
          />
        </div>
      )}

      {/* 3. Main Content Scrollable Area (min-h-0 allows main to scroll properly) */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Live Progress Bar when running */}
        {scanStatus === 'running' && (
          <LiveProgressBar
            progress={progress}
            onCancel={handleCancelInspection}
            isCancelling={isCancelling}
          />
        )}

        {/* Cancelled Banner */}
        {scanStatus === 'cancelled' && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs flex items-center justify-between text-zinc-800 dark:text-zinc-200">
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
              <span className="text-orange-500 font-bold mr-1.5">•</span>
              Inspection was cancelled.
            </span>
            <button
              type="button"
              onClick={() => setScanStatus('idle')}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
            >
              Back to Launcher
            </button>
          </div>
        )}

        {/* Failed Banner */}
        {scanStatus === 'failed' && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span className="text-rose-500 font-bold">•</span>
              <span>Inspection Failed</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{errorMessage || 'An unknown error occurred.'}</p>
            <button
              type="button"
              onClick={() => setScanStatus('idle')}
              className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Mode Selector & Launcher (Visible when idle/no inspection) */}
        {(scanStatus === 'idle' || scanStatus === 'cancelled' || scanStatus === 'failed') && !inspection && (
          <ModeSelector
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
            onStartInspection={handleStartInspection}
            disabled={!schemeValidation.valid || !activeTab}
            disabledReason={schemeValidation.reason || 'No active tab detected'}
          />
        )}

        {/* Completed Findings Presentation Suite */}
        {inspection && scanStatus === 'completed' && (
          <TabErrorBoundary fallbackTab={() => setActiveDashboardTab('overview')}>
            {/* Tab 1: Overview Dashboard (Matching Screenshot) */}
            {activeDashboardTab === 'overview' && (
              <OverviewDashboard
                inspection={inspection}
                onNavigateToIssues={handleNavigateToIssues}
              />
            )}

            {/* Tab 2: Issues Explorer */}
            {activeDashboardTab === 'issues' && (
              <FindingsExplorer
                findings={inspection.findings}
                activeSeverityFilter={activeSeverityFilter}
                activeCategoryFilter={activeCategoryFilter}
                onSelectSeverityFilter={setActiveSeverityFilter}
                onSelectCategoryFilter={setActiveCategoryFilter}
                scores={inspection.scores}
              />
            )}

            {/* Tab 3: Rules & Modules Accordions */}
            {activeDashboardTab === 'rules' && (
              <ModuleAccordions modules={inspection.modules as any} />
            )}

            {/* Tab 4: Resources View */}
            {activeDashboardTab === 'resources' && (
              <ResourcesView inspection={inspection} />
            )}

            {/* Tab 5: About */}
            {activeDashboardTab === 'about' && (
              <AboutView />
            )}
          </TabErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default App;
