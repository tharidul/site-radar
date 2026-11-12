# 🛡️ SiteRadar Audit — Remediation Progress Tracker

> **Audit Date:** November 2026  
> **Report:** [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) · 38 findings · 105 files audited  
> **Last Updated:** 2026-11-12

---

## 📊 Progress Overview

| Severity | Total | ✅ Fixed | 🚫 Won't Fix | 🔄 In Progress | ⏳ Pending |
|----------|------:|--------:|-------------:|---------------:|----------:|
| 🔴 Critical | 3 | 3 | 0 | 0 | 0 |
| 🟠 High | 7 | 7 | 0 | 0 | 0 |
| 🟡 Medium | 17 | 17 | 0 | 0 | 0 |
| 🔵 Low | 10 | 9 | 1 | 0 | 0 |
| ℹ️ Info | 1 | 1 | 0 | 0 | 0 |
| **Total** | **38** | **37** | **1** | **0** | **0** |

> **Completion:** `38 / 38` resolved — 100% (`37` Fixed, `1` Won't Fix)

---

## 🔴 Critical Findings

| ID | Title | File(s) | Status | Assigned To | PR / Commit |
|----|-------|---------|--------|-------------|-------------|
| [CRIT-01](./AUDIT_REPORT.md#crit-01-server-side-request-forgery-ssrf--intranet-interrogation-in-standalone-mcp-server-tools) | SSRF & Intranet Interrogation in MCP Server Tools | `headers.tool.ts`, `auditor.ts`, `browser.ts`, `server.ts` | ✅ Fixed | Worker 1 | Verified (`pnpm compile`, `pnpm test`, `tsx`) |
| [CRIT-02](./AUDIT_REPORT.md#crit-02-critical-permission--store-listing-discrepancy-omission-of-broad-host-permissions--5-api-permissions) | Chrome Web Store Permissions Omission (4 permissions + `*://*/*`) | `CHROMEWEBSTORE.md` | ✅ Fixed | Worker 1 | Verified (100% manifest parity) |
| [CRIT-03](./AUDIT_REPORT.md#crit-03-background-service-worker-termination-mid-crawl-on-long-running-deep-scans) | Service Worker Idle Termination Mid-Crawl | `background.ts`, `wxt.config.ts`, `App.tsx` | ✅ Fixed | Worker 1 | Verified (alarm + port keepalive) |

---

## 🟠 High Findings

| ID | Title | File(s) | Status | Assigned To | PR / Commit |
|----|-------|---------|--------|-------------|-------------|
| [HIGH-01](./AUDIT_REPORT.md#high-01-background-message-bus-missing-sender-context-validation-content-script-ipc-escalation) | IPC Message Bus Missing Sender Context Validation | `src/messaging/bus.ts`, `entrypoints/background.ts` | ✅ Fixed | `@ipc-background` | Verified (#8, #9: `isInternalExtensionSender` + `requireInternalSender`, `tests/ipc-security.test.ts`) |
| [HIGH-02](./AUDIT_REPORT.md#high-02-remote-code-execution--sandbox-bypass-risk-via---no-sandbox-and-ignorehttpserrors-in-mcp-playwright) | MCP Playwright `--no-sandbox` + `ignoreHTTPSErrors` RCE Risk | `src/mcp/browser.ts` | ✅ Fixed | `@mcp-hardening` | Verified (#6, #9: sandbox args removed, `ignoreHTTPSErrors: false`, `tests/mcp-server.test.ts`) |
| [HIGH-03](./AUDIT_REPORT.md#high-03-mcp-headers-tool-runtime-report-corruption-via-nonexistent-headerleakitem-properties) | MCP Headers Tool `HeaderLeakItem` Property Name Bug | `src/mcp/tools/headers.tool.ts` (L85) | ✅ Fixed | `@mcp-hardening` | Verified (#6, #9: uses `leak.name`, `leak.value`, `leak.risk`) |
| [HIGH-04](./AUDIT_REPORT.md#high-04-unchecked-dereference-of-undefined-deductionsexplanation-in-auditor-report-generator) | MCP Auditor `deductionsExplanation` Undefined Crash | `src/mcp/auditor.ts` (L287) | ✅ Fixed | `@mcp-hardening` | Verified (#6, #9: safe optional chaining `deductionsExplanation?.[0]`) |
| [HIGH-05](./AUDIT_REPORT.md#high-05-in-memory-external-intelligence-consent-choices-wiped-on-service-worker-termination) | In-Memory Consent Lost on Service Worker Restart | `src/intelligence/consent-manager.ts`, `entrypoints/background.ts`, `entrypoints/options/OptionsApp.tsx` | ✅ Fixed | `@consent-store` / `@ipc-background` | Verified (#7, #8, #9: persisted in `'local'` storage + hydrated via `ensureLoaded()`, `tests/consent-manager.test.ts`) |
| [HIGH-06](./AUDIT_REPORT.md#high-06-user-configured-options-crawl-limits-ignored-by-background-orchestrator--spider) | Options Crawl Limits Ignored by Backend Crawler | `entrypoints/options/OptionsApp.tsx`, `entrypoints/popup/App.tsx`, `entrypoints/background.ts` | ✅ Fixed | `@ipc-background` | Verified (#8, #9: stored `crawlLimits` + `perPageTimeoutMs` loaded & applied, `tests/ipc-security.test.ts`) |
| [HIGH-07](./AUDIT_REPORT.md#high-07-static-type-compilation-failure-21-typescript-errors-across-8-core-and-test-files) | 21 TypeScript Compilation Errors Across 8 Files | `technology.collector.ts`, `auditor.ts`, `browser.ts`, `a11y.tool.ts`, `headers.tool.ts`, 3 test files | ✅ Fixed | `@verifier` | Verified (#9: `pnpm run compile` 0 errors, `pnpm test` 48/48, `pnpm run build` passed) |

---

## 🟡 Medium Findings

| ID | Title | File(s) | Status | Assigned To | PR / Commit |
|----|-------|---------|--------|-------------|-------------|
| [MED-01](./AUDIT_REPORT.md#med-01-crawler-ssrf-guard-bypass-via-wildcard-dns-hostnames-nipio-sslipio) | Crawler SSRF Guard Bypass via Wildcard DNS (`*.nip.io`, `*.sslip.io`) | `src/security/private-network.guard.ts`, `src/crawler/spider.ts` | ✅ Fixed | `@security-guards` | Verified (#19, #22: wildcard DNS suffixes blocked + redirect hops validated, `tests/security-medium.test.ts`) |
| [MED-02](./AUDIT_REPORT.md#med-02-prototype-pollution-vulnerability-in-secret-redactor-object-traversal) | Prototype Pollution in Secret Redactor | `src/security/secret-redactor.ts` | ✅ Fixed | `@security-guards` | Verified (#19, #22: `Object.create(null)` + key guard, `tests/security-medium.test.ts`) |
| [MED-03](./AUDIT_REPORT.md#med-03-arbitrary-cross-domain-cookie-setting--cookie-jar-poisoning-in-cookie-service) | Arbitrary Cross-Domain Cookie Setting / Cookie Jar Poisoning | `src/services/cookie.service.ts` | ✅ Fixed | `@security-guards` | Verified (#19, #22: `assertValidCookieDomain` enforced, `tests/security-medium.test.ts`) |
| [MED-04](./AUDIT_REPORT.md#med-04-inverted--dead-axe-core-impact-branch-logic-in-accessibility-tool) | Inverted / Dead axe-core Impact Branch Logic in a11y Tool | `src/mcp/tools/a11y.tool.ts` (L41–46) | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: clean `'critical'`/`'high'`/`'medium'`/minor mapping) |
| [MED-05](./AUDIT_REPORT.md#med-05-asynchronous-cancellation-race-condition-due-to-mismatched-local-vs-orchestrator-scan-ids) | Cancellation Race Condition (Local vs Orchestrator Scan IDs) | `entrypoints/popup/App.tsx` | ✅ Fixed | `@ui-privacy` | Verified (#21, #22: `res.scanId` tracked via ref/state + `pendingCancelRef`, `tests/ui-privacy-permissions.test.ts`) |
| [MED-06](./AUDIT_REPORT.md#med-06-unbounded-network-hang-due-to-missing-abortsignal-timeouts-on-http-fetch-calls) | Missing `AbortSignal` Timeouts on HTTP Fetch Calls | `src/core/orchestrator/inspection-orchestrator.ts`, `src/mcp/tools/headers.tool.ts`, `src/mcp/auditor.ts` | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: `AbortSignal.timeout(10000)` on fetch calls) |
| [MED-07](./AUDIT_REPORT.md#med-07-out-of-bounds-element-dereference-in-technologycollector-atomic-class-scanner) | Out-of-Bounds Element Dereference in `TechnologyCollector` | `src/collectors/page/technology.collector.ts` (L432–434) | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: element bounds/null guard confirmed) |
| [MED-08](./AUDIT_REPORT.md#med-08-unconsented-telemetry-leak-via-external-google-fonts-cdn-in-html-views) | Unconsented Telemetry Leak via Google Fonts CDN | `entrypoints/popup/*`, `entrypoints/options/*`, `entrypoints/sidepanel/index.html` | ✅ Fixed | `@ui-privacy` | Verified (#21, #22: Google Fonts removed, system font stacks used, `tests/ui-privacy-permissions.test.ts`) |
| [MED-09](./AUDIT_REPORT.md#med-09-inspected-visited-domain-information-leak-to-google-public-favicon-service) | Visited Domain Leak to Google Favicon Service | `entrypoints/popup/components/SocialPreviewView.tsx` | ✅ Fixed | `@ui-privacy` | Verified (#21, #22: Google favicon URL removed, local `<Globe />` fallback, `tests/ui-privacy-permissions.test.ts`) |
| [MED-10](./AUDIT_REPORT.md#med-10-external-network-consent-assertion-bypass-in-asnlookupclient-when-targetorigin-is-omitted) | ASN Lookup Consent Assertion Bypass when `targetOrigin` is Omitted | `src/intelligence/asn-lookup.ts` | ✅ Fixed | `@security-guards` | Verified (#19, #22: global `ip-asn` consent asserted, `tests/security-medium.test.ts`) |
| [MED-11](./AUDIT_REPORT.md#med-11-broad-host-permissions--violates-chrome-web-store-principle-of-least-privilege) | Broad Host Permissions `*://*/*` Violates Least Privilege | `wxt.config.ts`, `entrypoints/popup/App.tsx`, `CHROMEWEBSTORE.md` | ✅ Fixed | `@ui-privacy` | Verified (#21, #22: moved to `optional_host_permissions` + runtime request, `tests/ui-privacy-permissions.test.ts`) |
| [MED-12](./AUDIT_REPORT.md#med-12-storage-quota-accumulation-risk-from-unbounded-retention-of-origin-session-payloads) | Unbounded Session Storage Quota Accumulation | `src/core/orchestrator/inspection-orchestrator.ts` | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: LRU capped at 10 origins, `tests/orchestrator-lifecycle.test.ts`) |
| [MED-13](./AUDIT_REPORT.md#med-13-stale-zombie-scan-sessions-trapped-in-running-state-following-service-worker-restarts) | Stale Zombie Scans Trapped in `'running'` State After SW Restart | `src/core/orchestrator/inspection-orchestrator.ts` | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: orphaned `'running'` sessions marked `'failed'`, `tests/orchestrator-lifecycle.test.ts`) |
| [MED-14](./AUDIT_REPORT.md#med-14-firefox-mv3-minimum-version-inconsistency-strict_min_version-1090-vs-1150) | Firefox MV3 `strict_min_version` Inconsistency (`109.0` vs `115.0`) | `wxt.config.ts` | ✅ Fixed | `@ui-privacy` | Verified (#21, #22: `strict_min_version: '115.0'` in `.output/firefox-mv3/manifest.json`) |
| [MED-15](./AUDIT_REPORT.md#med-15-scan-mode-identifier-inconsistency-fast-vs-quick) | Scan Mode Identifier Inconsistency (`'fast'` vs `'quick'`) | `src/mcp/auditor.ts` (L195) | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: `'fast'` mapped to `'quick'`) |
| [MED-16](./AUDIT_REPORT.md#med-16-websitetargetinspectedat-data-type-inconsistency-number-vs-iso-string) | `WebsiteTarget.inspectedAt` Type Inconsistency (`number` vs ISO `string`) | `src/types/inspection.ts`, `src/mcp/auditor.ts`, exporters | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: numeric timestamp in core, ISO string only on export) |
| [MED-17](./AUDIT_REPORT.md#med-17-unmocked-network-socket-connection-leak-in-unit-tests-econnrefused-13000) | Unmocked Network Socket Leak in Unit Tests (`ECONNREFUSED ::1:3000`) | `src/core/orchestrator/inspection-orchestrator.ts` | ✅ Fixed | `@orchestrator-net` | Verified (#20, #22: live fetch skipped for `mock` adapter, zero `ECONNREFUSED`) |

---

## 🔵 Low Findings

| ID | Title | File(s) | Status | Assigned To | PR / Commit |
|----|-------|---------|--------|-------------|-------------|
| [LOW-01](./AUDIT_REPORT.md#low-01-permissive-inline-script-execution-unsafe-inline-in-exported-standalone-html-reports) | `unsafe-inline` CSP in Exported HTML Reports | `src/export/html.exporter.ts` | ✅ Fixed | `@export-orchestrator` | Verified (#31, #34: SHA-256 `script-src`, no `'unsafe-inline'`, `tests/low-export-orchestrator.test.ts`) |
| [LOW-02](./AUDIT_REPORT.md#low-02-dom-clobbering-vulnerability-in-technology-detection-script-injected-into-main-world) | DOM Clobbering in MAIN World Technology Detection Script | `src/core/orchestrator/inspection-orchestrator.ts` | ✅ Fixed | `@export-orchestrator` | Verified (#31, #34: DOM-clobbering guards in `detectMainWorldTechnologies()`, `tests/low-export-orchestrator.test.ts`) |
| [LOW-03](./AUDIT_REPORT.md#low-03-disk-persistence-fallback-for-session-data-contradicts-ephemeral-ram-privacy-guarantee) | Disk Storage Fallback Contradicts Ephemeral RAM Privacy Guarantee | `src/core/orchestrator/inspection-orchestrator.ts`, `privacy-policy.md` | ✅ Fixed | `@export-orchestrator` | Verified (#31, #34: RAM-only when session storage unavailable, no `'local'` fallback, `tests/low-export-orchestrator.test.ts`) |
| [LOW-04](./AUDIT_REPORT.md#low-04-unchecked-array-indexing-on-lcp-performance-entries) | Unchecked Out-of-Bounds LCP Array Indexing | `src/mcp/browser.ts` (L233–239) | ✅ Fixed | `@scoring-deps` | Verified (#32, #34: `lcps[lcps.length - 1]` safely guarded, `pnpm compile` 0 errors) |
| [LOW-05](./AUDIT_REPORT.md#low-05-dead-code-completely-unused-crawlqueue-implementation) | Dead Code: Unused `CrawlQueue` Implementation | `src/crawler/crawl-queue.ts`, `src/crawler/index.ts` | ✅ Fixed | `@crawler-perf-bg` | Verified (#33, #34: `crawl-queue.ts` deleted, 0 remaining references) |
| [LOW-06](./AUDIT_REPORT.md#low-06-redundant-srcexporters-directory-shim) | Redundant `src/exporters` Directory Shim | `src/exporters/` | ✅ Fixed | `@export-orchestrator` | Verified (#31, #34: `src/exporters/` deleted, 0 remaining references) |
| [LOW-07](./AUDIT_REPORT.md#low-07-encapsulation-bypass-via-as-any-in-boundedspider) | Encapsulation Bypass via `as any` in `BoundedSpider` | `src/crawler/robots.ts`, `src/crawler/spider.ts` | ✅ Fixed | `@crawler-perf-bg` | Verified (#33, #34: typed getters on `RobotsParser`, `as any` removed in `spider.ts`, `tests/low-crawler-bg.test.ts`) |
| [LOW-08](./AUDIT_REPORT.md#low-08-synchronous-layout-thrashing-in-responsivecollector) | Synchronous Layout Thrashing in `ResponsiveCollector` | `src/collectors/page/responsive.collector.ts` | ✅ Fixed | `@crawler-perf-bg` | Verified (#33, #34: `MAX_TAP_TARGET_ELEMENTS = 200` cap, `tests/low-crawler-bg.test.ts`) |
| [LOW-09](./AUDIT_REPORT.md#low-09-context-menu-duplicate-registration-on-extension-update--unfiltered-tab-listeners) | Context Menu Duplicate Registration on Extension Update | `entrypoints/background.ts` | ✅ Fixed | `@crawler-perf-bg` | Verified (#33, #34: `contextMenus.removeAll()` guard + filtered `tabs.onUpdated`, `tests/low-crawler-bg.test.ts`) |
| [LOW-10](./AUDIT_REPORT.md#low-10-transitive-dependency-vulnerability-in-deepmerge-ghsa-gcqx-w48m-w2h4) | Transitive `deepmerge` Vulnerability (`GHSA-gcqx-w48m-w2h4`) | `package.json` (transitive devDep) | 🚫 Won't Fix | `@scoring-deps` | Verified (#32, #34: `Patched versions: None` upstream, dev-only via `wxt`/`web-ext`/`addons-linter`, absent from `.output/` bundles) |

---

## ℹ️ Informational

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| [INFO-01](./AUDIT_REPORT.md#info-01-scoring-engine-anomaly-100-unobservable-category-scores-75-moderate) | Scoring Engine 75pt Ceiling for 100% Unobservable Categories | ✅ Fixed | Verified (#32, #34: `calculateCategoryScore()` returns `score: 0` + `coveragePercent: 0` + explanation when `evaluatedChecks === 0`, `tests/score-engine.test.ts`) |

---

## 📋 Status Key

| Symbol | Meaning |
|--------|---------|
| ⏳ Pending | Not yet started |
| 🔄 In Progress | Actively being worked on |
| 👀 In Review | PR/fix open and awaiting review |
| ✅ Fixed | Merged and verified |
| 🚫 Won't Fix | Accepted risk or out of scope |
| ➡️ Deferred | Deferred to future milestone |

---

## 🗓️ Suggested Remediation Order

> Fix Critical and High issues first. Within each tier, prioritise by exploitability and user impact.

### Sprint 1 — Immediate (Critical + High Security)
- [x] CRIT-01 — Add URL/IP allowlist + SSRF validation to all MCP server fetch calls
- [x] CRIT-02 — Update `CHROMEWEBSTORE.md` to list all permissions accurately
- [x] HIGH-02 — Remove `--no-sandbox` and `ignoreHTTPSErrors` from Playwright launch args
- [x] HIGH-01 — Validate `sender.id === chrome.runtime.id` in all background message handlers

### Sprint 2 — Short-term (Remaining High + Critical Lifecycle)
- [x] CRIT-03 — Add MV3 alarm keepalive or offscreen document for long crawls
- [x] HIGH-05 — Persist consent state to `chrome.storage.local` (not in-memory only)
- [x] HIGH-06 — Wire options crawl limits through to orchestrator and spider
- [x] HIGH-03 — Fix `HeaderLeakItem` property names in `headers.tool.ts`
- [x] HIGH-04 — Add null guard for `deductionsExplanation` in auditor
- [x] HIGH-07 — Fix all 21 TypeScript compilation errors

### Sprint 3 — Medium-term (Medium severity)
- [x] MED-01 — DNS rebind SSRF bypass in private-network guard
- [x] MED-02 — Prototype pollution fix in secret redactor
- [x] MED-03 — Enforce strict cookie domain validation in cookie service
- [x] MED-04 — Fix inverted axe severity branch logic
- [x] MED-05 — Race condition fix for cancellation scan IDs
- [x] MED-06 — Add `AbortSignal` with timeouts to all fetch calls
- [x] MED-07 — Guard element bounds/null access in `TechnologyCollector`
- [x] MED-08, MED-09 — Remove/proxy Google Fonts CDN and Favicon service calls
- [x] MED-10 — Fix ASN consent assertion bypass
- [x] MED-11 — Move `*://*/*` to `optional_host_permissions` with runtime request
- [x] MED-12 — Cap persisted origin sessions with LRU eviction
- [x] MED-13 — Recover zombie scans on SW restart
- [x] MED-14 — Bump Firefox `strict_min_version` to `'115.0'`
- [x] MED-15 — Map `'fast'` to `'quick'` in MCP auditor
- [x] MED-16 — Keep `WebsiteTarget.inspectedAt` numeric in core and ISO on export
- [x] MED-17 — Mock network calls in unit tests

### Sprint 4 — Cleanup (Low / Informational)
- [x] LOW-01 — Remove `unsafe-inline` from exported HTML CSP
- [x] LOW-02, LOW-03 — Guard MAIN-world tech detection against DOM clobbering & remove `'local'` session storage fallback
- [x] LOW-04 — Add bounds check for LCP array indexing
- [x] LOW-05, LOW-06 — Remove dead `CrawlQueue` and redundant `src/exporters`
- [x] LOW-07, LOW-08 — Add typed getters on `RobotsParser` (`as any` removed) & cap `ResponsiveCollector` tap-target checks at 200
- [x] LOW-09 — Guard context menu registration against duplicates & filter `tabs.onUpdated`
- [x] LOW-10 — 🚫 Won't Fix (`deepmerge@4.3.1` / `GHSA-gcqx-w48m-w2h4`: dev-only via `wxt`/`web-ext`/`addons-linter`, `Patched versions: None` upstream, verified absent from `.output/` runtime bundles)
- [x] INFO-01 — Return `score: 0` (0% coverage) when `evaluatedChecks === 0` in `score-engine.ts`

---

*Generated from [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) · Update status cells as fixes are completed.*

