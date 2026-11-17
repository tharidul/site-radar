import React from 'react';
import { Layers, Compass, Play, ExternalLink } from 'lucide-react';
import type { InspectionMode } from '@/types/inspection';
import { Button } from './Button';
import { openExtensionTab } from '../ext-api';

interface ModeSelectorProps {
  selectedMode: InspectionMode;
  onSelectMode: (mode: InspectionMode) => void;
  onStartInspection: () => void;
  disabled: boolean;
  disabledReason?: string;
  isRequestingPermission?: boolean;
  refreshPage?: boolean;
  onToggleRefreshPage?: (enabled: boolean) => void;
}

interface ModeOption {
  id: InspectionMode;
  title: string;
  scope: string;
  features: string[];
  duration: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODES: ModeOption[] = [
  {
    id: 'full',
    title: 'Full Page Audit',
    scope: 'Audits only the tab currently open.',
    features: ['Page Vitals & DOM', 'Headers & Security', 'SEO & WCAG'],
    duration: '~3-5s',
    icon: Layers,
  },
  {
    id: 'deep',
    title: 'Deep Inspection',
    scope: 'Full audit plus site & server checks.',
    features: ['Multi-Page Crawler', 'Robots & Sitemaps', 'DNS, IP/ASN & TLS'],
    duration: '~10-20s',
    icon: Compass,
  },
];

function openPrivacyPolicy() {
  openExtensionTab('privacy-policy.html');
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  onStartInspection,
  disabled,
  disabledReason,
  isRequestingPermission = false,
  refreshPage = true,
  onToggleRefreshPage,
}) => {
  return (
    <div className="min-h-full p-4 flex flex-col justify-between gap-4 bg-app-bg text-app-fg select-none">
      <div className="space-y-3.5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Audit Mode
          </h2>
        </div>

        <div
          role="radiogroup"
          aria-label="Audit depth"
          className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-3"
        >
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectMode(mode.id)}
                className={`flex flex-col text-left h-full rounded-xl p-3.5 transition-all duration-150 ease-out active:scale-[0.99] cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-surface border-accent ring-1 ring-accent'
                    : 'bg-surface/80 border-app-border hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-accent text-accent-fg'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {mode.title}
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                    {mode.duration}
                  </span>
                </div>

                <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {mode.scope}
                </p>

                <div className="mt-2 text-2xs text-zinc-500 dark:text-zinc-400">
                  {mode.features.join(' · ')}
                </div>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 px-0.5 py-0.5">
          <input
            type="checkbox"
            checked={refreshPage}
            onChange={(e) => onToggleRefreshPage?.(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-accent cursor-pointer"
          />
          <span>Hard refresh (clear cache) before scan</span>
        </label>

        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={disabled || isRequestingPermission}
          isLoading={isRequestingPermission}
          onClick={onStartInspection}
          leftIcon={<Play className="w-4 h-4 fill-current ml-0.5" />}
          className="w-full py-2.5"
        >
          {isRequestingPermission
            ? 'Waiting for site permission…'
            : disabled
            ? disabledReason || 'Cannot start audit'
            : `Start ${selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
        </Button>

        {isRequestingPermission && (
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            Allow site access in the browser address-bar prompt to begin scanning.
          </p>
        )}
      </div>

      <div className="pt-2.5 flex items-center justify-center gap-3 border-t border-app-border text-xs select-none">
        <button
          type="button"
          onClick={() => openExtensionTab('https://tharidulakmal.com')}
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent transition-colors cursor-pointer"
        >
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">LKML</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        <button
          type="button"
          onClick={openPrivacyPolicy}
          className="text-zinc-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent transition-colors cursor-pointer hover:underline"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
};
