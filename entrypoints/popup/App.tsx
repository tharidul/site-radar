/**
 * @file entrypoints/popup/App.tsx
 * @description Master extension popup coordinator.
 * Redesigned to match the exact Website Intelligence dashboard architecture:
 * Deep crimson wave header, Target Site bar, Tab bar (Overview, Issues, Rules, Resources, Report),
 * and the complete Overview Dashboard.
 */

import React, { useState, useEffect } from 'react';
import type { WebsiteInspection, InspectionMode, AuditFinding, Severity } from '@/types/inspection';
import type { TabInfo } from '@/types/browser';
import { MESSAGE_CHANNELS, type ScanProgressEvent } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import { validateScheme, type SchemeValidationResult } from '@/security/scheme-validator';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';

import { Header } from './components/Header';
import { TabBar, type DashboardTab } from './components/TabBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ModeSelector } from './components/ModeSelector';
import { LiveProgressBar } from './components/LiveProgressBar';
import { FindingsExplorer } from './components/FindingsExplorer';
import { ModuleAccordions } from './components/ModuleAccordions';
import { ResourcesView } from './components/ResourcesView';
import { ReportView } from './components/ReportView';
import { FindingDetailInspector } from './components/FindingDetailInspector';

export type ScanStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

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
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [theme, setTheme] = useState<AppTheme>('light');

  // Initial load: Fetch theme, active tab info and sync inspection state with background
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const savedTheme = await loadSavedTheme();
        if (mounted) {
          setTheme(savedTheme);
          applyThemeToDom(savedTheme);
        }
      } catch {
        // Fallback
      }

      try {
        const adapter = getBrowserAdapter();
        const tab = await adapter.getActiveTab();

        if (mounted && tab) {
          setActiveTab(tab);
          const validation = validateScheme(tab.url || '');
          setSchemeValidation(validation);
        }

        // Query background service worker for active scan session or completed results
        const stateRes = await messageBus.sendToBackground(
          MESSAGE_CHANNELS.GET_INSPECTION_STATE,
          {},
        );

        if (mounted && stateRes) {
          if (stateRes.state === 'running') {
            setScanStatus('running');
            if (stateRes.progress) setProgress(stateRes.progress);
          } else if (stateRes.state === 'completed' && stateRes.inspection) {
            setScanStatus('completed');
            setInspection(stateRes.inspection);
          }
        }
      } catch (err: any) {
        console.warn('Initialization error in popup:', err);
      }
    }

    initialize();

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
    };
  }, []);

  // Launch inspection
  const handleStartInspection = async () => {
    if (!schemeValidation.valid) return;

    setScanStatus('running');
    setErrorMessage(null);
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
  };

  // Cancel in-flight inspection
  const handleCancelInspection = async () => {
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
  };

  // In-memory results clear control (Feature 50): purges all transient audit data
  const handleClearResults = async () => {
    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE, undefined);
    } catch (err) {
      console.warn('Clear in-memory state error:', err);
    } finally {
      setScanStatus('idle');
      setInspection(null);
      setProgress(null);
      setSelectedFinding(null);
      setErrorMessage(null);
      setActiveSeverityFilter('all');
      setActiveCategoryFilter('all');
      setActiveDashboardTab('overview');
    }
  };

  // Open options page
  const handleOpenOptions = () => {
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
  };

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyThemeToDom(nextTheme);
    saveTheme(nextTheme);
  };

  const handleClose = () => {
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  // Navigation from Overview cards to Issues
  const handleNavigateToIssues = (filter?: { severity?: Severity | 'all'; category?: string }) => {
    if (filter?.severity !== undefined) {
      setActiveSeverityFilter(filter.severity);
    }
    if (filter?.category !== undefined) {
      setActiveCategoryFilter(filter.category);
    }
    setActiveDashboardTab('issues');
  };

  const issuesCount = inspection
    ? inspection.findings.filter((f) => f.status === 'failed' || f.status === 'warning').length
    : 0;

  return (
    <div
      data-theme={theme}
      className={`flex flex-col min-h-[580px] max-h-[600px] w-[580px] bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none overflow-hidden ${theme}`}
    >
      {/* 1. Header with Dark Crimson Wave and URL strip */}
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

      {/* 2. Navigation Tab Bar (Shown when inspection data exists) */}
      {inspection && scanStatus === 'completed' && (
        <TabBar
          activeTab={activeDashboardTab}
          onSelectTab={setActiveDashboardTab}
          issuesCount={issuesCount}
        />
      )}

      {/* 3. Main Content Scrollable Area */}
      <main className="flex-1 overflow-y-auto">
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
          <div className="border-b border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-3 text-xs flex items-center justify-between text-zinc-800 dark:text-zinc-200">
            <span className="text-orange-700 dark:text-orange-400 font-semibold">
              Inspection was cancelled by user.
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
          <div className="border-b border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
            <div className="font-bold text-rose-700 dark:text-rose-400">Inspection Failed</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">{errorMessage || 'An unknown error occurred.'}</p>
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
          <div>
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
                onSelectFinding={setSelectedFinding}
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

            {/* Tab 5: Executive Report View */}
            {activeDashboardTab === 'report' && (
              <ReportView inspection={inspection} />
            )}
          </div>
        )}
      </main>

      {/* Finding Detail Inspector Modal */}
      {selectedFinding && (
        <FindingDetailInspector
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
        />
      )}
    </div>
  );
}

export default App;
