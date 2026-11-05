/**
 * @file entrypoints/popup/components/ModeSelector.tsx
 * @description Inspection mode selector and launch controls with non-inspectable scheme guards.
 * Conforms to anti-slop guidelines: compact, functional, zero decorative fluff.
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
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Inspection Mode
        </span>
        <span className="text-xs text-zinc-400">Select audit depth</span>
      </div>

      <div className="space-y-2">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;

          return (
            <div
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`rounded-xl border p-2.5 transition-all cursor-pointer select-none ${
                isSelected
                  ? 'border-orange-500/80 bg-zinc-900 text-zinc-100 ring-1 ring-orange-500/50'
                  : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span className="text-sm font-semibold">{mode.title}</span>
                </div>
                <span className="text-xs font-mono text-zinc-400 shrink-0">
                  {mode.duration}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-zinc-400 leading-relaxed pl-6">
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
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors select-none ${
            disabled
              ? 'border border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
              : 'border border-orange-600 bg-orange-500 text-zinc-950 hover:bg-orange-400 cursor-pointer font-semibold shadow-sm'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>
            {disabled
              ? disabledReason || 'Cannot start audit'
              : `Run ${selectedMode === 'quick' ? 'Quick Scan' : selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
          </span>
        </button>
      </div>
    </div>
  );
};
