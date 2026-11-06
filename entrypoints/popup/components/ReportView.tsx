/**
 * @file entrypoints/popup/components/ReportView.tsx
 * @description Report tab providing executive audit summary, audit metadata, and export actions.
 */

import React, { useState } from 'react';
import { FileCode, FileText, Check, ShieldCheck, Clock, Globe } from 'lucide-react';
import type { WebsiteInspection } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport } from '../../../src/export/download';
import { Button } from './Button';
import { Card } from './Card';

interface ReportViewProps {
  inspection: WebsiteInspection;
}

export const ReportView: React.FC<ReportViewProps> = ({ inspection }) => {
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
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Export Audit Report
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Download your full audit as a standalone HTML page or structured JSON file.
          </p>
        </div>
      </div>

      {/* Metadata Card */}
      <Card padding="md" className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-orange-500" />
              <span>Target URL:</span>
            </span>
            <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
              {inspection.target?.url}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              <span>Audit Time:</span>
            </span>
            <div className="text-zinc-800 dark:text-zinc-200 mt-0.5">
              {new Date(inspection.startedAt).toLocaleString()}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Mode:</span>
            <div className="capitalize font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
              {inspection.mode} Scan
            </div>
          </div>

          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Total Findings:</span>
            <div className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 tabular-nums">
              {inspection.findings?.length || 0} findings evaluated
            </div>
          </div>
        </div>
      </Card>

      {/* Export Action Card */}
      <Card padding="md" className="space-y-3">
        <div>
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            Download Audit Artifacts
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Choose between machine-readable JSON or standalone styled HTML presentation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleExportJson}
            className="w-full py-2.5"
            leftIcon={
              downloadedType === 'json' ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <FileCode className="w-4 h-4 text-white" />
              )
            }
          >
            {downloadedType === 'json' ? 'JSON Downloaded' : 'Export JSON Report'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleExportHtml}
            className="w-full py-2.5"
            leftIcon={
              downloadedType === 'html' ? (
                <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              ) : (
                <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              )
            }
          >
            {downloadedType === 'html' ? 'HTML Downloaded' : 'Export HTML Report'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

