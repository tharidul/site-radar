
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, ChevronDown, Copy, FileCode, FileText, Check } from 'lucide-react';
import type { WebsiteInspection } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport, copyJsonReport } from '../../../src/export/download';

interface ExportDropdownProps {
  inspection: WebsiteInspection;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
  className?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  inspection,
  align = 'left',
  direction = 'up',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2200);
  };

  const handleCopy = useCallback(async () => {
    setIsOpen(false);
    const success = await copyJsonReport(inspection, { includeRawModules: false, pretty: true });
    if (success) {
      showFeedback('JSON Copied!');
    }
  }, [inspection]);

  const handleExportJson = useCallback(() => {
    setIsOpen(false);
    downloadJsonReport(inspection, { includeRawModules: false, pretty: true });
    showFeedback('JSON Exported');
  }, [inspection]);

  const handleExportHtml = useCallback(() => {
    setIsOpen(false);
    downloadHtmlReport(inspection);
    showFeedback('HTML Exported');
  }, [inspection]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 ease-out cursor-pointer shadow-2xs ${
          feedback
            ? 'border-[#CEFF52]/60 text-[#152E40] dark:text-[#CEFF52] bg-[#CEFF52]/10 ring-2 ring-[#CEFF52]/30'
            : isOpen
              ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
        }`}
        title="Export or copy audit report"
      >
        {feedback ? (
          <Check className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
        ) : (
          <Download className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
        )}
        <span>{feedback || 'Export'}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${
            isOpen ? (direction === 'up' ? '' : 'rotate-180') : (direction === 'up' ? 'rotate-180' : '')
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Export options"
          className={`absolute z-50 min-w-[210px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-lg text-xs transition-all duration-150 ease-out animate-in fade-in zoom-in-95 ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Report Actions
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-[#CEFF52] shrink-0" />
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Copy JSON
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Direct to clipboard
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
              JSON
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleExportJson}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-[#CEFF52] shrink-0" />
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Export JSON
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Full inspection data
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
              .json
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleExportHtml}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-[#CEFF52] shrink-0" />
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Export HTML
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Standalone executive report
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
              .html
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

