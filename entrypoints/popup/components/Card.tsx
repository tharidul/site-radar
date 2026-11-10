
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
      className={`rounded-md bg-white dark:bg-zinc-900 shadow-xs transition-colors ${paddingClasses} ${className}`}
    >
      {children}
    </div>
  );
};

