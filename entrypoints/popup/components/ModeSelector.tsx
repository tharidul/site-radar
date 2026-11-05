/**
 * @file entrypoints/popup/components/ModeSelector.tsx
 * @description Inspection mode selector and audit launch controls with scheme guards.
 * Styled to harmonize with the Website Intelligence redesign.
 */

import React from 'react';
import { Zap, Layers, Compass, Play } from 'lucide-react';
import type { InspectionMode } from '@/types/inspection';

interface ModeSelectorProps {
  selectedMode: InspectionMode;
  onSelectMode: (mode: InspectionMode) => void;
  onStartInspection: () => void;
  disabled: boolean;
  disabledReason?: string;
}

interface ModeOption {
  id: InspectionMode;
  title: string;
  scope: string;
  duration: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODES: ModeOption[] = [
  {
    id: 'quick',
    title: 'Quick Scan',
    scope: 'Passive DOM, SEO metadata, security headers, and Core Web Vitals (8 modules).',
    duration: '~1-2s',
    icon: Zap,
  },
  {
    id: 'full',
    title: 'Full Page Audit',
    scope: 'Complete page inspection with axe-core WCAG 2.1 AA accessibility & structured data.',
    duration: '~3-5s',
    icon: Layers,
  },
  {
    id: 'deep',
    title: 'Deep Inspection',
    scope: 'Full Page Audit + bounded same-origin crawl (robots, sitemaps) & external intel.',
    duration: '~10-20s',
    icon: Compass,
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  onStartInspection,
  disabled,
  disabledReason,
}) => {
  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
            Select Inspection Mode
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Choose depth of passive security, performance, and accessibility checks.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;

          return (
            <div
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`rounded-lg border p-3.5 transition-colors duration-150 cursor-pointer select-none shadow-2xs ${
                isSelected
                  ? 'border-orange-500 bg-white dark:bg-zinc-900'
                  : 'border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-orange-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                      {mode.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Duration: {mode.duration}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pl-9">
                {mode.scope}
              </p>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onStartInspection}
          disabled={disabled}
          className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-colors duration-150 select-none shadow-2xs ${
            disabled
              ? 'border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 cursor-not-allowed'
              : 'bg-[#e88438] hover:bg-orange-600 text-white cursor-pointer hover:shadow-sm'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {disabled
              ? disabledReason || 'Cannot start audit'
              : `Start ${selectedMode === 'quick' ? 'Quick Scan' : selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
          </span>
        </button>
      </div>
    </div>
  );
};
