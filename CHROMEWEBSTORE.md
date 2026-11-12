# Chrome Web Store Listing — SiteRadar

> Last Updated: 2026-11-12

---

## Store Listing

**Extension Name**
SiteRadar

**Short Description** (114 characters)
Audit any website for security, speed, SEO, and accessibility. Local-first checks, scores, and downloadable reports.

**Detailed Description**
SiteRadar inspects web pages for security flaws, accessibility issues, performance bottlenecks, and SEO defects directly in your browser. It runs entirely on your machine. No page content, source code, or browsing history is sent to remote servers.

Open the popup on any tab and run an audit. SiteRadar inspects the active document, tests security headers, runs accessibility evaluations with axe-core, measures Core Web Vitals, and fingerprints technologies used on the page. Each finding includes the affected DOM element or HTTP header, severity level, and specific remediation instructions.


AUDIT MODULES

Security
• HTTP security headers: Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
• Transport security: TLS enforcement, certificate expiration status, and mixed content detection.
• Resource integrity: Subresource Integrity (SRI) attributes on external scripts and stylesheets.
• Form security: Insecure submission targets (HTTP actions on HTTPS pages) and unencrypted password fields.
• Information disclosure: Server header banners, runtime framework signatures, and insecure cookie flags (missing Secure, HttpOnly, or SameSite).

Accessibility (WCAG 2.1 & 2.2 Level A/AA)
• Built-in axe-core engine (v4.14) runs directly against the live DOM.
• Color contrast ratios for text and graphical interface elements.
• Missing alt text on images and missing labels on form inputs.
• ARIA landmark roles, heading structure hierarchy (h1 through h6), and duplicate element IDs.
• Keyboard focus visibility and touch target dimensions.

Performance and Core Web Vitals
• Real-user performance timings from Navigation Timing and Paint Timing APIs.
• Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), First Contentful Paint (FCP), and Time to First Byte (TTFB).
• Render-blocking scripts, unoptimized web fonts, missing image dimensions, and uncompressed assets.

SEO and Metadata
• Title tags, meta descriptions, canonical link verification, and viewport configuration.
• Open Graph and Twitter Card preview tags.
• Structured data validation for JSON-LD, Microdata, and RDFa schemas.
• Robots directives (meta robots, X-Robots-Tag), robots.txt availability, and sitemap detection.

Technology Detection and Asset Inventory
• Identifies web servers, frameworks (React, Next.js, Vue, WordPress), CSS utilities, and third-party scripts from DOM structures and runtime globals.
• Lists every external script, stylesheet, image, font, and third-party origin loaded by the active document.


INSPECTION DEPTHS

• Full Page Audit (2-4s): Performs complete DOM analysis, form inspection, structured data verification, technology fingerprinting, and automated axe-core accessibility tests.
• Deep Inspection (10-30s): Runs the full page audit and crawls up to 50 same-origin links (depth 3) to identify broken links, missing meta tags, and orphan pages across the site.


REPORTS AND EXPORTS

• Standalone HTML: A single-file HTML report with embedded styles and findings. It has no external CDN dependencies and opens in any browser.
• Sanitized JSON: Machine-readable JSON output for automated pipelines, documentation, or issue trackers.
• Automatic secret redaction: In-memory filters mask API keys (Stripe, AWS, Slack), bearer tokens, passwords, and sensitive form inputs before reports are generated or displayed.


PRIVACY BY DESIGN

• Local processing: All audits run in your browser session. SiteRadar does not collect browsing history, run analytics, or transmit inspected page content.
• Ephemeral storage: Results exist only in memory during your active session. Closing the tab or clicking Clear immediately wipes all audit data.
• Intranet protection: Requests to internal network addresses (RFC 1918), loopback addresses (127.0.0.1, localhost), and link-local ranges are blocked to prevent internal network scanning.
• Optional external lookups: DNS-over-HTTPS, IP/ASN lookup, and Certificate Transparency log searches are turned off by default. They run only if you explicitly enable them in Settings.


PERMISSIONS

SiteRadar requests the following permissions strictly to fulfill its technical auditing and security inspection mission:
• activeTab: Accesses the URL and tab ID of the current tab only when you explicitly open the popup or side panel and initiate an inspection.
• tabs: Detects tab navigation and lifecycle events to clear stale audit findings and badges, queries active tabs when inspecting from the side panel, reloads pages with cache bypass for cold-cache performance audits, and opens settings/documentation tabs.
• scripting: Dynamically injects technical collectors into the inspected page on demand and executes isolated main-world inspection routines to detect runtime frameworks. No scripts run automatically in the background while you browse.
• storage: Saves your local display preferences (dark or light mode), crawler page limits, and temporary scan session states. It never stores audit logs or page data permanently on disk.
• cookies: Inspects cookie security attributes (Secure, HttpOnly, SameSite, expiration) on the audited site to detect security vulnerabilities and authentication hygiene risks.
• contextMenus: Adds a right-click browser shortcut allowing you to quickly open the SiteRadar inspection panel in Chrome's side panel.
• sidePanel: Displays the continuous inspection interface in Chrome's native side panel alongside web pages for seamless side-by-side auditing.
• alarms: Runs lightweight periodic keepalive signals to prevent the background service worker from idling out during multi-page crawl audits.
• optional_host_permissions (*://*/*): Requested at runtime only when you initiate an inspection, strictly scoped to the current active site's origin (for both Full and Deep audits) and automatically reset when the browser restarts, to enable background fetching of raw HTTP response security headers (HSTS, CSP, X-Frame-Options), robots.txt, and XML sitemaps without CORS restrictions.

**Category**
Developer Tools

**Single Purpose**
Inspect the currently active website for security, performance, SEO, accessibility, and best-practice issues, and generate a downloadable evidence-based audit report.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128x128 PNG | ✅ Ready | `.output/chrome-mv3/icon/128.png` |
| Screenshot 1 (required) | 1280x800 or 640x400 | ⬜ Not created | — |
| Screenshot 2 | 1280x800 or 640x400 | ⬜ Not created | — |
| Screenshot 3 | 1280x800 or 640x400 | ⬜ Not created | — |
| Small Promo Tile | 440x280 | ⬜ Not created | — |
| Marquee Promo Tile | 1400x560 | ⬜ Not created | — |

### Screenshot Guidance

**Screenshot 1 — Overview Dashboard (Required)**
Show the popup after completing a Full inspection on a real website. The Overview tab should be visible showing category scores, severity counts, and the target URL in the header.

**Screenshot 2 — Findings Explorer**
Show the Issues tab with several findings visible. Use a filter (e.g., Critical or High) to demonstrate the severity filtering UI.

**Screenshot 3 — Deep Crawl Result**
Show the popup after a Deep inspection on a multi-page website. Show the crawler module results and the expanded module status accordion.

**Screenshot 4 — Options / Settings Page**
Show the Settings page with the External Intelligence Consent section expanded, showing the per-provider disclosure and consent toggle.

**Screenshot 5 — HTML Export Report**
Show the downloaded standalone HTML report open in a browser tab, displaying the finding cards and severity scorecard.

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Required to identify the specific tab the user explicitly requests to audit. When the user opens the popup or side panel and clicks "Start Inspection", the extension reads the URL and tab ID of the currently active tab. Access is temporary, isolated to user gesture, and grants no persistent background monitoring. |
| `tabs` | permissions | Required for tab lifecycle management and multi-view auditing: (1) monitors tab navigation, reload, and closure events (`chrome.tabs.onUpdated`, `chrome.tabs.onActivated`, `chrome.tabs.onRemoved`) to clear stale audit results and badge states when the user leaves an audited site; (2) queries the active tab when auditing from the persistent side panel where popup focus context is not available; (3) performs cache-bypassed page reloads (`chrome.tabs.reload` with `bypassCache: true`) during hard-refresh performance audits; and (4) opens internal settings, documentation, and privacy policy pages via `chrome.tabs.create`. |
| `scripting` | permissions | Required to dynamically execute auditing collectors (`content-scripts/content.js`) on-demand only on the inspected tab when an audit is initiated by the user, and to execute isolated main-world inspection routines (`world: 'MAIN'`) to detect runtime JavaScript frameworks and globals (e.g. React, Next.js, Vue). Strictly avoids running persistent content scripts on non-audited pages. |
| `storage` | permissions | Required to remember user preferences across sessions: (1) UI display theme (dark/light mode); (2) user-configured deep crawl limits (maximum pages, crawl depth); and (3) temporary inspection session state in `chrome.storage.session` to recover audit progress across service worker lifecycles. No browsing history, website DOM content, or audit logs are permanently stored on disk. |
| `cookies` | permissions | Required to inspect cookie security flags (`Secure`, `HttpOnly`, `SameSite`, and expiration timestamps) on the audited website to identify security defects, such as session cookies vulnerable to cross-site scripting (XSS) or cross-site request forgery (CSRF). Cookie data is analyzed strictly locally in memory for security posture evaluation and redacted before report generation or export. |
| `contextMenus` | permissions | Required to add a right-click browser context menu item ("Open SiteRadar in Side Panel") that allows users to quickly open the SiteRadar inspection side panel for the active webpage from any tab. |
| `sidePanel` | permissions | Required to provide a persistent, native side panel inspection interface (`sidepanel.html`) running alongside web pages in Chrome. This enables developers to view real-time audit findings, explore DOM elements, and inspect cookie security side-by-side with the live site without popup auto-dismissal when interacting with the webpage. |
| `alarms` | permissions | Required to schedule temporary, low-frequency keepalive alarms during long-running background inspections (such as multi-page site crawls). Prevents premature Manifest V3 service worker idle termination without keeping CPU resources active when no scan is running. |
| `*://*/*` | optional_host_permissions | Declared only to allow per-origin runtime grants via `chrome.permissions.request()` when the user initiates an inspection (strictly scoped to the current site's `<protocol>//<host>/*` origin for both Full and Deep audits — never requesting `*://*/*` at runtime — and automatically revoked after the browser closes): (1) sends background `HEAD` requests to the audited URL to retrieve raw server HTTP response security headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and Server banners) without CORS restrictions or browser header stripping; (2) fetches same-origin pages, `robots.txt`, and XML sitemaps during multi-page deep crawl audits; and (3) connects to optional, user-consented intelligence endpoints (DNS-over-HTTPS via Cloudflare/Google, ASN lookup via ipapi.co, and Certificate Transparency logs via crt.sh). Network requests are never initiated automatically during normal browsing; they execute strictly on explicit user action for the targeted website. |

**On-Demand Dynamic Injection & Scoped Execution Architecture:**
SiteRadar enforces strict least-privilege principles in its runtime execution:
1. **Zero Persistent Content Scripts:** The extension does not declare `content_scripts` in `manifest.json`. No scripts run automatically while users browse.
2. **On-Demand Injection:** Collectors are injected into the active tab via `chrome.scripting.executeScript` only when the user explicitly triggers an inspection from the popup or side panel.
3. **Targeted Host Access:** `*://*/*` is declared under `optional_host_permissions` (not static `host_permissions`), and runtime origin access is requested via `chrome.permissions.request()` only when the user launches an inspection. Background network calls are dispatched strictly for the explicitly audited target URL upon user request.
4. **Local-First Privacy:** All audits, DOM evaluations, and cookie analyses run entirely locally in the browser session. Inspected data is kept in ephemeral memory and never transmitted to external analytics or third-party servers without explicit user opt-in consent.

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes — limited, local-only data is processed.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | Yes — inspected site DOM only, in memory, cleared by user | Only with explicit opt-in consent (hostname to DoH provider, IP to ASN provider, domain to CT log provider) | Website security, performance, SEO, accessibility audit | No — only optional public API services (DoH, ipapi.co, crt.sh) with user consent |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL:** [REQUIRED — See deployment instructions below]

### How to Publish

1. Copy `privacy-policy.html` from the project root to your publishing platform.
2. Options (all free):
   - **GitHub Pages:** Push to a `gh-pages` branch or `docs/` folder in your repo. URL will be `https://tharidul.github.io/site-radar/privacy-policy.html`
   - **Netlify Drop:** Drag the file to `netlify.com/drop`. Get an instant URL.
   - **Vercel:** `npx vercel` in a folder containing the file.
3. Verify the URL returns HTTP 200 before submitting.
4. Enter the URL in the Chrome Developer Dashboard under "Privacy Policy URL."

---

## Distribution

**Visibility:** Public
**Regions:** All regions

---

## Developer Info

**Publisher Name:** [REQUIRED — YOUR NAME OR COMPANY NAME]
**Contact Email:** [REQUIRED — YOUR PUBLIC CONTACT EMAIL]
**Support URL:** https://github.com/tharidul/site-radar/issues
**Homepage URL:** https://github.com/tharidul/site-radar

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.2.0 | 2026-11-10 | Added native browser side panel support, hard refresh (`Ctrl+Shift+R` cache bypass) scan flow, automatic full page lazy-load scroll measurement, AI & Search Optimization matrix (SEO/AEO/AGO), local cookie inspection manager, unified export dropdown, and enhanced dark/light contrast styling. | Ready for release |
| 0.1.0 | 2026-11-07 | Transitioned to on-demand dynamic script injection architecture (`activeTab` + `scripting`); eliminated `<all_urls>` persistent content script injection and redundant broad permissions to ensure strict compliance with Chrome Web Store Minimum Permissions policy. | Archived |

---

## Review Notes

### Pre-Submission Checklist

- [ ] `action.default_title` placeholder fixed in `wxt.config.ts`
- [ ] Privacy policy published to public HTTPS URL
- [ ] Privacy policy URL entered in CWS dashboard
- [ ] Publisher name filled in
- [ ] Contact email filled in
- [ ] At least 1 screenshot at 1280x800 or 640x400 uploaded
- [ ] Store icon (128x128) confirmed in dashboard
- [ ] Manual extension test on 3+ real websites completed
- [ ] Deep crawl mode tested on a live multi-page website
- [ ] JSON export tested
- [ ] HTML export tested
- [ ] Clear button tested
- [ ] Options page consent flow tested
- [ ] Extension tested on a website with known security issues

### Known Limitations

- API keys entered in Settings are stored in service worker memory only. They are cleared when the service worker restarts (browser restart, or after ~30s of extension inactivity). This is by design and disclosed in the UI.
- The deep crawl spider identifies itself as `WebsiteIntelligenceBot/1.0` to target servers. Some websites with aggressive bot protection may block these requests.
- Security header analysis via background HEAD fetch may fail on servers that block HEAD requests or enforce strict bot filtering. This is non-fatal; the extension falls back to DOM-based analysis.
- The extension cannot inspect `chrome://`, `about:blank`, `file://`, or other internal browser pages.

### Rejection History

*No prior submissions.*

