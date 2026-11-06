/**
 * @file entrypoints/popup/components/ModeSelector.tsx
 * @description Inspection mode selector and audit launch controls with scheme guards.
 * Styled to harmonize with the Website Intelligence redesign.
 */

import React from 'react';
import { Zap, Layers, Compass, Play } from 'lucide-react';
import type { InspectionMode } from '@/types/inspection';
import { Button } from './Button';

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
    scope: 'Headers, scripts, meta tags, and web vitals.',
    duration: '~1-2s',
    icon: Zap,
  },
  {
    id: 'full',
    title: 'Full Page Audit',
    scope: 'Complete audit with WCAG accessibility and structured data.',
    duration: '~3-5s',
    icon: Layers,
  },
  {
    id: 'deep',
    title: 'Deep Inspection',
    scope: 'Full audit plus linked pages, sitemaps, and DNS lookups.',
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
            Choose Audit Depth
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Pick how deep you want the security, speed, and accessibility checks to go.
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
              className={`rounded-xl p-3.5 transition-all duration-150 cursor-pointer select-none shadow-xs ${
                isSelected
                  ? 'bg-white dark:bg-zinc-900 ring-2 ring-orange-500'
                  : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
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
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={disabled}
          onClick={onStartInspection}
          leftIcon={<Play className="w-4 h-4 fill-current" />}
          className="w-full py-3"
        >
          {disabled
            ? disabledReason || 'Cannot start audit'
            : `Start ${selectedMode === 'quick' ? 'Quick Scan' : selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
        </Button>
      </div>
    </div>
  );
};
