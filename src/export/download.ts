/**
 * @file src/export/download.ts
 * @description Safe cross-browser Blob download trigger utility for Chrome MV3 and Firefox MV3.
 * Adheres strictly to least privilege: does not require chrome.downloads permission.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 13.
 */

import type { WebsiteInspection } from '@/types/inspection';
import { exportToJson, type JsonExportOptions } from './json.exporter';
import { exportToHtml } from './html.exporter';

/**
 * Sanitizes an arbitrary string into a safe filename component.
 */
export function sanitizeFilenamePart(name: string): string {
  if (!name || typeof name !== 'string') return 'audit';
  return name
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .toLowerCase() || 'audit';
}

/**
 * Generates standard report filenames conforming to project pattern:
 * website-intelligence-${hostname}-${mode}-${date}.${extension}
 */
export function generateReportFilename(
  hostname: string,
  mode: string,
  extension: 'json' | 'html',
  timestamp = Date.now(),
): string {
  const safeHost = sanitizeFilenamePart(hostname);
  const safeMode = sanitizeFilenamePart(mode);
  const dateStr = new Date(timestamp).toISOString().split('T')[0];
  return `website-intelligence-${safeHost}-${safeMode}-${dateStr}.${extension}`;
}

/**
 * Initiates a browser Blob download using temporary DOM anchor click.
 * Universal across Chrome and Firefox extension contexts without requiring 'downloads' permission.
 */
export function triggerBlobDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('Failed to trigger download:', err);
  }
}

/**
 * Exports and downloads the current inspection as a sanitized JSON file.
 */
export function downloadJsonReport(
  inspection: WebsiteInspection,
  options?: JsonExportOptions,
): void {
  const json = exportToJson(inspection, options);
  const filename = generateReportFilename(
    inspection.target?.hostname || 'audit',
    inspection.mode || 'quick',
    'json',
    inspection.target?.inspectedAt || Date.now(),
  );
  triggerBlobDownload(json, filename, 'application/json;charset=utf-8');
}

/**
 * Exports and downloads the current inspection as a self-contained HTML file.
 */
export function downloadHtmlReport(inspection: WebsiteInspection): void {
  const html = exportToHtml(inspection);
  const filename = generateReportFilename(
    inspection.target?.hostname || 'audit',
    inspection.mode || 'quick',
    'html',
    inspection.target?.inspectedAt || Date.now(),
  );
  triggerBlobDownload(html, filename, 'text/html;charset=utf-8');
}
