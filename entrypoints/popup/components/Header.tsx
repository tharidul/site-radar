/**
 * @file entrypoints/popup/components/Header.tsx
 * @description Extension header, site identity bar, options navigation, and in-memory clear control.
 * Adheres strictly to the anti-slop zinc-950 dark theme standard.
 */

import React from 'react';
import { Shield, Settings, Trash2, AlertTriangle, Globe, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  tabUrl?: string;
  tabHostname?: string;
  schemeValid: boolean;
  schemeReason?: string;
  hasInspectionData: boolean;
  onClearResults: () => void;
  onOptionsClick: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tabUrl,
  tabHostname,
  schemeValid,
  schemeReason,
  hasInspectionData,
  onClearResults,
  onOptionsClick,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-zinc-100" />
          <div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 leading-none">
              Website Intelligence
            </h1>
            <span className="text-xs text-zinc-400 mt-0.5 block">Security &amp; Audit Engine</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasInspectionData && (
            <button
              type="button"
              onClick={onClearResults}
              title="Clear in-memory results (Purge all audit data)"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
              aria-label="Toggle color theme"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-zinc-700" />
              ) : (
                <Sun className="w-4 h-4 text-orange-400" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOptionsClick}
            title="Open Options &amp; Settings"
            className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Site Identity Strip */}
      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 shrink-0 text-orange-400" />
          <span
            className="font-mono text-xs text-zinc-200 truncate"
            title={tabUrl || 'No active tab'}
          >
            {tabHostname || tabUrl || 'No inspectable tab'}
          </span>
        </div>

        <div>
          {schemeValid ? (
            <span className="shrink-0 text-xs font-semibold text-zinc-100 bg-zinc-800/80 border border-zinc-700/80 rounded-full px-2.5 py-0.5">
              Inspectable
            </span>
          ) : (
            <span
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/80 rounded-full px-2.5 py-0.5"
              title={schemeReason || 'Unsupported scheme'}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Restricted</span>
            </span>
          )}
        </div>
      </div>

      {!schemeValid && schemeReason && (
        <div className="mt-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-zinc-300">
          <strong className="text-rose-400">Cannot inspect tab:</strong> {schemeReason}. Open an HTTP or HTTPS webpage to audit.
        </div>
      )}
    </header>
  );
};
