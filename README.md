# Website Intelligence & Security Auditor

> **High-assurance, local-first website technical inspection, security auditing, and accessibility analysis browser extension for Chrome and Firefox (Manifest V3).**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![WXT Framework](https://img.shields.io/badge/WXT-0.21-purple?style=flat-square)](https://wxt.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![axe-core](https://img.shields.io/badge/axe--core-4.14-orange?style=flat-square)](https://github.com/dequelabs/axe-core)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Local--First-green?style=flat-square)](#privacy--security-model)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Inspection Modes](#inspection-modes)
- [Audit Categories & Rule Catalog](#audit-categories--rule-catalog)
- [Privacy & Security Model](#privacy--security-model)
- [Design System & Interface](#design-system--interface)
- [Reporting & Standalone Exports](#reporting--standalone-exports)
- [Architecture & Codebase Organization](#architecture--codebase-organization)
- [Quickstart & Development](#quickstart--development)
- [Loading into Browsers](#loading-into-browsers)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [License](#license)

---

## Overview

**Website Intelligence & Security Auditor** is a client-side developer and security tool that evaluates web applications across five critical dimensions: **Security**, **Performance**, **SEO**, **Accessibility (axe-core WCAG 2.2 AA)**, and **Web Best Practices**.

Unlike SaaS auditing tools that ingest your target URLs through third-party servers, this extension executes **entirely within your browser runtime**. It conducts passive DOM queries, evaluates active headers and scripts, audits responsive behavior, redacts sensitive credentials, and scores findings in memory—leaving zero persistent trace and sending zero analytics.

---

## Key Features

- **Local-First & Zero Analytics**: Operates client-side in the extension service worker and content script. No tracking scripts, no telemetry, no backend servers, and no user accounts.
- **In-Memory Audit Lifecycle**: Scans reside purely in volatile session memory. One-click clearing ensures zero persistent audit history on disk.
- **Axe-Core Accessibility Integration**: Powered by Deque's industry-standard `axe-core 4.14` engine to detect WCAG 2.1 and 2.2 Level A/AA violations directly in the live DOM.
- **Automated Secret Redaction**: In-memory regex and heuristic redactor masks API keys (Stripe, Slack, AWS, OpenAI), JWT tokens, authorization headers, passwords, and form values before display or export.
- **Private Network & SSRF Guard (RFC 1918)**: Prevents DNS rebinding and internal network probing by validating public IP boundaries and blocking private, loopback, and link-local ranges.
- **Inline Progressive Disclosure (No Modals)**: Strict editorial UI that replaces floating modal popups and clutter with unified finding rows and inline expanders.
- **Standalone Offline Reports**: Generates self-contained sanitized JSON and zero-CDN single-file HTML reports styled with inline CSS and SVGs.
- **Cross-Browser Manifest V3**: Native dual-target build supporting both Chromium (Chrome, Edge, Brave, Arc) and Mozilla Firefox (Gecko MV3).

---

## Inspection Modes

The extension provides three tiers of depth depending on your workflow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. QUICK SCAN         Surface telemetry (< 1s)                             │
│     Active tab headers, TLS scheme, meta robots, viewport, top resources    │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. FULL PAGE AUDIT    Deep single-page inspection (~ 2-4s)                 │
│     DOM semantics, structured data (JSON-LD), forms, CSS/JS resources,      │
│     Navigation & Paint timings, tech stack fingerprinting, axe-core a11y   │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. DEEP INSPECTION    Crawler + External Intelligence (~ 10-30s)           │
│     Full audit + bounded same-origin spider (robots.txt, sitemaps, link     │
│     traversal up to 50 pages) + opt-in DoH, IP/ASN, & CT log analysis       │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Quick Scan**: Rapid, non-invasive triage of the active tab. Evaluates transport security, presence of critical security headers, initial resource counts, and basic meta attributes.
2. **Full Page Audit**: Deep technical audit of the active page. Gathers 10 collection modules, runs automated axe-core rules, analyzes form security, parses structured data schemas, and computes weighted category scores.
3. **Deep Inspection**: Comprehensive assessment combining full-page analysis with an internal link spider bounded by safe concurrency, max depth (3), and page limits (50). Supports optional, consent-gated external intelligence (DoH DNS, IP/ASN lookup, Certificate Transparency).

---

## Audit Categories & Rule Catalog

Every inspection runs the gathered evidence through an extensive, typed rule catalog producing structured findings with severity levels (`Critical`, `High`, `Medium`, `Low`, `Info`) and detection confidence:

### 1. Security (`sec-*`)
- **Transport & Encryption**: HTTPS enforcement, TLS validity, mixed content detection, HSTS with `preload` and `includeSubDomains`.
- **Hardening Headers**: Content Security Policy (`default-src`, `script-src`, unsafe evaluation flags), `X-Frame-Options` (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Resource Integrity**: Subresource Integrity (`integrity` / SRI hashes) on cross-origin scripts and stylesheets.
- **Information Leakage**: Server banner tokens (`Server`, `X-Powered-By`, `X-AspNet-Version`), exposed sensitive cookies without `Secure` or `HttpOnly` flags.
- **Form Security**: Password inputs over HTTP, insecure form action endpoints, missing CSRF token signals.

### 2. Performance (`perf-*`)
- **Navigation & Paint Timings**: Time to First Byte (TTFB), First Contentful Paint (FCP), Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), DOM Interactive.
- **Resource Optimization**: Unminified or render-blocking scripts, unoptimized external web fonts, images missing explicit `width`/`height` or modern formats (WebP/AVIF).
- **Compression & Caching**: Cache-Control header presence, `gzip`/`brotli` content encoding checks.

### 3. SEO & Structured Data (`seo-*`)
- **Metadata**: Title tag length and presence, meta description length, canonical link consistency, viewport configuration.
- **Social Graph**: OpenGraph (`og:title`, `og:image`, `og:description`, `og:url`) and Twitter Cards.
- **Crawling & Indexing**: Meta robots directives (`noindex`, `nofollow`), hreflang tags, robots.txt validity, XML sitemap presence.
- **Structured Data**: JSON-LD syntax and Schema.org validation, Microdata, and RDFa parsing.

### 4. Accessibility (`a11y-*`)
- **Automated Axe-Core Engine**: WCAG 2.1 & 2.2 Level A/AA evaluations, detecting color contrast ratios, missing form labels, missing image `alt` attributes, keyboard accessibility, and focus states.
- **Semantic Structure**: Proper heading hierarchy (`h1` through `h6`), landmark elements (`main`, `nav`, `header`, `footer`), duplicate ID detection, and ARIA roles validity.
- **Tap Targets**: Minimum interactive touch target dimensions (48x48px) for mobile usability.

### 5. Web Best Practices (`bp-*`)
- **Document Standards**: Valid HTML5 `<!DOCTYPE html>`, UTF-8 character encoding, language attribute on `<html>`.
- **Modern Protocol Usage**: HTTP/2 or HTTP/3 transport verification.
- **Code Hygiene**: Deprecated HTML tags, document.write calls, console error tracking, and console log pollution.

---

## Privacy & Security Model

The extension is engineered under a zero-trust, privacy-by-design architecture:

```
                            [ Web Page / DOM ]
                                    │
                         Passive Read-Only Query
                                    ▼
                          [ Content Script ]
                                    │
                       Sanitized PostMessage Bus
                                    ▼
                         [ Background Worker ]
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
  [ Secret Redactor ]      [ Private Net Guard ]   [ In-Memory Store ]
  Masks tokens, keys,      Blocks RFC 1918,        Holds session data;
  passwords & forms        loopback & link-local   zero disk persistence
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    ▼
                       [ Standalone Exporters ]
                       Zero-CDN JSON & HTML
```

- **RFC 1918 Private Network Guard**: Validates all URLs and hostnames before issuing network queries. Blocks loopback (`127.0.0.0/8`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`), and carrier-grade NAT (`100.64.0.0/10`) to prevent intranet and router vulnerability exploitation.
- **Scheme Validation**: Strictly restricts inspection to public `http:` and `https:` targets. Rejects internal browser schemes (`chrome://`, `chrome-extension://`, `about:`, `data:`, `file:`, `javascript:`).
- **Automated Secret Redaction**: Eliminates inadvertent credential exposure in evidence trees. Automatically detects and redacts:
  - Stripe secret/publishable keys (`sk_live_`, `pk_live_`)
  - Slack API tokens and webhooks (`xoxb-`, `xoxp-`, `hooks.slack.com`)
  - AWS access keys (`AKIA[0-9A-Z]{16}`)
  - Generic JWT bearer strings, basic auth headers, and session cookies
  - Input field values from `<input type="password">`, credit card fields, and text areas.
- **External Intelligence Consent Gate**: External lookups (DNS-over-HTTPS, IP/ASN, Certificate Transparency) are **disabled by default**. They require affirmative opt-in in the Settings page with explicit disclosure of what network payloads are transmitted and to which provider.

---

## Design System & Interface

The user interface follows an anti-slop, editorial visual design language optimized for extension popup dimensions:

- **Executive Cockpit**:
  - **Circular Score Gauge**: Displays overall health score (0–100) with letter grade badge (`A+` to `F`).
  - **Audit Scorecard**: Instant tally of rules evaluated (`Passed`, `Failed`, `Warnings`, `Info`, `N/A`).
  - **Category Health Cards**: Quick-reference scores across Security, Performance, SEO, Accessibility, and Best Practices.
  - **Severity Donut Chart**: Proportional distribution of active issues (`Critical`, `High`, `Medium`, `Low`, `Info`).
- **Unified Finding Stream**:
  - Replaces nested card-in-card layouts with a clean, row-separated list container.
  - Inline accordion expansion reveals expected behavior, technical justification, confidence score, redacted evidence tables, and official remediation references.
  - Quick multi-facet filtering by keyword search, category dropdown, and status selector in a compact 32px control bar.
- **Strict Brand Palette**:
  | Token | Hex Value | Semantic Role |
  |---|---|---|
  | `--color-1` | `#e88438` | Warm Amber Accent / Score Gauge Arc |
  | `--color-2` | `#c8301e` | Crimson Primary / Critical Badges |
  | `--color-3` | `#6a0e13` | Deep Wine Header Gradient & Branding |
  | `--color-4` | `#f3f1f1` | Clean Light Neutral Background |
  | `--color-5` | `#161616` | Onyx Dark Base & High-Contrast Elements |

---

## Reporting & Standalone Exports

Generate audit artifacts directly from the popup or report tab:

### 1. Sanitized JSON (`.json`)
A structured, machine-readable export ideal for CI/CD pipelines, security audits, and archiving. Contains:
- Scan metadata (target URL, timestamp, duration, engine version, mode)
- Overall and category scores
- Array of evaluated findings with redacted evidence and remediation guidance
- Summary counts grouped by severity and category

### 2. Standalone HTML Report (`.html`)
An enterprise-grade, single-file HTML document designed for client deliverables and stakeholder reporting:
- **Zero External Dependencies**: All CSS styles and SVG icons are inlined directly into the document. It renders identically offline or in air-gapped environments.
- **Strict Anti-XSS Escaping**: Every piece of dynamic evidence and metadata is safely escaped to prevent DOM-based script injection when opening reports of untrusted sites.
- **Light & Dark Theme Toggle**: Built-in, zero-dependency theme switcher.
- **Interactive Filtering**: Client-side JavaScript enables instant searching and severity filtering within the standalone report.

---

## Architecture & Codebase Organization

```
website-intelligence/
├── entrypoints/
│   ├── background.ts                # MV3 Service Worker: scan coordinator & network dispatcher
│   ├── content.ts                   # Injected content script: DOM walker & axe-core runner
│   ├── popup/                       # Main extension popup interface
│   │   ├── App.tsx                  # Root popup container & tab coordinator
│   │   ├── style.css                # Brand design system tokens & theme styles
│   │   └── components/
│   │       ├── Header.tsx           # Brand header, active site identity, clear & settings
│   │       ├── TabBar.tsx           # Navigation: Overview, Issues, Rules, Resources, Report
│   │       ├── ModeSelector.tsx     # Quick / Full / Deep scan trigger
│   │       ├── LiveProgressBar.tsx  # Step-by-step audit progress indicator
│   │       ├── OverviewDashboard.tsx# Score gauge, scorecard, donut chart, category tiles
│   │       ├── FindingsExplorer.tsx # Unified issues list with multi-facet filters
│   │       ├── FindingDetailInspector.tsx # Inline expandable finding detail with evidence
│   │       ├── ModuleAccordions.tsx # Deep inspection raw data breakdown
│   │       ├── ResourcesView.tsx    # Inventory of page scripts, stylesheets, and media
│   │       ├── ReportView.tsx       # Audit executive summary & one-click export triggers
│   │       └── ExportBar.tsx        # Bottom export actions
│   └── options/                     # Extension settings & consent management
│       └── OptionsApp.tsx           # Consent gates, API key vault, crawl limits & disclosures
├── src/
│   ├── types/                       # Core TypeScript contracts (inspection, findings, evidence)
│   ├── browser/                     # Cross-browser abstraction layer (Chrome & Firefox MV3)
│   ├── security/                    # PrivateNetworkGuard, SecretRedactor, SchemeValidator
│   ├── messaging/                   # Type-safe cross-script runtime messaging bus
│   ├── core/                        # Inspection orchestrator, abort controller, state machine
│   ├── collectors/                  # 10 page-level collectors (DOM, SEO, Forms, axe-core, etc.)
│   ├── analyzers/                   # 37+ rule definitions, finding builders, and rule catalog
│   ├── scoring/                     # Weighted 0-100 category scoring algorithms
│   ├── crawler/                     # Safe same-origin spider (robots.txt, sitemaps, link queue)
│   ├── intelligence/                # DoH DNS, IP/ASN, CT logs, and consent manager
│   └── export/                      # Sanitized JSON and standalone HTML report generators
├── wxt.config.ts                    # WXT multi-browser bundler configuration
└── package.json                     # Project scripts and dependencies
```

---

## Quickstart & Development

### Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **pnpm**: `v8.0.0` or higher (`corepack enable pnpm`)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/website-intelligence.git
cd website-intelligence
pnpm install
```

### Development Server

Start the live-reloading development server:

```bash
# Target Google Chrome / Chromium (default)
pnpm dev

# Target Mozilla Firefox (MV3)
pnpm dev:firefox
```

This launches a development instance of the browser with the extension pre-loaded and auto-reloading on code edits.

### Production Build & Packaging

Build optimized production bundles and zip distributables:

```bash
# Build production output in .output/chrome-mv3
pnpm build

# Build production output in .output/firefox-mv3
pnpm build:firefox

# Create Chrome Web Store distribution zip (.output/*.zip)
pnpm zip

# Create Firefox Add-ons distribution zip (.output/*.zip)
pnpm zip:firefox
```

---

## Loading into Browsers

### Google Chrome / Chromium (Edge, Brave, Arc, Opera)

1. Run `pnpm build` (or `pnpm dev`).
2. Open your browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the `.output/chrome-mv3` folder inside this project directory.
6. Pin the **Website Intelligence** shield icon to your browser toolbar.

### Mozilla Firefox

1. Run `pnpm build:firefox` (or `pnpm dev:firefox`).
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Navigate into `.output/firefox-mv3` and select the `manifest.json` file.
5. The extension is now active in Firefox with temporary debugging permissions.

---

## Testing & Quality Assurance

The codebase maintains strict typing and test coverage:

```bash
# Run TypeScript compilation and strict type check
pnpm compile

# Run complete Vitest unit & integration test suite
pnpm test

# Run Vitest in interactive watch mode
pnpm test:watch
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with precision using [WXT](https://wxt.dev/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), and [axe-core](https://github.com/dequelabs/axe-core).*
