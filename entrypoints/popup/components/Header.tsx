/**
 * @file entrypoints/popup/components/Header.tsx
 * @description Extension header with brand identity,
 * quick controls (Clear, Theme, Settings, Close), and the embedded Target URL strip.
 * Exactly matches the design provided by the user.
 */

import React from 'react';
import { Settings, RotateCcw, AlertTriangle, Globe, Sun, Moon, X } from 'lucide-react';
import { Button } from './Button';

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
    <header className="relative bg-white dark:bg-zinc-950 px-4 pt-3 pb-3 select-none overflow-hidden border-b border-zinc-200 dark:border-zinc-800 shrink-0 rounded-t-2xl">
      <div className="relative z-10 flex items-center justify-between">
        {/* Brand Shield & Title */}
        <div className="flex items-center gap-3">
          <img
            src="/icon/128.png"
            alt="SiteRadar Logo"
            className="w-9 h-9 rounded-xl object-contain shrink-0"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
              SiteRadar
            </h1>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-normal">
              Security &amp; Audit Engine
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {hasInspectionData && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClearResults}
              title="Reset inspection"
              aria-label="Reset inspection"
              className="border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white group"
            >
              <RotateCcw className="w-4 h-4 text-zinc-600 dark:text-zinc-300 group-hover:rotate-[-45deg] transition-transform duration-200" />
            </Button>
          )}

          {onToggleTheme && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-label="Toggle theme"
              className="border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              ) : (
                <Sun className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOptionsClick}
            title="Options &amp; Settings"
            aria-label="Settings"
            className="border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            <Settings className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              title="Close popup"
              aria-label="Close"
              className="border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </Button>
          )}
        </div>
      </div>

      {/* Embedded Target Site URL Strip matching screenshot */}
      <div className="relative z-10 mt-2.5 flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 px-3 py-1.5 text-xs shadow-xs">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Globe className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span
            className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate select-all"
            title={tabUrl || 'No active tab'}
          >
            {tabUrl || tabHostname || 'https://www.google.com'}
          </span>
        </div>

        {!schemeValid && (
          <div className="shrink-0">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 rounded-md px-2 py-0.5"
              title={schemeReason || 'Unsupported browser scheme'}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Restricted</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
