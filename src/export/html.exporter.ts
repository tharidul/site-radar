/**
 * @file src/export/html.exporter.ts
 * @description Anti-slop, standalone, self-contained HTML audit report exporter.
 * Features zinc-950 dark theme, semantic HTML5 <details>/<summary> accordions,
 * multi-layered anti-XSS defense, zero remote CDN calls, and complete secret redaction.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 13, Feature 49,
 * and .agents/skills/anti-slop-frontend-design/SKILL.md.
 */

import type { WebsiteInspection, AuditFinding, CategoryScore, CollectionResult } from '@/types/inspection';
import { redactSecrets } from '@/security/secret-redactor';

/**
 * Strict HTML entity escaping for text nodes and quoted attribute contexts.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  const s = typeof str === 'string' ? str : String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs for href/src attributes to block javascript:, data:, vbscript: injection.
 */
export function sanitizeHref(url: unknown): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|mailto:|#)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '#';
}

/**
 * Formats evidence values safely into escaped string or JSON representation.
 */
export function formatEvidenceValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return escapeHtml(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  identity: 'Overview & Identity',
  seo: 'SEO & Metadata',
  securityHeaders: 'Security & Headers',
  performance: 'Performance & Web Vitals',
  accessibility: 'Accessibility (axe-core)',
  technology: 'Technology & Frameworks',
  dns: 'Infrastructure & DNS',
  resources: 'Resources & Assets',
  privacy: 'Privacy & Trackers',
  content: 'Content & DOM Structure',
  links: 'Links Inventory',
  media: 'Images & Media',
  forms: 'Forms & Inputs',
  css: 'CSS & Styles',
  javascript: 'JavaScript & Scripts',
  crawler: 'Deep Crawl & Sitemaps',
  tls: 'TLS Security',
  asn: 'IP & ASN Intelligence',
  ctLogs: 'Certificate Transparency',
  bestPractices: 'Best Practices & Standards',
  'best-practices': 'Best Practices & Standards',
};

export function exportToHtml(inspection: WebsiteInspection): string {
  // 1. Scrub entire inspection structure of any secrets
  const sanitized = redactSecrets(inspection);

  const targetUrl = sanitizeHref(sanitized.target?.url);
  const rawTargetUrl = sanitized.target?.url || '';
  const hostname = escapeHtml(sanitized.target?.hostname || 'Target Site');
  const mode = escapeHtml((sanitized.mode || 'quick').toUpperCase());
  const dateStr = escapeHtml(
    sanitized.target?.inspectedAt
      ? new Date(sanitized.target.inspectedAt).toUTCString()
      : new Date().toUTCString(),
  );
  const findings: AuditFinding[] = sanitized.findings || [];
  const scores: Record<string, CategoryScore> = sanitized.scores || {};
  const modules: Record<string, CollectionResult<unknown>> = (sanitized.modules as any) || {};

  const durationMs =
    sanitized.completedAt && sanitized.startedAt
      ? sanitized.completedAt - sanitized.startedAt
      : undefined;

  // Severity counts
  const critCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const medCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  // Build category score summary cards
  const scoreCardsHtml = Object.entries(scores)
    .map(([cat, score]: [string, CategoryScore]) => {
      const scoreVal = Math.round(score.score);
      const color =
        scoreVal >= 90
          ? '#f3f1f1'
          : scoreVal >= 70
          ? '#e88438'
          : scoreVal >= 50
          ? '#e88438'
          : '#c8301e';

      return `
        <div class="score-card">
          <div class="score-header">
            <span class="score-cat">${escapeHtml(cat.toUpperCase())}</span>
            <span class="score-val" style="color: ${color}">${scoreVal}<span class="score-max">/100</span></span>
          </div>
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width: ${scoreVal}%; background: ${color}"></div>
          </div>
          <div class="score-stats">
            <span class="stat-p">${score.passed ?? 0} passed</span> &middot;
            <span class="stat-w">${score.warnings ?? 0} warn</span> &middot;
            <span class="stat-f">${score.failed ?? 0} fail</span>
          </div>
        </div>
      `;
    })
    .join('');

  // 10 canonical module accordions
  const canonicalModuleKeys = [
    'identity',
    'seo',
    'securityHeaders',
    'performance',
    'accessibility',
    'technology',
    'dns',
    'resources',
    'privacy',
    'content',
  ];

  const moduleAccordionsHtml = canonicalModuleKeys
    .map((key) => {
      const mod = modules[key];
      const displayName = MODULE_DISPLAY_NAMES[key] || key;
      const status = mod?.status || 'skipped';
      const limitations = mod?.limitations || [];
      const sources = mod?.sources || [];
      const errors = mod?.errors || [];

      let statusColor = '#7f7c7c';
      if (status === 'completed') statusColor = '#f3f1f1';
      else if (status === 'partial') statusColor = '#e88438';
      else if (status === 'failed' || status === 'blocked') statusColor = '#c8301e';

      const limitationsHtml =
        limitations.length > 0
          ? `<div class="mod-limitations"><strong>Limitations:</strong> ${limitations.map((l) => escapeHtml(l)).join('; ')}</div>`
          : '';

      const sourcesHtml =
        sources.length > 0
          ? `<div class="mod-sources"><strong>Sources:</strong> ${sources.map((s) => escapeHtml(s)).join(', ')}</div>`
          : '';

      const errorsHtml =
        errors.length > 0
          ? `<div class="mod-errors"><strong>Errors:</strong> ${errors.map((e) => escapeHtml(e)).join('; ')}</div>`
          : '';

      return `
        <details class="mod-accordion">
          <summary class="mod-summary">
            <span class="mod-title">${escapeHtml(displayName)}</span>
            <span class="mod-status-badge" style="color: ${statusColor}; border-color: ${statusColor}">
              ${escapeHtml(status.toUpperCase())}
            </span>
          </summary>
          <div class="mod-content">
            <div class="mod-meta">
              <span>Status: <code>${escapeHtml(status)}</code></span>
              ${mod?.collectedAt ? `<span>Collected: <code>${escapeHtml(new Date(mod.collectedAt).toISOString())}</code></span>` : ''}
            </div>
            ${limitationsHtml}
            ${sourcesHtml}
            ${errorsHtml}
          </div>
        </details>
      `;
    })
    .join('');

  // Build findings list
  const findingsHtml = findings
    .map((f: AuditFinding) => {
      const sev = escapeHtml(f.severity);
      const sevUpper = escapeHtml(f.severity.toUpperCase());
      const status = escapeHtml(f.status);
      const statusUpper = escapeHtml(f.status.toUpperCase());

      const evidenceHtml =
        f.evidence && f.evidence.length > 0
          ? `
            <div class="evidence-wrapper">
              <table class="evidence-table">
                <thead>
                  <tr><th>Label</th><th>Observed Value</th><th>Source</th></tr>
                </thead>
                <tbody>
                  ${f.evidence
                    .map(
                      (e) => `
                        <tr>
                          <td class="ev-label">${escapeHtml(e.label)}</td>
                          <td class="ev-val"><code>${formatEvidenceValue(e.value)}</code></td>
                          <td class="ev-src">${escapeHtml(e.source || 'DOM')}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '';

      const refsHtml =
        f.references && f.references.length > 0
          ? `
            <div class="finding-refs">
              <span class="refs-label">REFERENCES:</span>
              ${f.references
                .map((ref) => `<a href="${sanitizeHref(ref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref)}</a>`)
                .join(', ')}
            </div>
          `
          : '';

      return `
        <article class="finding-card sev-${sev}" data-severity="${sev}">
          <header class="finding-header">
            <div class="finding-meta">
              <span class="pill pill-sev sev-${sev}">${sevUpper}</span>
              <span class="pill pill-status status-${status}">${statusUpper}</span>
              <span class="rule-id">${escapeHtml(f.ruleId)}</span>
              ${f.category ? `<span class="cat-id">${escapeHtml(f.category)}</span>` : ''}
            </div>
            <h3 class="finding-title">${escapeHtml(f.title)}</h3>
          </header>
          <p class="finding-desc">${escapeHtml(f.description)}</p>
          ${
            f.expectedBehavior
              ? `<div class="finding-expected"><span class="expected-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted);">EXPECTED:</span> ${escapeHtml(f.expectedBehavior)}</div>`
              : ''
          }
          ${
            f.explanation
              ? `<div class="finding-expl"><span class="expl-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted);">EXPLANATION:</span> ${escapeHtml(f.explanation)}</div>`
              : ''
          }
          ${
            f.recommendation
              ? `<div class="finding-recom"><span class="recom-label">REMEDIATION:</span> ${escapeHtml(f.recommendation)}</div>`
              : ''
          }
          ${evidenceHtml}
          ${refsHtml}
        </article>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none';">
  <title>Website Intelligence Report &mdash; ${hostname}</title>
  <style>
    :root {
      --color-1: #e88438;
      --color-2: #c8301e;
      --color-3: #6a0e13;
      --color-4: #f3f1f1;
      --color-5: #161616;

      --bg: #09090b;             /* zinc-950 */
      --surface: #18181b;        /* zinc-900 */
      --surface-hover: #27272a;  /* zinc-800 */
      --border: #27272a;         /* zinc-800 */
      --border-muted: #3f3f46;   /* zinc-700 */
      --text: #f4f4f5;           /* zinc-100 */
      --text-muted: #a1a1aa;     /* zinc-400 */
      --text-dim: #71717a;       /* zinc-500 */
      --crit: var(--color-2);
      --crit-bg: var(--color-3);
      --high: var(--color-1);
      --high-bg: #3c1a10;
      --med: var(--color-1);
      --med-bg: #30170a;
      --low: var(--color-4);
      --low-bg: #272727;
      --info: #9c9a9a;
      --info-bg: #222222;
      --pass: var(--color-4);
      --pass-bg: #282828;
      --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, "JetBrains Mono", "Cascadia Code", "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.5;
      padding: 32px 20px;
    }
    .container { max-width: 1040px; margin: 0 auto; }
    header.report-hero {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .hero-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 10px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 9999px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    h1.hero-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
      font-family: var(--font-mono);
      word-break: break-all;
    }
    .hero-sub {
      color: var(--text-muted);
      font-size: 12px;
    }
    .hero-sub a { color: var(--color-1); text-decoration: none; }
    .hero-sub a:hover { text-decoration: underline; }

    /* Severity Scorecard Bar */
    .severity-scorecard {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .sev-box {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .sev-box-count {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      display: block;
    }
    .sev-box-label {
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--text-dim);
      letter-spacing: 0.05em;
    }
    .box-crit .sev-box-count { color: var(--crit); }
    .box-high .sev-box-count { color: var(--high); }
    .box-med .sev-box-count { color: var(--med); }
    .box-low .sev-box-count { color: var(--low); }
    .box-info .sev-box-count { color: var(--info); }

    /* Scores Grid */
    .section-title {
      font-family: var(--font-mono);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .score-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
    }
    .score-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }
    .score-cat {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .score-val {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
    }
    .score-max { font-size: 11px; color: var(--text-dim); }
    .score-bar-bg {
      height: 4px;
      background: var(--surface);
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .score-bar-fill { height: 100%; border-radius: 9999px; }
    .score-stats {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-dim);
    }
    .stat-p { color: var(--pass); }
    .stat-w { color: var(--med); }
    .stat-f { color: var(--crit); }

    /* Module Accordions */
    .module-section { margin-bottom: 24px; }
    .mod-grid { display: flex; flex-direction: column; gap: 8px; }
    .mod-accordion {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .mod-summary {
      padding: 10px 14px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 12px;
      user-select: none;
      background: var(--surface);
    }
    .mod-summary:hover { background: var(--surface-hover); }
    .mod-title { font-weight: 600; color: var(--text); }
    .mod-status-badge {
      font-size: 10px;
      padding: 2px 8px;
      border: 1px solid;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .mod-content {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      background: var(--bg);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mod-meta { font-family: var(--font-mono); font-size: 11px; display: flex; gap: 16px; color: var(--text-dim); }
    .mod-limitations, .mod-sources, .mod-errors { font-size: 11px; }
    .mod-errors { color: var(--crit); }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-input {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 12px;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      flex: 1;
      min-width: 180px;
    }
    .filter-input:focus { outline: none; border-color: var(--border-muted); }
    .filter-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 5px 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      cursor: pointer;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--surface-hover);
      color: var(--text);
      border-color: var(--border-muted);
    }

    /* Findings Feed */
    .findings-feed { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .finding-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .finding-card.sev-critical { border-left-color: var(--crit); }
    .finding-card.sev-high { border-left-color: var(--high); }
    .finding-card.sev-medium { border-left-color: var(--med); }
    .finding-card.sev-low { border-left-color: var(--low); }
    .finding-card.sev-info { border-left-color: var(--info); }

    .finding-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
    .pill {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pill.sev-critical { background: var(--crit-bg); color: var(--text); border: 1px solid var(--crit); }
    .pill.sev-high { background: var(--high-bg); color: var(--color-1); border: 1px solid var(--high); }
    .pill.sev-medium { background: var(--med-bg); color: var(--color-1); border: 1px solid var(--med); }
    .pill.sev-low { background: var(--low-bg); color: var(--text-muted); border: 1px solid var(--border); }
    .pill.sev-info { background: var(--info-bg); color: var(--text-dim); border: 1px solid var(--border); }
    .pill.status-passed { background: var(--pass-bg); color: var(--text); border: 1px solid var(--border-muted); }
    .pill.status-failed { background: var(--crit-bg); color: var(--text); border: 1px solid var(--crit); }
    .pill.status-warning { background: var(--med-bg); color: var(--color-1); border: 1px solid var(--med); }
    .pill.status-not-available { background: var(--surface); color: var(--text-dim); border: 1px solid var(--border); }

    .rule-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
    .cat-id { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); border: 1px solid var(--border); padding: 1px 6px; border-radius: 9999px; }
    .finding-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
    .finding-desc { color: var(--text-muted); font-size: 12px; margin-bottom: 8px; }
    .finding-recom {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text);
      margin-bottom: 8px;
    }
    .recom-label { font-family: var(--font-mono); font-weight: 700; font-size: 10px; color: var(--info); margin-right: 6px; }
    .finding-refs {
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 6px;
    }
    .finding-refs a { color: var(--color-1); text-decoration: none; }
    .finding-refs a:hover { text-decoration: underline; }
    .refs-label { font-family: var(--font-mono); font-weight: 600; font-size: 10px; margin-right: 6px; }

    /* Evidence Table */
    .evidence-wrapper { overflow-x: auto; margin-top: 8px; }
    .evidence-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      font-family: var(--font-mono);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .evidence-table th {
      text-align: left;
      padding: 5px 8px;
      background: var(--surface);
      color: var(--text-dim);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    .evidence-table td {
      padding: 5px 8px;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
    }
    .evidence-table tr:last-child td { border-bottom: none; }
    .ev-label { color: var(--text); font-weight: 500; }
    .ev-val code { color: var(--color-1); word-break: break-all; white-space: pre-wrap; }
    .ev-src { color: var(--text-dim); }

    /* Footer */
    footer.report-footer {
      padding-top: 18px;
      border-top: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-dim);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="report-hero">
      <span class="hero-badge">Website Intelligence &bull; ${mode}</span>
      <h1 class="hero-title">${hostname}</h1>
      <div class="hero-sub">
        Target: <a href="${targetUrl}">${escapeHtml(rawTargetUrl)}</a> &bull; Inspected on ${dateStr}${durationMs ? ` &bull; Duration: ${durationMs}ms` : ''}
      </div>
      <div class="severity-scorecard">
        <div class="sev-box box-crit"><span class="sev-box-count">${critCount}</span><span class="sev-box-label">Critical</span></div>
        <div class="sev-box box-high"><span class="sev-box-count">${highCount}</span><span class="sev-box-label">High</span></div>
        <div class="sev-box box-med"><span class="sev-box-count">${medCount}</span><span class="sev-box-label">Medium</span></div>
        <div class="sev-box box-low"><span class="sev-box-count">${lowCount}</span><span class="sev-box-label">Low</span></div>
        <div class="sev-box box-info"><span class="sev-box-count">${infoCount}</span><span class="sev-box-label">Info</span></div>
      </div>
    </header>

    <section>
      <h2 class="section-title">Category Audit Scores</h2>
      <div class="scores-grid">${scoreCardsHtml || '<div class="score-card"><p class="hero-sub">No category scores evaluated.</p></div>'}</div>
    </section>

    <section class="module-section">
      <h2 class="section-title">Module Results &amp; Limitations</h2>
      <div class="mod-grid">${moduleAccordionsHtml}</div>
    </section>

    <section>
      <h2 class="section-title">
        <span>Audit Findings (<span id="findings-count">${findings.length}</span>)</span>
      </h2>
      <div class="filter-bar">
        <input type="text" id="finding-search" class="filter-input" placeholder="Filter by rule ID, title, or description..." />
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="critical">Critical (${critCount})</button>
        <button class="filter-btn" data-filter="high">High (${highCount})</button>
        <button class="filter-btn" data-filter="medium">Medium (${medCount})</button>
        <button class="filter-btn" data-filter="low">Low (${lowCount})</button>
        <button class="filter-btn" data-filter="info">Info (${infoCount})</button>
      </div>
      <div class="findings-feed" id="findings-feed">${findingsHtml || '<p class="hero-sub">No findings recorded.</p>'}</div>
    </section>

    <footer class="report-footer">
      <span>Generated by Website Intelligence &amp; Security Auditor</span>
      <span>Zero-backend, local-first inspection &bull; Ephemeral session</span>
    </footer>
  </div>

  <script>
    (function() {
      var searchInput = document.getElementById('finding-search');
      var filterButtons = document.querySelectorAll('.filter-btn');
      var feed = document.getElementById('findings-feed');
      var countEl = document.getElementById('findings-count');
      var activeFilter = 'all';

      function applyFilters() {
        if (!feed) return;
        var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        var cards = feed.querySelectorAll('.finding-card');
        var visibleCount = 0;

        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var sev = card.getAttribute('data-severity');
          var text = card.textContent.toLowerCase();

          var matchesSev = (activeFilter === 'all' || sev === activeFilter);
          var matchesQuery = (!query || text.indexOf(query) !== -1);

          if (matchesSev && matchesQuery) {
            card.style.display = '';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        }
        if (countEl) countEl.textContent = visibleCount;
      }

      if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
      }

      for (var j = 0; j < filterButtons.length; j++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            for (var k = 0; k < filterButtons.length; k++) {
              filterButtons[k].classList.remove('active');
            }
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter') || 'all';
            applyFilters();
          });
        })(filterButtons[j]);
      }
    })();
  </script>
</body>
</html>`;
}
