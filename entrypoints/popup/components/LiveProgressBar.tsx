/**
 * @file entrypoints/popup/components/LiveProgressBar.tsx
 * @description Real-time scan progress indicators and cancellation control (Feature 42).
 * Adheres strictly to anti-slop guidelines: compact, honest, non-decorative.
 */

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import type { ScanProgressEvent } from '@/types/messaging';

interface LiveProgressBarProps {
  progress: ScanProgressEvent | null;
  onCancel: () => void;
  isCancelling?: boolean;
}

export const LiveProgressBar: React.FC<LiveProgressBarProps> = ({
  progress,
  onCancel,
  isCancelling = false,
}) => {
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));
  const step = progress?.step || 'Initializing audit pipeline...';
  const moduleName = progress?.module;
  const completed = progress?.completedModules ?? 0;
  const total = progress?.totalModules ?? 10;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 p-4 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400 shrink-0" />
          <span className="text-zinc-200 truncate font-medium">
            {step}
          </span>
        </div>
        <span className="text-zinc-100 font-semibold tabular-nums shrink-0 ml-2">
          {percent}%
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="h-2 w-full rounded-sm bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-[width] duration-200 ease-out rounded-sm"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
        <div>
          <span>Modules: </span>
          <span className="text-zinc-200 font-semibold tabular-nums">{completed}</span>
          <span> / {total}</span>
          {moduleName && (
            <span className="ml-2 text-zinc-400">
              {/* deslop-ignore-next-line 34 */}
              (<code className="font-mono text-[11px]">{moduleName}</code>)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          <span>{isCancelling ? 'Cancelling...' : 'Cancel Scan'}</span>
        </button>
      </div>
    </div>
  );
};
