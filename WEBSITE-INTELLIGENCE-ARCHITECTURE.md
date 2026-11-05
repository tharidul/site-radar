# Website Intelligence & Security Auditor
## Complete Extension System Architecture and Project Structure

**Status:** Architecture baseline  
**Target browsers:** Google Chrome and Mozilla Firefox  
**Extension framework:** WXT  
**Frontend:** React + TypeScript  
**Build tooling:** Vite (managed by WXT)  
**Package manager:** pnpm  
**Styling:** Tailwind CSS  
**Accessibility engine:** axe-core  
**Deployment model:** Local-first browser extension  
**Backend/database:** None

---

## 1. Product definition

Website Intelligence & Security Auditor is a cross-browser extension that inspects the currently open website, evaluates its technical characteristics, and presents evidence-based findings about SEO, accessibility, performance, security indicators, privacy, technologies, content, and infrastructure.

The product has three inspection modes:

| Mode | Scope | Typical use |
|---|---|---|
| Quick Scan | Fast inspection of the active page | Initial overview |
| Full Page Audit | Comprehensive inspection of the active page | Detailed technical audit |
| Website Deep Inspection | Full-page audit plus controlled same-origin discovery and external intelligence | Website-wide investigation |

The extension must distinguish observed facts from inferred signals. Every finding should identify its evidence, source, confidence where applicable, and limitations.

### Core principles

- Local-first: page inspection and analysis run in the browser wherever possible.
- No owned backend, database, account system, or cloud processing.
- No audit history. Results exist in memory until the popup/session is closed or the user exports them.
- External intelligence is opt-in and must disclose which domain or IP information is sent to each provider.
- API integrations are optional and disabled until configured by the user.
- Least-privilege permissions and just-in-time permission requests.
- Never collect passwords, form values, authentication tokens, cookie values, or other secret content.
- No bypassing authentication, access controls, paywalls, or anti-bot protections.
- No unsupported claims of complete WCAG, security, SEO, or performance compliance.

---

## 2. High-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                        │
│                                                             │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │ React Popup UI      │       │ Background Controller   │  │
│  │                     │       │                         │  │
│  │ - Mode selector     │◄─────►│ - Scan lifecycle        │  │
│  │ - Progress          │       │ - Message routing       │  │
│  │ - Findings          │       │ - Permission checks     │  │
│  │ - Module results    │       │ - Cancellation          │  │
│  │ - Export controls   │       │ - Browser adapters      │  │
│  └──────────┬──────────┘       └────────────┬────────────┘  │
│             │                               │               │
│             │                               ▼               │
│             │                    ┌────────────────────────┐ │
│             └───────────────────►│ Inspection Orchestrator│ │
│                                  └────────────┬───────────┘ │
│                                               │             │
│                         ┌─────────────────────┼───────────┐ │
│                         ▼                     ▼           ▼ │
│                ┌────────────────┐   ┌────────────────┐ ┌───┐│
│                │ Page Collector │   │ Audit Engines  │ │   ││
│                │ Content Script │   │ SEO/Security/  │ │   ││
│                │ DOM/Resources   │   │ A11y/Perf/etc. │ │   ││
│                └────────────────┘   └────────────────┘ │   ││
│                                                        │   ││
│                ┌───────────────────────────────────────┘   ││
│                ▼                                           ││
│       ┌──────────────────────┐      ┌────────────────────┐ │
│       │ External Intelligence│─────►│ Provider Adapters   │ │
│       │ DNS/TLS/ASN/CTI       │      │ Public + Optional   │ │
│       └──────────────────────┘      │ API-key providers   │ │
│                                     └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Runtime responsibilities

**Popup UI**
- Starts scans and selects inspection mode.
- Displays progress, module status, findings, evidence, and limitations.
- Requests explicit user confirmation before external lookups or deep crawling.
- Offers JSON and HTML export.
- Does not perform privileged browser operations directly.

**Background controller**
- Coordinates scan lifecycle and message routing.
- Checks permissions before privileged operations.
- Tracks cancellation and scan state in memory.
- Selects the browser-specific adapter.
- Does not retain audit history.

**Content script / page collector**
- Collects page-visible DOM and runtime information.
- Runs only after the user starts an inspection.
- Avoids collecting form values and secret-bearing fields.
- Returns normalized, bounded data to the orchestrator.

**Inspection orchestrator**
- Determines which modules run for each mode.
- Executes modules with controlled concurrency and timeouts.
- Normalizes errors and partial results.
- Produces the unified inspection result.

**Analysis engines**
- Convert collected evidence into findings.
- Do not silently convert missing evidence into a passing result.
- Attach source, confidence, severity, recommendation, and limitations.

**External intelligence layer**
- Queries approved public services or user-configured providers.
- Sends only the minimum data required for a lookup.
- Records provider, query scope, timestamp, and response limitations.
- Requires explicit user consent for external disclosure.

---

## 3. Recommended project structure

The structure below is a target architecture. WXT starter conventions and generated files should be retained where appropriate; do not replace generated configuration blindly.

```text
website-intelligence/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── typecheck.yml
│   │   └── release.yml
│   └── ISSUE_TEMPLATE/
│
├── .vscode/
│   ├── extensions.json
│   └── settings.json
│
├── entrypoints/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── style.css
│   │
│   ├── background.ts
│   ├── content.ts
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
│
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── src/
│   ├── app/
│   │   ├── providers/
│   │   ├── routes/
│   │   └── app-config.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── dashboard/
│   │   ├── inspection/
│   │   ├── findings/
│   │   ├── scores/
│   │   ├── modules/
│   │   ├── technology/
│   │   ├── infrastructure/
│   │   ├── permissions/
│   │   ├── progress/
│   │   ├── export/
│   │   └── common/
│   │
│   ├── features/
│   │   ├── scan-launcher/
│   │   ├── scan-progress/
│   │   ├── results-overview/
│   │   ├── findings-explorer/
│   │   ├── module-details/
│   │   ├── external-intelligence-consent/
│   │   ├── provider-settings/
│   │   └── report-export/
│   │
│   ├── core/
│   │   ├── contracts/
│   │   │   ├── inspection.ts
│   │   │   ├── finding.ts
│   │   │   ├── module-result.ts
│   │   │   ├── evidence.ts
│   │   │   ├── provider.ts
│   │   │   └── browser.ts
│   │   │
│   │   ├── orchestrator/
│   │   │   ├── inspection-orchestrator.ts
│   │   │   ├── module-registry.ts
│   │   │   ├── mode-plans.ts
│   │   │   ├── scheduler.ts
│   │   │   ├── cancellation.ts
│   │   │   └── timeout.ts
│   │   │
│   │   ├── analysis/
│   │   │   ├── finding-builder.ts
│   │   │   ├── severity.ts
│   │   │   ├── confidence.ts
│   │   │   ├── coverage.ts
│   │   │   └── scoring/
│   │   │
│   │   ├── messaging/
│   │   │   ├── message-types.ts
│   │   │   ├── message-client.ts
│   │   │   └── message-handlers.ts
│   │   │
│   │   └── errors/
│   │       ├── inspection-error.ts
│   │       └── error-normalizer.ts
│   │
│   ├── collectors/
│   │   ├── page/
│   │   │   ├── identity.collector.ts
│   │   │   ├── dom.collector.ts
│   │   │   ├── metadata.collector.ts
│   │   │   ├── resources.collector.ts
│   │   │   ├── links.collector.ts
│   │   │   ├── images.collector.ts
│   │   │   ├── media.collector.ts
│   │   │   ├── styles.collector.ts
│   │   │   ├── scripts.collector.ts
│   │   │   ├── forms.collector.ts
│   │   │   ├── content.collector.ts
│   │   │   ├── responsive.collector.ts
│   │   │   ├── runtime.collector.ts
│   │   │   └── privacy-signals.collector.ts
│   │   │
│   │   ├── browser/
│   │   │   ├── browser-info.collector.ts
│   │   │   ├── navigation.collector.ts
│   │   │   ├── permissions.collector.ts
│   │   │   └── headers.collector.ts
│   │   │
│   │   ├── website/
│   │   │   ├── robots.collector.ts
│   │   │   ├── sitemap.collector.ts
│   │   │   ├── url-discovery.collector.ts
│   │   │   └── crawl.collector.ts
│   │   │
│   │   └── infrastructure/
│   │       ├── dns.collector.ts
│   │       ├── ip.collector.ts
│   │       ├── asn.collector.ts
│   │       ├── certificate.collector.ts
│   │       ├── tls.collector.ts
│   │       └── hosting.collector.ts
│   │
│   ├── analyzers/
│   │   ├── seo/
│   │   ├── structured-data/
│   │   ├── accessibility/
│   │   ├── performance/
│   │   ├── security/
│   │   ├── privacy/
│   │   ├── technology/
│   │   ├── content/
│   │   ├── responsive/
│   │   ├── forms/
│   │   ├── resources/
│   │   └── infrastructure/
│   │
│   ├── intelligence/
│   │   ├── public/
│   │   │   ├── dns/
│   │   │   ├── certificate-transparency/
│   │   │   ├── ip-asn/
│   │   │   └── reputation/
│   │   │
│   │   ├── providers/
│   │   │   ├── provider.interface.ts
│   │   │   ├── provider-registry.ts
│   │   │   └── adapters/
│   │   │
│   │   ├── consent/
│   │   │   ├── disclosure.ts
│   │   │   └── consent-gate.ts
│   │   │
│   │   ├── api-keys/
│   │   │   ├── key-manager.ts
│   │   │   └── key-validation.ts
│   │   │
│   │   └── rate-limits/
│   │       ├── request-budget.ts
│   │       └── backoff.ts
│   │
│   ├── browser/
│   │   ├── browser-api.ts
│   │   ├── permissions.ts
│   │   ├── tabs.ts
│   │   ├── scripting.ts
│   │   ├── network.ts
│   │   ├── adapters/
│   │   │   ├── chrome.adapter.ts
│   │   │   └── firefox.adapter.ts
│   │   └── capabilities.ts
│   │
│   ├── security/
│   │   ├── url-validation.ts
│   │   ├── redirect-validation.ts
│   │   ├── private-network-guard.ts
│   │   ├── secret-redaction.ts
│   │   ├── safe-serialization.ts
│   │   └── crawl-policy.ts
│   │
│   ├── scoring/
│   │   ├── score-engine.ts
│   │   ├── score-model.ts
│   │   └── score-explanations.ts
│   │
│   ├── export/
│   │   ├── json-exporter.ts
│   │   ├── html-exporter.ts
│   │   ├── report-template.ts
│   │   └── export-sanitizer.ts
│   │
│   ├── state/
│   │   ├── inspection-store.ts
│   │   ├── settings-store.ts
│   │   └── session-store.ts
│   │
│   ├── hooks/
│   ├── utils/
│   │   ├── url.ts
│   │   ├── dom.ts
│   │   ├── timing.ts
│   │   ├── text.ts
│   │   └── collections.ts
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   ├── theme.css
│   │   └── components.css
│   │
│   └── types/
│       ├── global.d.ts
│       └── vendor.d.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── browser/
│   │   ├── chrome/
│   │   └── firefox/
│   ├── fixtures/
│   └── security/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA-COLLECTION.md
│   ├── PERMISSIONS.md
│   ├── PRIVACY.md
│   ├── SECURITY-MODEL.md
│   ├── EXTERNAL-PROVIDERS.md
│   ├── SCORING-MODEL.md
│   └── BROWSER-COMPATIBILITY.md
│
├── wxt.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── postcss.config.js
├── tailwind.config.ts
├── eslint.config.js
├── .gitignore
├── README.md
└── LICENSE
```

---

## 4. Inspection modes and module plans

The orchestrator uses explicit mode plans. A module can be enabled in more than one mode.

### Quick Scan

- Website identity
- Basic DOM and metadata
- SEO essentials
- Link and image summary
- Technology fingerprinting
- Basic performance metrics
- Basic security indicators
- Privacy/tracker indicators

### Full Page Audit

Includes Quick Scan plus:

- Detailed DOM and semantic structure
- Structured data
- Complete link and resource inventory
- Images and media
- CSS and JavaScript analysis
- Detailed SEO checks
- axe-core accessibility checks
- Performance resource analysis
- Forms and privacy indicators
- Security header indicators where accessible
- Responsive layout checks

### Website Deep Inspection

Includes Full Page Audit plus:

- robots.txt discovery
- sitemap discovery and bounded parsing
- same-origin URL discovery
- bounded crawl and per-page audit
- DNS records
- IP and ASN information
- public certificate history
- live TLS checks where supported by the selected provider
- hosting/CDN/infrastructure indicators
- optional configured provider enrichment

Deep Inspection must show crawl limits, pages attempted, pages completed, excluded URLs, and why pages were excluded.

---

## 5. Collection module catalogue

| Module | Data collected | Important limitations |
|---|---|---|
| Identity | URL, origin, title, language, charset, viewport, canonical, favicon | Some metadata may be absent |
| DOM | Elements, semantic tags, IDs, nesting, hidden nodes, custom elements | Closed shadow roots are inaccessible |
| SEO | Title, description, robots, canonical, hreflang, social metadata, headings | Search ranking cannot be inferred |
| Structured data | JSON-LD, Microdata, RDFa, schema types | Syntax validity does not guarantee rich-result eligibility |
| Links | URL, text, rel, target, internal/external classification | Link availability is not equivalent to server reachability |
| Images | Source, dimensions, alt, loading, srcset, broken-image indicators | Cross-origin and CSS image details may be restricted |
| Media | Audio/video sources, captions, controls, duration | Playback state may be unavailable |
| CSS | Stylesheets, computed styles, layout, fonts, colors, contrast signals | Cross-origin stylesheets may be unreadable |
| JavaScript | Script sources, module/async/defer, runtime signals | Runtime framework detection is heuristic |
| Technologies | Frameworks, libraries, CMS, analytics, CDN indicators | Evidence and confidence must be shown |
| Performance | Navigation/resource timing, Web Vitals where available | Cross-origin timing may be restricted |
| Accessibility | axe-core results, labels, ARIA, landmarks, contrast | Automated checks do not prove WCAG conformance |
| Security | HTTPS, mixed content, form actions, header indicators, iframe/SRI signals | Some headers are inaccessible to content scripts |
| Third parties | Analytics, ads, chat, CDN, tracker indicators | Detection lists can be incomplete or outdated |
| Forms | Structure, method, action, field types and attributes | Never collect field values |
| Privacy | Consent tools, policy links, tracker signals | Backend data handling cannot be determined from the page |
| Runtime | Browser capabilities, service worker indicators, storage metadata | Never collect stored values or secrets |
| Responsive/content | Viewport, overflow, touch targets, visible text, word count | Breakpoint inference is approximate |
| Infrastructure | DNS, IP/ASN, certificate, TLS, hosting, redirects | Depends on external provider availability and consent |

---

## 6. External intelligence strategy: Hybrid

The selected strategy combines browser-native inspection, public intelligence services, and optional user-configured API providers.

### 6.1 Browser-native inspection

Runs locally and is the default source for page-level information. It should not send page content to external services.

### 6.2 Public intelligence

Potential public sources include:

- DNS-over-HTTPS resolvers for DNS records.
- Certificate Transparency search services for publicly logged certificates.
- Public IP/ASN datasets or APIs.
- Public reputation or hosting intelligence services, when explicitly enabled.

Provider adapters must be replaceable. Do not hardwire provider-specific response formats into the core result model.

### 6.3 Optional API providers

- Provider integrations are disabled until configured.
- The user must enter their own key and select the provider.
- Display the provider, data being sent, and purpose before the first request.
- Prefer session-only API-key handling.
- If persistent key storage is later offered, clearly disclose that extension storage is not a hardware-backed secrets vault and can be exposed by a compromised browser profile or extension context.
- Never include API keys in logs, reports, error messages, exports, or analytics.
- Never transmit a key to a provider other than the provider selected by the user.
- Provide a clear remove/clear-key control.
- Validate provider URLs and prevent arbitrary endpoint injection.

### 6.4 External disclosure model

Before external lookups, show a concise disclosure:

- What hostname, domain, IP, or certificate identifier will be sent.
- Which provider receives it.
- Whether the provider may log requests under its own privacy policy.
- Whether the lookup is public or uses the user's API key.
- Whether the lookup can be skipped.

External lookups must be independently switchable from local page inspection.

---

## 7. Browser permissions and compatibility

Use the minimum permissions required for each feature. Exact manifest permissions must be finalized against the current WXT version and the supported Chrome and Firefox versions.

Potential capabilities:

| Capability | Permission/capability approach |
|---|---|
| Inspect active tab | `activeTab` after explicit user action |
| Inject collector | `scripting` where required |
| Read current tab URL/title | Tabs API as needed |
| Crawl same-origin pages | Optional host permissions requested when Deep Inspection starts |
| Query external providers | Host permissions for specific provider origins, requested when enabled |
| Download report | Browser downloads API only if needed; otherwise Blob download from popup |
| Persist settings | Avoid by default; if added, request storage capability and document it |

Do not request broad `<all_urls>` access at installation without a strong, documented reason. Use optional host permissions and explain why they are required.

Chrome and Firefox have API and manifest differences. Keep those differences behind `src/browser/adapters/`. Do not assume that Chrome MV3 `webRequest`, request-header visibility, response-header access, or background lifecycle behavior maps directly to Firefox.

---

## 8. Unified data contracts

All modules return a common envelope so that partial, blocked, unsupported, and failed checks remain visible.

```ts
export type InspectionMode = "quick" | "full" | "deep";

export type CollectionStatus =
  | "completed"
  | "partial"
  | "skipped"
  | "blocked"
  | "unsupported"
  | "failed";

export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type FindingStatus =
  | "passed"
  | "failed"
  | "warning"
  | "not-applicable"
  | "not-available";

export interface Evidence {
  label: string;
  value?: unknown;
  source: string;
  location?: string;
  observedAt: number;
}

export interface CollectionResult<T> {
  module: string;
  status: CollectionStatus;
  collectedAt: number;
  data: T | null;
  coverage: {
    expected: number;
    collected: number;
    unavailable: number;
  };
  limitations: string[];
  errors: string[];
  sources: string[];
}

export interface AuditFinding {
  id: string;
  category: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  status: FindingStatus;
  confidence?: number;
  evidence: Evidence[];
  recommendation?: string;
  source: string;
  references?: string[];
}

export interface WebsiteInspection {
  id: string;
  mode: InspectionMode;
  target: {
    url: string;
    origin: string;
    hostname: string;
    inspectedAt: number;
  };
  browser: {
    name: "chrome" | "firefox";
    version?: string;
  };
  modules: Record<string, CollectionResult<unknown>>;
  findings: AuditFinding[];
  summary: {
    completedModules: number;
    partialModules: number;
    failedModules: number;
    totalFindings: number;
  };
}
```

### Contract rules

- Missing evidence is not a pass.
- Unsupported checks must be `unsupported` or `not-available`.
- A module can be `partial` if some checks ran and others were blocked.
- Each finding must have a stable `ruleId`.
- Findings should include evidence and a source.
- Confidence is for heuristic detection, not a substitute for evidence.
- Do not store secrets in evidence.
- Avoid embedding full page HTML or arbitrary page text in exports.

---

## 9. Orchestration and execution lifecycle

1. User selects a mode.
2. Popup obtains the active tab.
3. UI explains required permissions and external disclosures.
4. User approves the inspection.
5. Orchestrator validates URL and permissions.
6. Collectors execute with per-module timeouts and concurrency limits.
7. Analyzers evaluate normalized evidence.
8. Results are aggregated and coverage is calculated.
9. Popup receives progress updates.
10. User reviews findings and may export a report.
11. In-memory scan state is discarded when the session ends or is explicitly cleared.

The orchestrator must support:

- Abort/cancel.
- Timeouts.
- Bounded concurrency.
- Per-module error isolation.
- Progress events.
- Duplicate-work avoidance.
- Safe retry policy.
- Permission-denied handling.
- Partial result delivery.

---

## 10. Deep Inspection crawl policy

Deep Inspection is a controlled crawler, not an unrestricted spider.

Initial proposed defaults:

| Limit | Initial default |
|---|---:|
| Maximum pages | 50 |
| Maximum depth | 3 |
| Concurrent page inspections | 2 |
| Per-page timeout | 15 seconds |
| Sitemap entries processed | 5,000 |
| Retry count | 1 |
| Maximum redirects | 5 |
| Scope | Same origin |

Security controls:

- Same-origin by default.
- Normalize URLs and remove fragments before deduplication.
- Reject `javascript:`, `data:`, `file:`, browser-internal and unsupported schemes.
- Validate every redirect destination.
- Reject loopback, private, link-local, multicast, and other non-public IP ranges for external network lookups.
- Revalidate DNS resolutions to reduce DNS-rebinding risk.
- Do not crawl pages requiring authentication unless the user explicitly navigates to them and the inspection remains within allowed browser access.
- Do not submit forms or trigger destructive actions.
- Do not bypass CAPTCHAs, paywalls, robots directives, or access controls.
- Respect crawl limits and expose them in the report.
- Treat robots.txt as a crawl directive, not proof of permission.
- Do not send page content to public intelligence providers.

---

## 11. Findings, scoring, and evidence

### Finding severity

- **Critical:** A clearly evidenced issue with severe security or user impact.
- **High:** Significant issue with meaningful risk or impact.
- **Medium:** Material issue that should be addressed.
- **Low:** Minor issue or improvement opportunity.
- **Info:** Informational observation.

Severity definitions must be mapped to explicit rules. Do not assign severity from vague heuristics.

### Scores

Potential score categories:

- Security
- Performance
- SEO
- Accessibility

Initial weighting may be considered only after rule definitions and validation. Scores must disclose:

- Number of checks evaluated.
- Number passed, failed, and unavailable.
- Rule weights and scoring formula.
- Whether checks are automated or heuristic.

Do not give a perfect score when substantial checks were unavailable. Avoid representing a heuristic score as a standards certification.

---

## 12. Popup user interface

The popup is compact, dark-themed, and expandable.

### Main screen

- Current website identity.
- Quick Scan / Full Page Audit / Website Deep Inspection selector.
- Start and cancel controls.
- Progress indicator.
- Overall findings summary.
- Module coverage status.

### Expandable result sections

- Overview
- SEO
- Security
- Performance
- Accessibility
- Technology
- Infrastructure
- Resources
- Privacy
- Content

### Finding detail

Each finding should display:

- Severity and status.
- Rule identifier.
- Explanation.
- Evidence.
- Confidence when heuristic.
- Recommended remediation.
- Source and limitations.

### Settings/options page

- External intelligence enable/disable.
- Provider selection.
- API-key configuration and clearing.
- Crawl limits.
- Privacy disclosure.
- Export preferences.

Settings should not silently enable external services. Do not add audit history.

---

## 13. Export system

Supported initial formats:

**JSON**
- Machine-readable inspection result.
- Module statuses and coverage.
- Findings and evidence.
- Provider provenance.
- Limitations and timestamps.

**HTML**
- Human-readable report.
- Summary and scores.
- Findings grouped by category/severity.
- Evidence and recommendations.
- Coverage and limitations.
- Provider/source disclosure.

Export requirements:

- User initiates every export.
- Sanitize untrusted page-derived strings before HTML rendering.
- Escape HTML and prevent script injection.
- Redact secrets and sensitive values.
- Do not export API keys.
- Do not silently upload reports.

---

## 14. Privacy and data-handling requirements

- No backend or database.
- No automatic audit history.
- No telemetry by default.
- No form-value collection.
- No password or authentication-secret collection.
- No cookie-value collection.
- No API-key logging or export.
- No page-content disclosure to external providers.
- External lookups require explicit consent.
- Clearly distinguish browser-local analysis from provider requests.
- Keep only the data necessary to produce the current report.
- Provide a clear way to cancel and clear in-memory results.

---

## 15. Testing strategy

### Unit tests
- URL normalization and validation.
- Finding construction and severity.
- Coverage calculations.
- Technology detection rules.
- SEO rules.
- Security rules.
- Scoring calculations.
- Secret redaction.
- Export sanitization.

### Integration tests
- Orchestrator mode plans.
- Module timeouts and failures.
- Partial results.
- Permission denial.
- External provider adapters.
- Cancellation.
- Crawl boundaries and redirect validation.

### Browser tests
- Chrome extension build and runtime.
- Firefox extension build and runtime.
- Popup interactions.
- Active-tab inspection.
- Optional permission prompts.
- Cross-origin limitations.
- Background lifecycle behavior.

### Security tests
- Malicious page content.
- HTML injection in reports.
- Redirect to private IP.
- DNS rebinding scenarios.
- URL scheme abuse.
- API-key redaction.
- Unexpected external requests.
- Crawl scope escape.

---

## 16. Implementation phases

The project should be implemented incrementally. Do not attempt to build every module in one step.

| Phase | Deliverable |
|---|---|
| 0 | Confirm architecture, data policy, and external intelligence choice |
| 1 | Initialize WXT React TypeScript project |
| 2 | Configure linting, formatting, Tailwind, aliases, and scripts |
| 3 | Establish contracts, browser adapters, and message protocol |
| 4 | Build popup shell and scan-mode selector |
| 5 | Implement active-tab inspection and Quick Scan |
| 6 | Implement SEO, metadata, links, images, and resource collectors |
| 7 | Implement security, privacy, technology, and performance analyzers |
| 8 | Integrate axe-core accessibility checks |
| 9 | Implement Full Page Audit orchestration |
| 10 | Implement bounded same-origin discovery and Deep Inspection |
| 11 | Implement public DNS, IP/ASN, certificate, and TLS adapters |
| 12 | Add optional API provider configuration and consent controls |
| 13 | Add scoring, findings explorer, and report exports |
| 14 | Add Chrome/Firefox compatibility and security test suites |
| 15 | Package, validate, document, and prepare releases |

Each phase should have an explicit acceptance checklist and be tested before the next phase begins.

---

## 17. Definition of done

The initial product is ready for release when:

- It builds for Chrome and Firefox.
- The popup can inspect the active page after explicit user action.
- Quick Scan, Full Page Audit, and Deep Inspection have distinct documented scopes.
- Findings include evidence, severity, status, and limitations.
- Missing or blocked checks are not marked as passed.
- External intelligence is opt-in and provider disclosure is visible.
- API keys are never exposed in logs or reports.
- Deep crawling respects scope and resource limits.
- No secrets or form values are collected.
- JSON and HTML exports are sanitized.
- No backend, database, or audit history exists.
- Permission prompts are justified and minimal.
- Unit, integration, browser, and security tests pass.

---

## 18. Key technical references

- WXT documentation: https://wxt.dev/
- Chrome extension permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome scripting API: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chrome webRequest API: https://developer.chrome.com/docs/extensions/reference/api/webRequest
- MDN Performance API: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API
- MDN Resource Timing: https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API
- MDN Timing-Allow-Origin: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Timing-Allow-Origin
- axe-core: https://github.com/dequelabs/axe-core
- Google Public DNS: https://developers.google.com/speed/public-dns/docs/doh
- Cloudflare DNS over HTTPS: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/
- Certificate Transparency search: https://crt.sh/
- SSL Labs: https://www.ssllabs.com/ssltest/

---

## 19. Architecture decisions requiring future confirmation

The following are deliberately not hard-coded as irreversible decisions:

1. Exact provider list for DNS, IP/ASN, certificate, reputation, and optional API integrations.
2. Whether API keys remain session-only or may optionally be saved by explicit user choice.
3. Exact Chrome and Firefox minimum supported versions.
4. Final crawl limits and user-configurable bounds.
5. Final scoring weights and rule definitions.
6. Whether HTML export includes any page-derived excerpts (default should be no).
7. Whether any additional permissions are justified by a specific feature.

These decisions should be made when the relevant implementation phase is reached, with browser compatibility and privacy implications documented.
