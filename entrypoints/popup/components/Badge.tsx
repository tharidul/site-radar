import React from 'react';
import type { Severity, FindingStatus, CollectionStatus } from '@/types/inspection';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'severity' | 'status' | 'collection' | 'neutral';
  severity?: Severity;
  status?: FindingStatus;
  collectionStatus?: CollectionStatus;
  size?: 'xs' | 'sm';
  children?: React.ReactNode;
}

export const BADGE_BASE_CLASSES =
  'inline-flex items-center justify-center gap-1 text-2xs font-bold px-2 py-0.5 rounded leading-none select-none shadow-2xs shrink-0';

export function getSeverityLabel(severity?: Severity): string {
  if (!severity) return 'Info';
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    case 'info':
      return 'Info';
    default:
      return String(severity);
  }
}

export function getSeverityBadgeClasses(severity?: Severity): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'bg-rose-600 text-white font-bold shadow-2xs';
    case 'medium':
      return 'bg-amber-600 text-white font-bold shadow-2xs';
    case 'low':
      return 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
    case 'info':
      return 'bg-sky-600 text-white font-bold shadow-2xs';
    default:
      return 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
  }
}

export function getStatusLabel(status?: FindingStatus): string {
  if (!status) return 'N/A';
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'warning':
      return 'Warning';
    case 'info':
      return 'Info';
    case 'not-applicable':
    case 'not-available':
      return 'N/A';
    default:
      return String(status);
  }
}

export function getStatusBadgeClasses(status?: FindingStatus): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-600 text-white font-bold shadow-2xs';
    case 'failed':
      return 'bg-rose-600 text-white font-bold shadow-2xs';
    case 'warning':
      return 'bg-amber-600 text-white font-bold shadow-2xs';
    case 'info':
      return 'bg-sky-600 text-white font-bold shadow-2xs';
    case 'not-applicable':
    case 'not-available':
    default:
      return 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
  }
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
  let colorClasses = 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
  let defaultLabel: React.ReactNode = children;

  if (variant === 'status' && status) {
    colorClasses = getStatusBadgeClasses(status);
    if (!defaultLabel) {
      defaultLabel = getStatusLabel(status);
    }
  } else if (variant === 'collection' && collectionStatus) {
    switch (collectionStatus) {
      case 'completed':
        colorClasses = 'bg-emerald-600 text-white font-bold shadow-2xs';
        defaultLabel = defaultLabel || 'Ready';
        break;
      case 'partial':
        colorClasses = 'bg-amber-600 text-white font-bold shadow-2xs';
        defaultLabel = defaultLabel || 'Partial';
        break;
      case 'blocked':
      case 'failed':
        colorClasses = 'bg-rose-600 text-white font-bold shadow-2xs';
        defaultLabel = defaultLabel || 'Failed';
        break;
      case 'skipped':
        colorClasses = 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
        defaultLabel = defaultLabel || 'Skipped';
        break;
      case 'unsupported':
      default:
        colorClasses = 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
        defaultLabel = defaultLabel || 'Unsupported';
        break;
    }
  } else if (variant === 'severity' && severity) {
    if (status === 'passed' || status === 'not-applicable' || status === 'not-available') {
      colorClasses = 'bg-zinc-600 dark:bg-zinc-700 text-white font-bold shadow-2xs';
      if (!defaultLabel) defaultLabel = getStatusLabel(status);
    } else {
      colorClasses = getSeverityBadgeClasses(severity);
      if (!defaultLabel) defaultLabel = getSeverityLabel(severity);
    }
  }

  // Consistent unified badge size across the entire application
  const sizeClasses = 'text-2xs px-2 py-0.5 rounded leading-none';

  return (
    <span
      {...props}
      className={`inline-flex items-center justify-center gap-1 shrink-0 select-none ${sizeClasses} ${colorClasses} ${className}`}
    >
      {defaultLabel}
    </span>
  );
};
