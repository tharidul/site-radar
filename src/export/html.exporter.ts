
import type { WebsiteInspection, AuditFinding, CategoryScore, CollectionResult } from '@/types/inspection';
import { redactSecrets } from '@/security/secret-redactor';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Pure-TS synchronous SHA-256 returning base64 for CSP script-src hashes
 * without Node-only imports (runs in both browser extension and Node).
 */
export function sha256Base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, h0, false);
  digestView.setUint32(4, h1, false);
  digestView.setUint32(8, h2, false);
  digestView.setUint32(12, h3, false);
  digestView.setUint32(16, h4, false);
  digestView.setUint32(20, h5, false);
  digestView.setUint32(24, h6, false);
  digestView.setUint32(28, h7, false);

  let binary = '';
  for (let i = 0; i < digest.length; i++) {
    binary += String.fromCharCode(digest[i]!);
  }
  return btoa(binary);
}

const INLINE_FILTER_SCRIPT = `
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
  `;

const INLINE_FILTER_SCRIPT_HASH = sha256Base64(INLINE_FILTER_SCRIPT);

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

export function sanitizeHref(url: unknown): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|mailto:|#)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '#';
}

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

  const critCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const medCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  const scoreCardsHtml = Object.entries(scores)
    .map(([cat, score]: [string, CategoryScore]) => {
      const scoreVal = Math.round(score.score);
      const color =
        scoreVal >= 90
          ? '#CEFF52'
          : scoreVal >= 70
          ? 'rgba(206, 255, 82, 0.75)'
          : scoreVal >= 50
          ? 'rgba(206, 255, 82, 0.50)'
          : 'rgba(206, 255, 82, 0.30)';

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

      let statusColor = 'rgba(206, 255, 82, 0.4)';
      if (status === 'completed') statusColor = '#CEFF52';
      else if (status === 'partial') statusColor = 'rgba(206, 255, 82, 0.75)';
      else if (status === 'failed' || status === 'blocked') statusColor = 'rgba(206, 255, 82, 0.35)';

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
              ? `<div class="finding-expected"><span class="expected-label">EXPECTED:</span> ${escapeHtml(f.expectedBehavior)}</div>`
              : ''
          }
          ${
            f.explanation
              ? `<div class="finding-expl"><span class="expl-label">EXPLANATION:</span> ${escapeHtml(f.explanation)}</div>`
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${INLINE_FILTER_SCRIPT_HASH}'; img-src data:; base-uri 'none';">
  <title>SiteRadar Report &mdash; ${hostname}</title>
  <style>
    :root {
      --color-1: #CEFF52;
      --color-2: #CEFF52;
      --color-3: #152E40;
      --color-4: #ffffff;
      --color-5: #080b0e;
      --brand-dark: #152E40;
      --brand-lime: #CEFF52;

      --bg: #080b0e;             /* Jet Black main canvas */
      --surface: #152E40;        /* Card surface #152E40 */
      --surface-hover: #1b3a51;  /* Card surface hover */
      --border: #234b66;         /* Card border */
      --border-muted: #1c3c54;
      --text: #ffffff;           /* Crisp white */
      --text-muted: #b5c9d6;     /* Readable muted text */
      --text-dim: #88a8be;
      --crit: var(--color-1);
      --crit-bg: rgba(206, 255, 82, 0.15);
      --high: var(--color-1);
      --high-bg: rgba(206, 255, 82, 0.12);
      --med: var(--color-1);
      --med-bg: rgba(206, 255, 82, 0.10);
      --low: #b5c9d6;
      --low-bg: rgba(21, 46, 64, 0.4);
      --info: #88a8be;
      --info-bg: rgba(21, 46, 64, 0.3);
      --pass: #CEFF52;
      --pass-bg: rgba(206, 255, 82, 0.15);
      --font-sans: "Roboto", sans-serif;
      --font-mono: "Roboto", monospace;

      /* Unified Typography Scale */
      --font-size-2xs: 10px;
      --font-size-xs: 11px;
      --font-size-sm: 12px;
      --font-size-base: 13px;
      --font-size-md: 14px;
      --font-size-lg: 16px;
      --font-size-xl: 18px;
      --font-size-2xl: 22px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: var(--font-size-base);
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
      font-size: var(--font-size-xs);
      font-weight: 600;
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
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
      font-family: var(--font-mono);
      word-break: break-all;
      text-wrap: balance;
    }
    h2, h3 {
      text-wrap: balance;
    }
    p {
      text-wrap: pretty;
    }
    .hero-sub {
      color: var(--text-muted);
      font-size: var(--font-size-sm);
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
      font-size: var(--font-size-xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      display: block;
    }
    .sev-box-label {
      font-size: var(--font-size-2xs);
      font-weight: 600;
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
      font-size: var(--font-size-base);
      font-weight: 700;
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
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
    }
    .score-val {
      font-size: var(--font-size-xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .score-max { font-size: var(--font-size-xs); color: var(--text-dim); }
    .score-bar-bg {
      height: 4px;
      background: var(--surface);
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .score-bar-fill { height: 100%; border-radius: 9999px; }
    .score-stats {
      font-size: var(--font-size-2xs);
      font-variant-numeric: tabular-nums;
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
      font-size: var(--font-size-sm);
      user-select: none;
      background: var(--surface);
    }
    .mod-summary:hover { background: var(--surface-hover); }
    .mod-title { font-weight: 600; color: var(--text); }
    .mod-status-badge {
      font-size: var(--font-size-2xs);
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
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mod-meta { font-family: var(--font-mono); font-size: var(--font-size-xs); display: flex; gap: 16px; color: var(--text-dim); }
    .mod-limitations, .mod-sources, .mod-errors { font-size: var(--font-size-xs); }
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
      font-size: var(--font-size-sm);
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
      font-size: var(--font-size-xs);
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
      font-size: var(--font-size-2xs);
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

    .rule-id { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--text-dim); }
    .cat-id { font-family: var(--font-mono); font-size: var(--font-size-2xs); color: var(--text-dim); border: 1px solid var(--border); padding: 1px 6px; border-radius: 9999px; }
    .finding-title { font-size: var(--font-size-md); font-weight: 600; color: var(--text); margin-bottom: 4px; }
    .finding-desc { color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: 8px; }
    .finding-recom {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: var(--font-size-sm);
      color: var(--text);
      margin-bottom: 8px;
    }
    .recom-label { font-family: var(--font-mono); font-weight: 700; font-size: var(--font-size-2xs); color: var(--info); margin-right: 6px; }
    .expected-label, .expl-label { font-family: var(--font-mono); font-weight: 700; font-size: var(--font-size-2xs); color: var(--text-muted); margin-right: 6px; }
    .finding-refs {
      font-size: var(--font-size-xs);
      color: var(--text-dim);
      margin-top: 6px;
    }
    .finding-refs a { color: var(--color-1); text-decoration: none; }
    .finding-refs a:hover { text-decoration: underline; }
    .refs-label { font-family: var(--font-mono); font-weight: 600; font-size: var(--font-size-2xs); margin-right: 6px; }

    /* Evidence Table */
    .evidence-wrapper { overflow-x: auto; margin-top: 8px; }
    .evidence-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-xs);
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
      font-size: var(--font-size-2xs);
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
      font-size: var(--font-size-xs);
      color: var(--text-dim);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="report-hero">
      <span class="hero-badge">SiteRadar &bull; ${mode}</span>
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
      <span>Generated by SiteRadar</span>
      <span>Zero-backend, local-first inspection &bull; Ephemeral session</span>
    </footer>
  </div>

  <script>${INLINE_FILTER_SCRIPT}</script>
</body>
</html>`;
}
