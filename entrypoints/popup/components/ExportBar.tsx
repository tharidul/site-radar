/**
 * @file entrypoints/popup/components/ExportBar.tsx
 * @description Export controls triggering browser Blob downloads for sanitized JSON and HTML reports (Features 48 & 49).
 * Adheres strictly to anti-slop guidelines: compact, functional, high information density.
 */

import React, { useState } from 'react';
import { FileCode, FileText, Check } from 'lucide-react';
import type { WebsiteInspection } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport } from '../../../src/export/download';
import { Button } from './Button';

interface ExportBarProps {
  inspection: WebsiteInspection;
}

export const ExportBar: React.FC<ExportBarProps> = ({ inspection }) => {
  const [downloadedType, setDownloadedType] = useState<'json' | 'html' | null>(null);

  const handleExportJson = () => {
    downloadJsonReport(inspection, { includeRawModules: false, pretty: true });
    setDownloadedType('json');
    setTimeout(() => setDownloadedType(null), 2000);
  };

  const handleExportHtml = () => {
    downloadHtmlReport(inspection);
    setDownloadedType('html');
    setTimeout(() => setDownloadedType(null), 2000);
  };

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 p-4 space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
          Export Report
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Client-side download
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={handleExportJson}
          className="w-full py-2.5 font-semibold text-zinc-800 dark:text-zinc-200"
          title="Export sanitized, schema-compliant JSON report"
          leftIcon={
            downloadedType === 'json' ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileCode className="w-4 h-4 text-orange-500" />
            )
          }
        >
          {downloadedType === 'json' ? 'JSON Exported' : 'Export JSON'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={handleExportHtml}
          className="w-full py-2.5 font-semibold text-zinc-800 dark:text-zinc-200"
          title="Export self-contained standalone HTML report with zero external CDN calls"
          leftIcon={
            downloadedType === 'html' ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileText className="w-4 h-4 text-orange-500" />
            )
          }
        >
          {downloadedType === 'html' ? 'HTML Exported' : 'Export HTML'}
        </Button>
      </div>
    </div>
  );
};
