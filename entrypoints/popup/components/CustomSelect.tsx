/**
 * @file entrypoints/popup/components/CustomSelect.tsx
 * @description Sleek, accessible custom dropdown select matching the Website Intelligence design system.
 * Replaces ugly browser-native <select> popups with theme-aware custom menus.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  fullWidth?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  className = '',
  menuClassName = '',
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click or Escape key (rerender-split-combined-hooks)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left select-none ${fullWidth ? 'w-full' : ''}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 focus:outline-none transition-colors shadow-2xs flex items-center justify-between gap-1.5 cursor-pointer ${
          fullWidth ? 'w-full' : 'min-w-[110px]'
        } ${className}`}
      >
        <span className="truncate font-semibold">
          {selectedOption ? selectedOption.label : placeholder || 'Select'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 top-full mt-1 z-50 min-w-full w-max max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-lg text-xs transition-opacity duration-150 ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const Icon = option.icon;

            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors duration-100 ${
                  isSelected
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold'
                    : 'text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

