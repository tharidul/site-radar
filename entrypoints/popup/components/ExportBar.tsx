/**
 * @file entrypoints/popup/components/ExportBar.tsx
 * @description Export controls triggering browser Blob downloads for sanitized JSON and HTML reports (Features 48 & 49).
 * Adheres strictly to anti-slop guidelines: compact, functional, high information density.
 */

import React, { useState } from 'react';
import { Download, FileCode, FileText, Check } from 'lucide-react';
import type { WebsiteInspection } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport } from '../../../src/export/download';

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
    <div className="border-b border-zinc-800 bg-zinc-950 p-4 space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">
          Export Report
        </span>
        <span className="text-xs text-zinc-400">
          Client-side download
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportJson}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 px-3 text-sm font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Export sanitized, schema-compliant JSON report"
        >
          {downloadedType === 'json' ? (
            <Check className="w-4 h-4 text-zinc-100" />
          ) : (
            <FileCode className="w-4 h-4 text-orange-400" />
          )}
          <span>{downloadedType === 'json' ? 'JSON Exported' : 'Export JSON'}</span>
        </button>

        <button
          type="button"
          onClick={handleExportHtml}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 px-3 text-sm font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Export self-contained standalone HTML report with zero external CDN calls"
        >
          {downloadedType === 'html' ? (
            <Check className="w-4 h-4 text-zinc-100" />
          ) : (
            <FileText className="w-4 h-4 text-orange-400" />
          )}
          <span>{downloadedType === 'html' ? 'HTML Exported' : 'Export HTML'}</span>
        </button>
      </div>
    </div>
  );
};
