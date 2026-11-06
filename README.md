# SiteRadar — Website Security & Technical Auditor

A cross-browser extension (Chrome & Firefox MV3) for evidence-based website auditing: security, accessibility, performance, SEO, and web best practices.

Runs **100% locally in your browser**—no remote servers, no tracking, and no third-party data collection.

---

## What It Does

When opened on any webpage, the extension analyzes the live site and generates an instant audit report with category scores (0–100), findings categorized by severity (`Critical`, `High`, `Medium`, `Low`, `Info`), and concrete remediation guidance.

### 1. Security Auditing
- **HTTPS & Transport**: Checks TLS enforcement, certificate validity, mixed content, and HSTS headers.
- **Security Headers**: Analyzes Content Security Policy (CSP), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- **Subresource Integrity (SRI)**: Verifies cryptographic hashes on cross-origin scripts and stylesheets.
- **Information Leakage**: Detects exposed server banner tokens (`Server`, `X-Powered-By`), insecure cookies (missing `Secure`/`HttpOnly`/`SameSite`), and forms transmitting data over plain HTTP.

### 2. Accessibility (axe-core WCAG 2.2 AA)
- **Automated Axe-Core Engine**: Injects Deque's `axe-core 4.14` directly in page context to evaluate WCAG 2.1 & 2.2 Level A/AA conformance.
- **Contrast & Elements**: Evaluates color contrast ratios, image `alt` attributes, form labels, ARIA roles, and tap target sizes.
- **DOM Semantics**: Validates heading hierarchy (`h1`–`h6`), landmark elements, duplicate element IDs, and keyboard accessibility.

### 3. Performance & Core Web Vitals
- **Real-User Metrics**: Navigation Timing, Paint Timing, Time to First Byte (TTFB), First Contentful Paint (FCP), Largest Contentful Paint (LCP), and Cumulative Layout Shift (CLS).
- **Resource Profiling**: Detects render-blocking scripts, unoptimized web fonts, missing image dimensions, and uncompressed assets (`gzip`/`brotli`).

### 4. SEO & Structured Data
- **Metadata**: Title tag length, meta description, canonical link validity, and viewport configuration.
- **Social Graph**: Validates OpenGraph (`og:*`) and Twitter Card tags.
- **Structured Data**: Parses and validates JSON-LD schemas, Microdata, and RDFa schemas.
- **Crawling Directives**: Inspects meta robots directives, `robots.txt`, and XML sitemaps.

### 5. Technology Fingerprinting
- Detects CMS platforms, JavaScript frameworks, libraries, web servers, and third-party trackers with confidence scoring.

---

## Inspection Modes

| Mode | Duration | What It Inspects |
|---|---|---|
| **Quick Scan** | < 1s | Surface-level checks: headers, TLS status, basic metadata, and resource counts. |
| **Full Page Audit** | ~2–4s | In-depth page inspection: full DOM analysis, forms, structured data, tech fingerprinting, and automated axe-core accessibility tests. |
| **Deep Inspection** | ~10–30s | Full audit + bounded same-origin crawler (up to 50 pages / depth 3) with optional DNS-over-HTTPS, IP/ASN, and Certificate Transparency lookups. |

---

## Privacy & Safety

- **Runs Locally**: All DOM analysis, header checks, and scoring happen inside your browser runtime. Zero telemetry or external tracking.
- **Zero Persistent History**: Scan results live only in memory for the active session. Closing the tab or clicking **Clear** wipes all data immediately.
- **Automated Secret Redaction**: In-memory filters automatically mask passwords, API keys (Stripe, AWS, Slack), JWT tokens, and sensitive form inputs before evidence is displayed or exported.
- **Private Network Guard (RFC 1918)**: Rejects scans targeting internal IPs, loopback (`localhost`), and private ranges to prevent intranet probing or SSRF.
- **Explicit External Consent**: External intelligence lookups (DoH, IP/ASN, CT logs) are disabled by default and require explicit opt-in in Settings.

---

## Exporting Reports

Export complete audit results at any time:
- **Sanitized JSON**: Machine-readable format with redacted credentials, ideal for CI/CD or logging.
- **Standalone HTML Report**: Self-contained, single-file HTML report with zero external CDN dependencies, embedded styles/SVGs, and built-in search and filtering.

---

## Quickstart & Development

### Prerequisites
- Node.js >= 18
- pnpm >= 8 (`corepack enable pnpm`)

### Setup

```bash
git clone https://github.com/your-username/website-intelligence.git
cd website-intelligence
pnpm install
```

### Development

```bash
# Chromium (Chrome, Edge, Brave, Arc)
pnpm dev

# Firefox (MV3)
pnpm dev:firefox
```

### Production Build & Packaging

```bash
# Build for Chrome (.output/chrome-mv3)
pnpm build

# Build for Firefox (.output/firefox-mv3)
pnpm build:firefox

# Create distribution zip files
pnpm zip
pnpm zip:firefox

# Type check & test
pnpm compile
pnpm test
```

---

## Loading into Browsers

### Chrome / Chromium
1. Run `pnpm build` (or `pnpm dev`).
2. Go to `chrome://extensions/` and toggle on **Developer mode** (top right).
3. Click **Load unpacked** (top left).
4. Select the `.output/chrome-mv3` folder.

### Firefox
1. Run `pnpm build:firefox` (or `pnpm dev:firefox`).
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.json` inside the `.output/firefox-mv3` folder.

---

## License

MIT
