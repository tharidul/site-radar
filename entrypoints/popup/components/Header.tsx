/**
 * @file entrypoints/popup/components/Header.tsx
 * @description Extension header with deep dark crimson wave gradient, brand identity,
 * quick controls (Clear, Theme, Settings, Close), and the embedded Target URL strip.
 * Exactly matches the design provided by the user.
 */

import React from 'react';
import { Shield, Settings, Trash2, AlertTriangle, Globe, Sun, Moon, Check, X } from 'lucide-react';

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
  onClose?: () => void;
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
  onClose,
}) => {
  return (
    <header className="relative bg-[#161616] px-4 pt-3 pb-3 select-none overflow-hidden border-b border-zinc-800 shrink-0 rounded-t-2xl">
      {/* Subtle deep red crimson background wave accent matching screenshot */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-3/5 opacity-80"
        style={{
          background: 'radial-gradient(ellipse at 85% 15%, rgba(106, 14, 19, 0.75) 0%, rgba(200, 48, 30, 0.35) 45%, transparent 75%)', /* deslop-ignore 06 */
        }}
      />

      <div className="relative z-10 flex items-center justify-between">
        {/* Brand Shield & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e88438] via-[#e88438] to-[#c8301e] flex items-center justify-center shadow-md shrink-0">
            <Shield className="w-5 h-5 text-white fill-white/15" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              Website Intelligence
            </h1>
            <span className="text-xs text-zinc-400 block font-normal">
              Security &amp; Audit Engine
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {hasInspectionData && (
            <button
              type="button"
              onClick={onClearResults}
              title="Clear in-memory results"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-300" />
              <span>Clear</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="flex items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-zinc-300" />
              ) : (
                <Sun className="w-4 h-4 text-orange-400" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOptionsClick}
            title="Options &amp; Settings"
            className="flex items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close popup"
              className="flex items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-zinc-300" />
            </button>
          )}
        </div>
      </div>

      {/* Embedded Target Site URL Strip matching screenshot */}
      <div className="relative z-10 mt-2.5 flex items-center justify-between rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs shadow-xs">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Globe className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span
            className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate select-all"
            title={tabUrl || 'No active tab'}
          >
            {tabUrl || tabHostname || 'https://www.google.com'}
          </span>
        </div>

        <div className="shrink-0">
          {schemeValid ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-0.5">
              <Check className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 stroke-[2.5]" />
              <span>Inspectable</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-900 rounded-md px-2 py-0.5"
              title={schemeReason || 'Unsupported browser scheme'}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Restricted</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
