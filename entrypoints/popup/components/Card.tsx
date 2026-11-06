/**
 * @file entrypoints/popup/components/Card.tsx
 * @description Unified Card primitive following the single-component rule.
 * Standardizes card containers, borders, backgrounds, and padding with zero redundancy.
 */

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  children,
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  }[padding];

  return (
    <div
      {...props}
      className={`rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs transition-colors ${paddingClasses} ${className}`}
    >
      {children}
    </div>
  );
};

