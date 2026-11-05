/**
 * @file src/export/json.exporter.ts
 * @description Sanitized JSON audit report exporter.
 * Applies zero-secret redaction, ISO-8601 normalization, and produces structured,
 * schema-compliant audit exports.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 13, Feature 48.
 */

import type { WebsiteInspection, CollectionStatus, CollectionCoverage, Severity, FindingStatus, Evidence } from '@/types/inspection';
import { redactSecrets } from '@/security/secret-redactor';

export interface JsonExportOptions {
  /** If true, includes raw module payloads; if false, exports module execution summaries. Default: false */
  includeRawModules?: boolean;
  /** If true, formats output with 2-space indentation. Default: true */
  pretty?: boolean;
}

export interface SanitizedModuleSummary {
  module: string;
  status: CollectionStatus;
  collectedAt: string;
  coverage: CollectionCoverage;
  limitations: string[];
  errors: string[];
  sources: string[];
  data?: unknown;
}

export interface SanitizedJsonReport {
  schemaVersion: '1.0.0';
  exportFormat: 'website-intelligence-json';
  exportedAt: string;
  id: string;
  mode: string;
  target: {
    url: string;
    origin: string;
    hostname: string;
    inspectedAt: string;
  };
  browser: unknown;
  scores: Record<string, unknown>;
  summary: unknown;
  modules: Record<string, SanitizedModuleSummary>;
  findings: Array<{
    id: string;
    category: string;
    ruleId: string;
    title: string;
    description: string;
    severity: Severity;
    status: FindingStatus;
    confidence?: number;
    evidence: Evidence[];
    expectedBehavior?: string;
    explanation?: string;
    recommendation?: string;
    source: string;
    references?: string[];
  }>;
  durationMs?: number;
}

export function exportToJson(
  inspection: WebsiteInspection,
  options?: JsonExportOptions,
): string {
  const pretty = options?.pretty ?? true;
  const includeRaw = options?.includeRawModules ?? false;

  const modulesSummary: Record<string, SanitizedModuleSummary> = {};
  if (inspection.modules) {
    for (const [key, mod] of Object.entries(inspection.modules)) {
      if (!mod) continue;
      const collectedDate = mod.collectedAt
        ? new Date(mod.collectedAt).toISOString()
        : new Date().toISOString();

      modulesSummary[key] = {
        module: mod.module || key,
        status: mod.status,
        collectedAt: collectedDate,
        coverage: mod.coverage || { supported: true },
        limitations: Array.isArray(mod.limitations) ? mod.limitations : [],
        errors: Array.isArray(mod.errors) ? mod.errors : [],
        sources: Array.isArray(mod.sources) ? mod.sources : [],
        ...(includeRaw && mod.data !== undefined ? { data: mod.data } : {}),
      };
    }
  }

  const inspectedAtDate = inspection.target?.inspectedAt
    ? new Date(inspection.target.inspectedAt).toISOString()
    : new Date().toISOString();

  const exportPayload: Record<string, unknown> = {
    schemaVersion: '1.0.0',
    exportFormat: 'website-intelligence-json',
    exportedAt: new Date().toISOString(),
    id: inspection.id || `inspection_${Date.now()}`,
    mode: inspection.mode || 'quick',
    target: {
      url: inspection.target?.url || '',
      origin: inspection.target?.origin || '',
      hostname: inspection.target?.hostname || '',
      inspectedAt: inspectedAtDate,
    },
    browser: inspection.browser || { name: 'chrome' },
    scores: inspection.scores || {},
    summary: inspection.summary || {
      completedModules: 0,
      partialModules: 0,
      failedModules: 0,
      totalFindings: inspection.findings?.length || 0,
    },
    modules: modulesSummary,
    findings: (inspection.findings || []).map((f) => ({
      id: f.id,
      category: f.category,
      ruleId: f.ruleId,
      title: f.title,
      description: f.description,
      severity: f.severity,
      status: f.status,
      confidence: f.confidence,
      evidence: Array.isArray(f.evidence) ? f.evidence : [],
      expectedBehavior: f.expectedBehavior,
      explanation: f.explanation,
      recommendation: f.recommendation,
      source: f.source,
      references: f.references,
    })),
    durationMs:
      inspection.completedAt && inspection.startedAt
        ? inspection.completedAt - inspection.startedAt
        : undefined,
  };

  // Rigorous invariant: recursive zero-secret scrub
  const sanitized = redactSecrets(exportPayload);

  return JSON.stringify(sanitized, null, pretty ? 2 : 0);
}
