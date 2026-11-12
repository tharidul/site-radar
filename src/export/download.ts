
import type { WebsiteInspection, AuditFinding } from '@/types/inspection';
import { exportToJson, type JsonExportOptions } from './json.exporter';
import { exportToHtml } from './html.exporter';

export function sanitizeFilenamePart(name: string): string {
  if (!name || typeof name !== 'string') return 'audit';
  return name
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .toLowerCase() || 'audit';
}

export function generateReportFilename(
  hostname: string,
  mode: string,
  extension: 'json' | 'html',
  timestamp = Date.now(),
): string {
  const safeHost = sanitizeFilenamePart(hostname);
  const safeMode = sanitizeFilenamePart(mode);
  const dateStr = new Date(timestamp).toISOString().split('T')[0];
  return `siteradar-${safeHost}-${safeMode}-${dateStr}.${extension}`;
}

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

export function downloadJsonReport(
  inspection: WebsiteInspection,
  options?: JsonExportOptions,
): void {
  const json = exportToJson(inspection, options);
  const filename = generateReportFilename(
    inspection.target?.hostname || 'audit',
    inspection.mode || 'full',
    'json',
    inspection.target?.inspectedAt || Date.now(),
  );
  triggerBlobDownload(json, filename, 'application/json;charset=utf-8');
}

export async function copyJsonReport(
  inspection: WebsiteInspection,
  options?: JsonExportOptions,
): Promise<boolean> {
  const json = exportToJson(inspection, options);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, using textarea fallback:', err);
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch (err) {
    console.error('Fallback copy to clipboard failed:', err);
  }

  return false;
}

export async function copyFindingJson(finding: AuditFinding): Promise<boolean> {
  const json = JSON.stringify(finding, null, 2);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, using textarea fallback:', err);
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch (err) {
    console.error('Fallback copy to clipboard failed:', err);
  }

  return false;
}

export function downloadHtmlReport(inspection: WebsiteInspection): void {
  const html = exportToHtml(inspection);
  const filename = generateReportFilename(
    inspection.target?.hostname || 'audit',
    inspection.mode || 'full',
    'html',
    inspection.target?.inspectedAt || Date.now(),
  );
  triggerBlobDownload(html, filename, 'text/html;charset=utf-8');
}
