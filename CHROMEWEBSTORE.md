# Chrome Web Store Listing — SiteRadar

> Last Updated: 2026-11-07

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

• Quick Scan (< 1s): Checks HTTP response headers, TLS configuration, basic page metadata, and resource counts.
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

SiteRadar requests only three permissions:
• activeTab: Accesses the URL and tab ID of the current tab only when you open the popup and click inspect.
• scripting: Injects the auditing scripts into the active tab on demand during an inspection. No scripts run automatically in the background while you browse.
• storage: Saves your local display preferences (dark or light mode) and crawler page limits. It never stores audit logs or page data.

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
Show the popup after completing a Quick inspection on a real website. The Overview tab should be visible showing category scores, severity counts, and the target URL in the header.

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
| `activeTab` | permissions | Required to identify the specific tab the user explicitly requests to audit. When the user opens the popup and clicks "Start Inspection," the extension reads the URL and tab ID of the currently active tab. Access is temporary, isolated to user gesture, and grants no persistent background monitoring. |
| `scripting` | permissions | Required to dynamically inject the auditing collectors (`content-scripts/content.js`) and execute main-world inspection routines only on the active tab when an audit is initiated by the user. Prevents running any scripts on non-audited pages. |
| `storage` | permissions | Required to remember user preferences across sessions: (1) color theme preference (dark/light), and (2) custom deep-crawl limits (maximum pages, crawl depth). No audit logs, browsing history, or website content is ever written to storage. |

**On-Demand Dynamic Injection Architecture:**
The extension strictly avoids persistent content scripts and broad host permissions. No code is injected automatically into pages during regular browsing. When a user explicitly initiates an inspection from the popup, the extension uses `chrome.scripting.executeScript` to dynamically inject the collector script into the active tab under the temporary authorization granted by `activeTab`. This ensures strict adherence to Chrome Web Store Minimum Permissions requirements.

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
- Security header analysis via background HEAD fetch may fail for websites with strict CORS policies. This is non-fatal; the extension falls back to DOM-based analysis.
- The extension cannot inspect `chrome://`, `about:blank`, `file://`, or other internal browser pages.

### Rejection History

*No prior submissions.*

