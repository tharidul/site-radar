
import React from 'react';
import { X, Loader2 } from 'lucide-react';
import type { ScanProgressEvent } from '@/types/messaging';
import { Button } from './Button';

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
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex animate-spin text-orange-500 dark:text-orange-400 shrink-0">
            <Loader2 className="w-3.5 h-3.5" />
          </span>
          <span className="text-zinc-800 dark:text-zinc-200 truncate font-medium">
            {step}
          </span>
        </div>
        <span className="text-zinc-900 dark:text-zinc-100 font-bold tabular-nums shrink-0 ml-2">
          {percent}%
        </span>
      </div>

      <div className="h-2 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-[width] duration-200 ease-out rounded-sm"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 pt-0.5">
        <div>
          <span>Modules: </span>
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold tabular-nums">{completed}</span>
          <span> / {total}</span>
          {moduleName && (
            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
              (<code className="font-mono text-[11px]">{moduleName}</code>)
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isCancelling}
          leftIcon={<X className="w-3 h-3 text-current" />}
          className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400"
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Scan'}
        </Button>
      </div>
    </div>
  );
};
