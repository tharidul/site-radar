/**
 * @file entrypoints/popup/components/ReportView.tsx
 * @description Report tab providing executive audit summary, audit metadata, and export actions.
 */

import React, { useState } from 'react';
import { FileCode, FileText, Check, ShieldCheck, Clock, Globe, Copy } from 'lucide-react';
import type { WebsiteInspection } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport, copyJsonReport } from '../../../src/export/download';
import { Button } from './Button';
import { Card } from './Card';

interface ReportViewProps {
  inspection: WebsiteInspection;
}

export const ReportView: React.FC<ReportViewProps> = ({ inspection }) => {
  const [downloadedType, setDownloadedType] = useState<'json' | 'html' | null>(null);
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  const handleCopyJson = async () => {
    const success = await copyJsonReport(inspection, { includeRawModules: false, pretty: true });
    if (success) {
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 2000);
    }
  };

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
              <Globe className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
              <span>Target URL:</span>
            </span>
            <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
              {inspection.target?.url}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
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
              {inspection.findings?.length || 0}
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

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleCopyJson}
            className="w-full py-2.5 font-semibold"
            title="Copy sanitized JSON audit report directly to clipboard"
            leftIcon={
              isCopiedJson ? (
                <Check className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
              ) : (
                <Copy className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
              )
            }
          >
            {isCopiedJson ? 'Copied!' : 'Copy JSON'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleExportJson}
            className="w-full py-2.5"
            leftIcon={
              downloadedType === 'json' ? (
                <Check className="w-4 h-4 text-[#152E40]" />
              ) : (
                <FileCode className="w-4 h-4 text-[#152E40]" />
              )
            }
          >
            {downloadedType === 'json' ? 'Downloaded' : 'Export JSON'}
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
            {downloadedType === 'html' ? 'Downloaded' : 'Export HTML'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

