/**
 * @file entrypoints/popup/App.tsx
 * @description Main extension popup coordinator implementing scan lifecycle controls,
 * state machine synchronization, and presentation components.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 12,
 * Features 40, 41, 42, 43, 44, 45, 46, 48, 49, 50.
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
import { ModeSelector } from './components/ModeSelector';
import { LiveProgressBar } from './components/LiveProgressBar';
import { Scorecard } from './components/Scorecard';
import { ModuleAccordions } from './components/ModuleAccordions';
import { FindingsExplorer } from './components/FindingsExplorer';
import { FindingDetailInspector } from './components/FindingDetailInspector';
import { ExportBar } from './components/ExportBar';

export type ScanStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export function App() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [selectedMode, setSelectedMode] = useState<InspectionMode>('quick');
  const [inspection, setInspection] = useState<WebsiteInspection | null>(null);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [activeTab, setActiveTab] = useState<TabInfo | null>(null);
  const [schemeValidation, setSchemeValidation] = useState<SchemeValidationResult>({ valid: true });
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<Severity | 'all'>('all');
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [theme, setTheme] = useState<AppTheme>('dark');

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

  return (
    <div
      data-theme={theme}
      className={`flex flex-col min-h-[540px] max-h-[600px] w-[520px] bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden ${theme}`}
    >
      {/* Header & Site Identity */}
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
      />

      {/* Main Content Area with Internal Scrolling */}
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
          <div className="border-b border-orange-500/30 bg-orange-500/10 p-3 text-xs flex items-center justify-between text-zinc-300">
            <span className="text-orange-400 font-medium">Inspection was cancelled by user.</span>
            <button
              type="button"
              onClick={() => setScanStatus('idle')}
              className="text-xs font-medium text-zinc-300 hover:text-zinc-100 underline cursor-pointer"
            >
              Back to Launcher
            </button>
          </div>
        )}

        {/* Failed Banner */}
        {scanStatus === 'failed' && (
          <div className="border-b border-rose-500/30 bg-rose-500/10 p-3 text-xs text-zinc-300 space-y-1">
            <div className="font-semibold text-rose-400">Inspection Failed</div>
            <p className="text-xs text-zinc-300">{errorMessage || 'An unknown error occurred.'}</p>
            <button
              type="button"
              onClick={() => setScanStatus('idle')}
              className="mt-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 underline cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Mode Selector & Launcher (Visible in idle, cancelled, or failed state) */}
        {(scanStatus === 'idle' || scanStatus === 'cancelled' || scanStatus === 'failed') && (
          <ModeSelector
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
            onStartInspection={handleStartInspection}
            disabled={!schemeValidation.valid || !activeTab}
            disabledReason={schemeValidation.reason || 'No active tab detected'}
          />
        )}

        {/* Completed Findings Presentation Suite */}
        {scanStatus === 'completed' && inspection && (
          <div className="space-y-0">
            {/* Export Controls Bar */}
            <ExportBar inspection={inspection} />

            {/* Scorecard Summary (Feature 43) */}
            <Scorecard
              scores={inspection.scores}
              findings={inspection.findings}
              activeSeverityFilter={activeSeverityFilter}
              onFilterSeverity={setActiveSeverityFilter}
            />

            {/* 10 Module Result Accordions (Feature 44) */}
            <ModuleAccordions modules={inspection.modules as any} />

            {/* Findings Explorer (Feature 45) */}
            <FindingsExplorer
              findings={inspection.findings}
              activeSeverityFilter={activeSeverityFilter}
              onSelectSeverityFilter={setActiveSeverityFilter}
              onSelectFinding={setSelectedFinding}
            />
          </div>
        )}
      </main>

      {/* Finding Detail Inspector Modal (Feature 46) */}
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
