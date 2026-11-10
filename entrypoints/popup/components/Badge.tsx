
import React from 'react';
import type { Severity, FindingStatus, CollectionStatus } from '@/types/inspection';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'severity' | 'status' | 'collection' | 'neutral';
  severity?: Severity;
  status?: FindingStatus;
  collectionStatus?: CollectionStatus;
  size?: 'xs' | 'sm';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  severity,
  status,
  collectionStatus,
  size = 'xs',
  children,
  className = '',
  ...props
}) => {
  let colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-medium';
  let animationClass = '';

  if (variant === 'status' && status) {
    switch (status) {
      case 'passed':
        colorClasses = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold';
        break;
      case 'failed':
        colorClasses = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-bold';
        break;
      case 'warning':
        colorClasses = 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30 font-bold';
        break;
      case 'info':
        colorClasses = 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30 font-semibold';
        break;
      case 'not-applicable':
      case 'not-available':
      default:
        colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium';
        break;
    }
  } else if (variant === 'collection' && collectionStatus) {
    switch (collectionStatus) {
      case 'completed':
        colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 font-semibold';
        break;
      case 'partial':
        colorClasses = 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30 font-semibold';
        break;
      case 'blocked':
      case 'failed':
        colorClasses = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-semibold';
        break;
      case 'unsupported':
      case 'skipped':
      default:
        colorClasses = 'bg-zinc-100/80 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 font-medium';
        break;
    }
  } else if (variant === 'severity' && severity) {
    if (status === 'passed' || status === 'not-applicable' || status === 'not-available') {
      colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium';
    } else {
      switch (severity) {
        case 'critical':
          colorClasses = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-bold';
          break;
        case 'high':
        case 'medium':
          colorClasses = 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30 font-bold';
          break;
        case 'low':
          colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-medium';
          break;
        case 'info':
        default:
          colorClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium';
          break;
      }
    }
  }

  const sizeClasses = size === 'xs' ? 'text-2xs px-1.5 py-0.5 rounded-md' : 'text-xs px-2 py-0.5 rounded-md';

  return (
    <span
      {...props}
      className={`inline-flex items-center uppercase tracking-wider shrink-0 select-none ${sizeClasses} ${colorClasses} ${animationClass} ${className}`}
    >
      {children}
    </span>
  );
};
