# Project: Website Intelligence & Security Auditor

## Architecture
- **Framework & Stack**: WXT (Web Extension Tools) 0.21.5 with Vite 8.3.5, React 19.2.4, TypeScript 5.9.3, Tailwind CSS.
- **Runtime Targets**: Google Chrome (MV3 service worker) and Mozilla Firefox (MV3 background script / event page with gecko ID).
- **Core Principles**:
  - Zero-backend, local-first runtime. No remote server, no external database, no user accounts.
  - Zero persistent audit history: inspections exist in memory for the active session only, clearable at any time.
  - Least-privilege permissions: optional host permissions for external intelligence, no access to uninspected tabs.
  - Zero secret collection: strictly redact passwords, form input values, session cookies, and bearer tokens from evidence.
  - Strict external guardrails: all external lookups (DoH, IP/ASN, CT, TLS) require explicit user consent, display data disclosures, enforce RFC 1918 private network blocking, and protect against DNS rebinding.
  - Anti-Slop UI standard: intentional, compact dark theme (`#09090b` / `#18181b`), functional typography, clear visual hierarchy, absence of generic AI tropes (no unmotivated cards, gradients, floating pills, or filler copy).
- **Module Architecture**:
  - `src/types/`: Unified data contracts (`WebsiteInspection`, `CollectionResult`, `AuditFinding`, `Severity`, `CollectionStatus`, etc.)
  - `src/browser/`: Browser abstraction layer (`BrowserAdapter`, Chrome and Firefox implementations)
  - `src/security/`: Private network guard (RFC 1918 / SSRF prevention), secret redactor, scheme validator
  - `src/core/`: Inspection orchestrator, lifecycle state machine, cancellation controller
  - `src/collectors/`: Page collectors (Identity, DOM, SEO, Structured Data, Links, Media, CSS, JS, Forms, Performance, Security Headers, Privacy, Technology, axe-core Accessibility)
  - `src/analyzers/`: Rules engine, finding generators, and category scoring algorithms
  - `src/crawler/`: Bounded same-origin crawler (robots.txt, sitemaps, link traversal)
  - `src/intelligence/`: External intelligence layer (DoH DNS, IP/ASN, CT logs, TLS inspector, consent gate, API key manager)
  - `src/export/`: Sanitized JSON and self-contained HTML report generators with anti-XSS escaping
  - `entrypoints/popup/`: Main extension popup interface adhering to anti-slop guidelines
  - `entrypoints/options/`: Settings page for consent, API keys, crawl limits, and disclosures
  - `entrypoints/background.ts`: Service worker handling orchestration, crawling, and external network requests
  - `entrypoints/content.ts`: Injected collector script executing passive DOM queries and axe-core analysis

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | WXT & Multi-Browser Project Configuration | Configure WXT with React 19, TypeScript, Tailwind CSS, Chrome MV3 and Firefox MV3 with Gecko ID | M1 | Spec Sec. 3, Phase 0-2 |
| 2 | Unified Domain Contracts | TypeScript types for InspectionMode, CollectionResult, AuditFinding, Severity, Evidence, WebsiteInspection | M1 | Spec Sec. 8, Phase 3 |
| 3 | Chrome MV3 Browser Adapter | Chrome extension API adapter (scripting, tabs, storage, permissions) | M1 | Spec Sec. 7, Phase 3 |
| 4 | Firefox MV3 Browser Adapter | Firefox WebExtension API adapter encapsulating Gecko differences | M1 | Spec Sec. 7, Phase 3 |
| 5 | Private Network & SSRF Guard | IP & hostname validator blocking RFC 1918, loopback, link-local, multicast, and DNS rebinding | M1 | Spec Sec. 10, 14, Phase 3, 14 |
| 6 | Secret Redactor Engine | Redacts passwords, auth tokens, bearer headers, session IDs, and form field values from evidence | M1 | Spec Sec. 14, Phase 3, 14 |
| 7 | URL Scheme & Boundary Validator | Normalizes URLs, strips fragments, rejects javascript:/data:/file: and internal schemes | M1 | Spec Sec. 10, Phase 3 |
| 8 | Extension Messaging Bus | Type-safe runtime message passing between popup, background, and content scripts | M1 | Spec Sec. 9, Phase 3 |
| 9 | Inspection Orchestrator Core | Coordinates collectors, analyzers, concurrency, module timeouts, and error isolation | M2 | Spec Sec. 2, 9, Phase 3 |
| 10 | Quick Scan Mode Execution | Fast, passive active-tab inspection across 8 core modules | M2 | Spec Sec. 4, Phase 5 |
| 11 | Scan Cancellation Controller | Immediate abort of running inspections, network queries, and crawls | M2 | Spec Sec. 9, Phase 4 |
| 12 | Identity Collector | Collects URL, origin, title, charset, language, canonical URL, viewport, and favicon | M2 | Spec Sec. 5, Phase 5 |
| 13 | DOM & Semantic Collector | Analyzes landmark elements, heading hierarchy, hidden nodes, depth, and custom elements | M2 | Spec Sec. 5, Phase 6 |
| 14 | SEO & Metadata Collector | Collects meta robots, title/description lengths, OpenGraph, Twitter cards, hreflang | M2 | Spec Sec. 5, Phase 6 |
| 15 | Structured Data Collector | Parses and validates JSON-LD, Microdata, and RDFa metadata schemas | M2 | Spec Sec. 5, Phase 6 |
| 16 | Links Inventory Collector | Extracts internal/external links, validates protocols, analyzes rel attributes | M2 | Spec Sec. 5, Phase 6 |
| 17 | Images & Media Collector | Inventories img, picture, svg, video, audio; evaluates alt text and lazy loading | M2 | Spec Sec. 5, Phase 6 |
| 18 | CSS & Style Collector | Discovers stylesheets, CSS custom properties, fonts, and dark mode media queries | M2 | Spec Sec. 5, Phase 6 |
| 19 | JavaScript & Script Collector | Discovers script tags, async/defer attributes, modules, and render-blocking scripts | M2 | Spec Sec. 5, Phase 6 |
| 20 | Form & Input Collector (Sanitized) | Inventories form elements, actions, methods; strictly redacts input values and passwords | M2 | Spec Sec. 5, 14, Phase 6 |
| 21 | Performance Metrics Collector | Collects Navigation Timing, Resource Timing, Paint Timing, and Web Vitals (FCP, LCP, CLS) | M2 | Spec Sec. 5, Phase 7 |
| 22 | Security Headers & Signals Collector | Detects HTTPS, mixed content, SRI on scripts/links, upgrade-insecure-requests, security headers | M2 | Spec Sec. 5, Phase 7 |
| 23 | Privacy & Tracker Collector | Discovers consent banners, privacy policy links, third-party tracker domains | M2 | Spec Sec. 5, Phase 7 |
| 24 | Technology Fingerprinting Engine | Heuristic engine matching CMS, frameworks, and analytics signatures with confidence | M2 | Spec Sec. 5, Phase 7 |
| 25 | Responsive & Content Collector | Evaluates viewport tag, tap targets, horizontal overflow, word count, text density | M2 | Spec Sec. 5, Phase 7 |
| 26 | axe-core Accessibility Collector | Injects axe-core in page context for WCAG 2.1 AA evaluations, mapping violations to findings | M2 | Spec Sec. 5, 8, Phase 8 |
| 27 | Full Page Audit Mode Execution | Executes Quick Scan + semantic DOM, structured data, CSS/JS resources, and axe-core a11y | M2 | Spec Sec. 4, Phase 8-9 |
| 28 | Rules & Finding Generator Engine | Evaluates collected data against rules to generate AuditFindings with stable ruleIds | M2 | Spec Sec. 8, Phase 9 |
| 29 | Category Scoring Algorithm | Calculates scores (0-100) per category based on finding severities and weights | M2 | Spec Sec. 8, Phase 9 |
| 30 | Robots.txt Collector & Parser | Fetches and parses target origin robots.txt for User-Agent directives and sitemaps | M3 | Spec Sec. 5, 10, Phase 10 |
| 31 | Sitemap XML Parser | Discovers, parses, and caps XML sitemaps up to 5,000 entries | M3 | Spec Sec. 5, 10, Phase 10 |
| 32 | Bounded Same-Origin Crawler | Crawls internal links bounded by max pages (50), depth (3), concurrency (2), timeout (15s) | M3 | Spec Sec. 10, Phase 10 |
| 33 | Website Deep Inspection Mode | Full Page Audit + bounded same-origin crawl + external intelligence aggregation | M3 | Spec Sec. 4, 10, Phase 10 |
| 34 | DoH DNS Intelligence Collector | Queries public DNS-over-HTTPS (Google / Cloudflare) for A, AAAA, MX, TXT, CNAME, CAA | M3 | Spec Sec. 6, 11, Phase 11 |
| 35 | IP & ASN Lookup Adapter | Resolves public IP address and maps to ASN, ISP, country with private IP rejection | M3 | Spec Sec. 6, 11, Phase 11 |
| 36 | Certificate Transparency Adapter | Queries public CT log endpoints for certificate history, issuer, validity window | M3 | Spec Sec. 6, 11, Phase 11 |
| 37 | Live TLS Security Inspector | Evaluates SSL/TLS indicators (protocols, expiry, certificates) | M3 | Spec Sec. 6, 11, Phase 11 |
| 38 | External Consent Gate & Disclosures | Explicit user consent modal disclosing target host, provider, privacy policy, and key usage | M3 | Spec Sec. 6.4, Phase 12 |
| 39 | API Key Manager | Manages optional third-party API keys (session-only, clear-key controls, zero export) | M3 | Spec Sec. 6.3, Phase 12 |
| 40 | Anti-Slop Dark Theme Design System | Intentional dark palette (zinc-950/zinc-900), typography scale, no decorative slop | M4 | Anti-Slop Skill, Phase 13 |
| 41 | Popup Main Screen & Mode Selector | Header, active site identity, mode selector (Quick/Full/Deep), start/cancel buttons | M4 | Spec Sec. 12, Phase 13 |
| 42 | Live Progress & Status Indicator | Displays real-time scan progress, active module status, and cancellation affordance | M4 | Spec Sec. 12, Phase 13 |
| 43 | Findings Summary & Scorecard | High-level summary of findings by severity (Critical, High, Medium, Low, Info) and scores | M4 | Spec Sec. 12, Phase 13 |
| 44 | Expandable Module Result Accordions | 10 expandable sections (Overview, SEO, Security, Performance, A11y, Tech, Infra, Resources, Privacy, Content) | M4 | Spec Sec. 12, Phase 13 |
| 45 | Findings Explorer with Multi-Facet Filters | Filter findings by severity, category, status (failed/warning/passed), and text search | M4 | Spec Sec. 12, Phase 13 |
| 46 | Finding Detail Inspector | Displays ruleId, explanation, redacted evidence, confidence meter, and remediation links | M4 | Spec Sec. 12, Phase 13 |
| 47 | Options & Settings Page | Configure external intelligence consent, providers, API keys, crawl limits, disclosures | M4 | Spec Sec. 12, Phase 13 |
| 48 | Sanitized JSON Report Exporter | Exports structured, secret-redacted, API-key-free JSON audit report | M4 | Spec Sec. 13, Phase 13 |
| 49 | Self-Contained HTML Report Exporter | Generates standalone HTML report with strict HTML escaping to prevent DOM injection | M4 | Spec Sec. 13, Phase 13 |
| 50 | In-Memory Results Clear Control | Clears transient audit state from memory to guarantee zero persistent history | M4 | Spec Sec. 14, Phase 13 |
| 51 | Multi-Browser Production Packaging | Verified builds and zips for Chrome (`pnpm zip`) and Firefox (`pnpm zip:firefox`) | M5 | Spec Sec. 15, Phase 15 |
| 52 | Full E2E Test Suite Pass (Tiers 1-4) | Pass 100% of requirement-driven test cases across all features and boundary conditions | M5 | Project Pattern, Phase 15 |
| 53 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing, SSRF exploits, malformed payloads, DOM bomb protections | M5 | Project Pattern, Phase 15 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Multi-Browser Adapters, Security Guardrails & Contracts | Features 1–8 | none | COMPLETE |
| M2 | Core Inspection Engine, Collectors & Analyzers | Features 9–29 | M1 | COMPLETE |
| M3 | Deep Inspection Crawler & External Intelligence | Features 30–39 | M1, M2 | COMPLETE |
| M4 | Anti-Slop UI, Findings Explorer & Sanitized Exporters | Features 40–50 | M1, M2, M3 | COMPLETE |
| M5 | Final Integration, 100% E2E Pass & Adversarial Hardening | Features 51–53 | M1, M2, M3, M4, E2E Track | COMPLETE |

## Interface Contracts
### `src/types/inspection.ts`
- `InspectionMode`: `'quick' | 'full' | 'deep'`
- `CollectionStatus`: `'completed' | 'partial' | 'skipped' | 'blocked' | 'unsupported' | 'failed'`
- `Severity`: `'critical' | 'high' | 'medium' | 'low' | 'info'`
- `FindingStatus`: `'passed' | 'failed' | 'warning' | 'not-applicable' | 'not-available'`
- `Evidence`: `{ label: string; value?: unknown; source: string; location?: string; observedAt: number }`
- `AuditFinding`: `{ id: string; ruleId: string; category: string; title: string; description: string; severity: Severity; status: FindingStatus; confidence?: number; evidence?: Evidence[]; remediation?: string; references?: string[] }`
- `CollectionResult<T>`: `{ status: CollectionStatus; data?: T; error?: string; coverage: { supported: boolean; message?: string } }`
- `WebsiteInspection`: Unified aggregate object holding metadata, mode, module collection results, findings, and scores.

### `src/browser/adapters/index.ts` ↔ Extension Core
- `BrowserAdapter`: Interface defining `executeScript`, `getTab`, `sendMessage`, `getStorage`, `setStorage`, `removeStorage`, `requestPermissions`, `hasPermissions`.
- `ChromeAdapter`: Implements `BrowserAdapter` via `chrome.*` APIs.
- `FirefoxAdapter`: Implements `BrowserAdapter` via `browser.*` APIs with fallback.

### `src/security/private-network.guard.ts`
- `isPrivateIp(ip: string): boolean`: Validates IPv4 (RFC 1918: 10/8, 172.16/12, 192.168/16; 127/8, 169.254/16, 224/4) and IPv6 (::1, fe80::/10, fc00::/7, ff00::/8).
- `validatePublicUrl(urlStr: string): Promise<{ valid: boolean; reason?: string }>`: Validates scheme (http/https only) and ensures destination host does not resolve to private IPs.

### `src/security/secret-redactor.ts`
- `redactSecrets<T>(data: T): T`: Recursively walks objects/strings to mask passwords, API keys, auth bearer tokens, session IDs, and form field inputs.

### `src/export/` ↔ UI
- `exportToJson(inspection: WebsiteInspection): string`: Serializes sanitized, secret-free JSON.
- `exportToHtml(inspection: WebsiteInspection): string`: Renders self-contained, strict-escaped HTML report preventing any script execution.

## Code Layout
```
├── entrypoints/
│   ├── background.ts                 # Service worker: orchestrator, crawl coordinator, external API dispatcher
│   ├── content.ts                    # Injected content script: DOM traversal, metrics, axe-core runner
│   ├── popup/                        # Extension popup UI (anti-slop dark theme)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/               # Header, ModeSelector, Progress, Scorecard, Accordions, FindingsExplorer
│   │   └── style.css
│   └── options/                      # Settings page (consent, providers, API keys, crawl bounds)
│       ├── index.html
│       ├── main.tsx
│       └── OptionsApp.tsx
├── src/
│   ├── types/                        # Core TypeScript interfaces & contracts
│   ├── browser/                      # Browser adapters (Chrome MV3, Firefox MV3)
│   ├── security/                     # PrivateNetworkGuard, SecretRedactor, SchemeValidator
│   ├── messaging/                    # Type-safe Chrome/Firefox runtime messaging
│   ├── core/                         # Inspection orchestrator, state machine, abort controller
│   ├── collectors/                   # Page collectors (DOM, SEO, Links, Media, Forms, axe-core, etc.)
│   ├── analyzers/                    # Rules engine & finding generator
│   ├── scoring/                      # Category scoring calculation
│   ├── crawler/                      # Same-origin crawler, robots.txt, sitemaps
│   ├── intelligence/                 # DoH, IP/ASN, CT logs, TLS inspector, consent gate, API key store
│   └── export/                       # Sanitized JSON & HTML exporters
├── tests/
│   ├── unit/                         # Unit tests for collectors, security guardrails, scoring, adapters
│   ├── integration/                  # End-to-end inspection pipeline tests
│   ├── security/                     # Private IP blocking, secret redaction, HTML escape, URL rejection tests
│   └── e2e/                          # Requirement-driven E2E test suites (Tiers 1-5 including adversarial)
├── package.json
├── tsconfig.json
├── wxt.config.ts
└── vitest.config.ts
```
