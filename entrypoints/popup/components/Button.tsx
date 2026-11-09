/**
 * @file entrypoints/popup/components/Button.tsx
 * @description Unified, accessible Button primitive following the single-component rule.
 * Eliminates redundant ad-hoc button styling across views and dialogs.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#CEFF52] hover:bg-[#bbf03e] active:bg-[#aade2f] text-[#152E40] font-bold shadow-xs border-transparent',
  secondary:
    'bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold border border-zinc-200/80 dark:border-transparent',
  outline:
    'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700 text-zinc-800 dark:text-zinc-300 font-medium shadow-2xs',
  ghost:
    'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 active:bg-zinc-200 dark:active:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border-transparent',
  danger:
    'bg-[#CEFF52]/15 hover:bg-[#CEFF52]/25 active:bg-[#CEFF52]/35 text-[#152E40] dark:text-[#CEFF52] font-semibold border border-[#CEFF52]/30',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs rounded-md gap-1',
  md: 'px-3 py-1.5 text-xs font-semibold rounded-lg gap-1.5',
  lg: 'px-4 py-2 text-sm font-bold rounded-lg gap-2',
  icon: 'p-1.5 rounded-md justify-center',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center transition-all duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#CEFF52]/50 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${
        VARIANT_STYLES[variant]
      } ${SIZE_STYLES[size]} ${className}`}
    >
      {isLoading ? (
        <span className="inline-flex animate-spin shrink-0">
          <Loader2 className="w-3.5 h-3.5" />
        </span>
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

