# Test Infrastructure & Quality Assurance Specification
## SiteRadar

**Target:** Cross-Browser WebExtension (Google Chrome MV3 & Mozilla Firefox MV3)  
**Test Runner:** Vitest v5.1.0 (with Happy-DOM environment & WXT Vitest plugin)  
**TypeScript Version:** 5.9.3 (strict mode)  
**Execution Command:** `pnpm test`  
**Typecheck Command:** `pnpm compile`

---

## 1. Test Philosophy

SiteRadar operates in privacy-sensitive, multi-browser environments where security guarantees (SSRF prevention, zero secret retention, local-only processing) are mission-critical. The testing infrastructure is designed around the following core tenets:

1. **Opaque-Box & Requirement-Driven**:
   - Tests evaluate system behavior exclusively against authoritative interface contracts defined in `src/types/` (`inspection.ts`, `browser.ts`, `security.ts`, `crawler.ts`, `intelligence.ts`, `messaging.ts`) and requirements in `WEBSITE-INTELLIGENCE-ARCHITECTURE.md` and `PROJECT.md`.
   - Tests avoid coupling to internal helper implementations or private module state, ensuring that architectural refactorings do not invalidate the test suite.

2. **Progressive Testability**:
   - Test suites are scoped to features and contracts implemented in current and completed milestones.
   - Forward contracts are validated via mock adapters and contract compliance assertions without invoking unimplemented backend dependencies.

3. **Total Test Isolation & Self-Containment**:
   - Every test establishes its own isolated environment (mock browser adapter instances, isolated storage instances, pristine event bus listeners).
   - Tests do not share mutable global state, do not depend on test execution order, and clean up their subscriptions and timers in `beforeEach` / `afterEach` hooks.

4. **Zero-Tolerance Security & Privacy Invariants**:
   - Tests assert that no passwords, bearer tokens, API keys, or form inputs can ever be retained in raw form within evidence structures.
   - Tests assert that external network requests cannot bypass RFC 1918 / RFC 4193 private network guards or execute without explicit user consent.

---

## 2. 4-Tier Testing Methodology

```
┌────────────────────────────────────────────────────────────────────────┐
│                      4-Tier Testing Architecture                       │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 4: Real-World Scenarios   (≥5 End-to-End User Journeys)         │
│  - E-Commerce Quick Scan, Threat Audit, Consent Gate & DoH,           │
│    Bounded Deep Crawl with Abort, Full A11y & Sanitized Report Export │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Cross-Feature Interactions (Pairwise & Multi-Module Flows)   │
│  - Redactor + Finding Contracts, Normalizer + SSRF Guard,             │
│    Message Bus + Adapters, Storage + Redaction, Script Exec + Envelope│
├────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundary & Corner Cases (≥5 Tests Per Feature)               │
│  - ReDoS Stress, IPv4/IPv6 CIDR Edges, Deep Nesting (20+ levels),     │
│    Credentials in Authority, Storage Concurrency, Message Bus Errors   │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Coverage (≥5 Tests Per Feature)                       │
│  - Domain Contracts, Browser Adapters, SSRF Guard, Secret Redactor,   │
│    URL Normalizer & Scheme Validator, Extension Messaging Bus         │
└────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Feature Coverage (`tests/e2e/tier1-features.test.ts`)
Validates standard functional requirements across every core system capability with at least 5 distinct test cases per feature:
- **Feature 1 & 2: Unified Domain Contracts & Inspection Data Modeling**
  - Verification of `WebsiteInspection` construction, `CollectionResult<T>` envelope standards, `AuditFinding` schema validity, `Evidence` structure formatting, and `CategoryScore` weight balance.
- **Feature 3 & 4: Multi-Browser Adapter Layer**
  - Verification of `BrowserAdapter` contract across tab queries, script execution wrappers, storage retrieval/persistence across areas (`local`, `session`), and optional permission granting.
- **Feature 5: Private Network & SSRF Guard**
  - Verification of IPv4 private address detection (RFC 1918), IPv6 unique local/link-local address detection (RFC 4193/4291), loopback protection, reserved multicast rejection, and public URL verification.
- **Feature 6: Secret Redaction Engine**
  - Verification of string masking for API keys, bearer tokens, JWTs, credit card numbers with Luhn validation, sensitive object key masking, and recursive collection sanitization.
- **Feature 7: URL Scheme & Boundary Normalization**
  - Verification of protocol restrictions (`http:`/`https:` strictly allowed), stripping of fragments and auth credentials, hostname lowercasing, and crawl boundary validation.
- **Feature 8: Extension Messaging Bus**
  - Verification of typed channel subscriptions, point-to-point dispatch (`sendToBackground`, `sendToTab`), typed response unpacking, and unsubscribe cleanup.

### Tier 2: Boundary & Corner Cases (`tests/e2e/tier2-boundaries.test.ts`)
Stress-tests features against extreme, malformed, adversarial, and edge-condition inputs with at least 5 distinct tests per feature:
- **Private Network Guard**:
  - Validates boundaries between public and private IP ranges (e.g. `9.255.255.255` vs `10.0.0.0`), carrier-grade NAT (`100.64.0.0/10`), IPv4-mapped IPv6 (`::ffff:127.0.0.1`), zero address (`0.0.0.0`), and single-label internal hosts (`http://intranet/`).
- **Secret Redactor Engine**:
  - Validates deep nesting (structures nested 25+ levels deep), circular object references, 100,000+ character string processing without ReDoS exponential catastrophic backtracking, mixed credential patterns, and case-insensitive sensitive key variants.
- **URL Scheme & Normalization**:
  - Validates URLs with embedded credentials (`https://user:pass@example.com`), malformed percent encodings, trailing dots, non-standard port numbers, directory traversal patterns (`/../../`), and obfuscated pseudo-protocols (`javascript:`, `data:`).
- **Browser Adapter Layer**:
  - Validates concurrent writes to identical storage keys, retrieval of missing keys returning undefined gracefully, empty permission requests, script execution failures in child frames, and empty tab queries.
- **Extension Messaging Bus**:
  - Validates dispatching to channels with zero listeners, handler exceptions converted to structured error envelopes, malformed incoming payloads, multiple concurrent handlers, and listener unsubscription idempotency.
- **Domain Inspection Contracts**:
  - Validates boundary values for `Severity` and `FindingStatus` enums, 0% and 100% boundary scores, empty findings summary calculation (`completedModules === 0`), negative confidence clamping, and timestamp sequence invariants (`startedAt <= completedAt`).

### Tier 3: Cross-Feature Interactions (`tests/e2e/tier3-combinations.test.ts`)
Tests pairwise and multi-module integration verifying that subsystems interact without contract drift or security blindspots:
- **Combination 1: Secret Redactor + Domain Inspection Findings**
  - Ingestion of audit findings with sensitive credentials in evidence values; verifies that redactor recursively scrubs evidence payloads while preserving finding metadata, rule IDs, and severities.
- **Combination 2: URL Normalizer + Private Network Guard**
  - Pipeline where input URLs pass through normalizer and immediately into IP/SSRF guard, ensuring malicious schemes or private hosts are caught at the proper pipeline stage.
- **Combination 3: Messaging Bus + Browser Adapter Storage**
  - Message bus dispatches state storage commands through adapter session storage, ensuring asynchronous message passing accurately persists and retrieves state.
- **Combination 4: Browser Storage + Secret Redaction**
  - End-to-end persistence of inspection results containing sensitive configuration; verifies that data stored in session storage is pre-redacted.
- **Combination 5: Messaging Bus + Security Guardrails**
  - Routing external intelligence lookup requests over the bus, with automated guardrail interception that rejects RFC 1918 destinations before dispatch.
- **Combination 6: Script Execution + CollectionResult Envelope**
  - Simulates content script collector execution via `MockBrowserAdapter.executeScript` and wraps output into a standardized `CollectionResult<T>` envelope with coverage reporting.
- **Combination 7: Concurrent Multi-Tab Operations**
  - Simulates simultaneous inspection workflows across different tab IDs, verifying that tab contexts, message routing, and storage keys remain fully isolated.
- **Combination 8: Redacted Error Propagation**
  - Simulates a collector failure where the runtime error contains a sensitive token or connection string, verifying that `CollectionResult.errors` is sanitized before storage or display.
- **Combination 9: Deep Crawl Queue Ingestion & Boundary Filter**
  - Crawl frontier ingestion filtering internal vs external links and rejecting unsafe protocols before queuing.
- **Combination 10: In-Memory State Clear Pipeline**
  - Lifecycle dispatch of `STATE_CLEAR` message, verifying that active inspection state and adapter storage are purged completely.

### Tier 4: Real-World Application Scenarios (`tests/e2e/tier4-scenarios.test.ts`)
Executes complete end-to-end inspection journeys reflecting production usage:
- **Scenario 1: Quick Scan of an E-Commerce Website**
  - Active tab resolution, passive DOM and metadata collection, sanitized form inventory, finding generation, category scoring, and aggregate inspection summary generation.
- **Scenario 2: Security & Threat Audit of a Hostile / Compromised Page**
  - Detection of mixed content, exposed API credentials, insecure HTTP password form submissions, and blocked internal network probing attempts.
- **Scenario 3: External Intelligence Lookup with Consent Gate**
  - User initiates external DNS/TLS analysis; consent gate prompts user and verifies granted permissions; DoH queries execute and resolve to public ASN without leaking private network data.
- **Scenario 4: Bounded Same-Origin Deep Crawl with Mid-Flight Abort**
  - Deep crawl traversal parses `robots.txt`, queues internal links up to configured concurrency, detects a user cancellation command, and aborts in-flight fetches gracefully.
- **Scenario 5: Full Page Audit & Report Sanitization / Export**
  - Full audit including simulated axe-core accessibility violations, structured data, and performance metrics, generating sanitized JSON and anti-XSS HTML report artifacts.
- **Scenario 6: Multi-Browser Adapter Parity & State Reset**
  - Execution of identical inspection lifecycles under Chrome and Firefox adapter modes, validating identical contract outputs, followed by in-memory state reset.

---

## 3. Coverage Thresholds & Quality Metrics

All test suites enforce strict verification targets:

| Metric | Target Threshold | Scope |
|---|---|---|
| **Statement Coverage** | ≥ 85% | All core security, adapter, and contract modules |
| **Branch Coverage** | ≥ 80% | All guardrails, scheme validators, redactors, and bus handlers |
| **Function Coverage** | ≥ 90% | All public contract methods and factory functions |
| **Test Flakiness** | 0% | Deterministic, non-timing-dependent assertions |
| **Compilation** | Clean | Zero TypeScript errors (`tsc --noEmit`) |

---

## 4. Test Runner Commands

### Run Full Test Suite
```bash
pnpm test
```

### Run Full Test Suite with Coverage
```bash
pnpm vitest run --coverage
```

### Run Specific Test Tiers
```bash
pnpm vitest run tests/e2e/tier1-features.test.ts
pnpm vitest run tests/e2e/tier2-boundaries.test.ts
pnpm vitest run tests/e2e/tier3-combinations.test.ts
pnpm vitest run tests/e2e/tier4-scenarios.test.ts
```

### Run in Watch Mode
```bash
pnpm test:watch
```

### Verify TypeScript Compilation
```bash
pnpm compile
```
