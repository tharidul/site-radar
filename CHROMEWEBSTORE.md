# Chrome Web Store Listing — Website Intelligence & Security Auditor

> Last Updated: 2026-11-06

---

## Store Listing

**Extension Name**
Website Intelligence & Security Auditor

**Short Description** (117 characters)
Inspect any website's security, performance, SEO, and accessibility. Evidence-based findings, scores, and downloadable reports.

**Detailed Description**
Website Intelligence & Security Auditor gives you a full technical inspection of any website you visit — without leaving your browser and without sending your data to any server.

Point the extension at any website, choose your inspection depth, and get a structured audit covering:

Security — detects missing HTTPS, absent Content-Security-Policy headers, missing HSTS, absent X-Frame-Options, Subresource Integrity gaps, mixed content, and more. Each finding explains what was observed, why it matters, and how to fix it.

Performance — evaluates resource loading patterns, render-blocking assets, image optimization signals, caching hints, and Core Web Vitals indicators visible in the DOM.

SEO — inspects title tags, meta descriptions, Open Graph metadata, structured data markup, canonical links, hreflang, robots directives, and sitemap presence.

Accessibility — runs a full accessibility evaluation against WCAG standards, identifying missing ARIA labels, insufficient color-contrast signals, keyboard navigation issues, and form accessibility problems.

Best Practices — checks for deprecated APIs, insecure external resources, outdated or vulnerable framework signals, and web platform best practices.

Deep Crawl Mode — audits up to 50 pages of the same website in one run, discovers the site structure, checks robots.txt compliance, and identifies sitewide issues.

Security Intelligence (optional, requires explicit consent) — look up DNS records, server ASN and hosting provider, and certificate transparency history for any domain.

Scorecards — each category gets a scored summary (0-100) showing passed, warning, and failed checks at a glance.

Downloadable Reports — export your full audit as a self-contained HTML report or a structured JSON file for further analysis or sharing with your team.

HOW TO USE:
1. Navigate to the website you want to audit.
2. Click the extension icon in your toolbar.
3. Choose Quick, Full, or Deep inspection mode.
4. Click "Start Inspection" and watch the audit run in real time.
5. Browse findings by category, severity, and rule ID.
6. Export the report to HTML or JSON when done.

PRIVACY:
All inspection work happens in your browser — no website content is sent to any server. The extension does not collect your browsing history, does not use analytics or tracking, and does not store audit results after you clear them. Optional external lookups (DNS, IP intelligence, certificate history) require your explicit consent in Settings and are disabled by default.

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
| `activeTab` | permissions | Required to identify the specific tab the user wants to audit. When the user clicks "Start Inspection," the extension reads the URL and tab ID of the currently active tab to target the inspection. Without this permission, the extension cannot determine which website to audit. |
| `scripting` | permissions | Required to run inspection code in the main JavaScript execution context of the page. Some framework detection (React, Vue, Angular, Next.js, etc.) requires accessing window-level globals only visible from the page's main world. This permission enables that targeted, user-initiated script execution. |
| `storage` | permissions | Required to remember two user preferences between sessions: (1) the user's chosen color theme (dark/light), and (2) custom deep-crawl limit settings (maximum pages, crawl depth, concurrency). No audit data, browsing history, or website content is ever written to storage. |
| `optional_host_permissions: *://*/*` | host_permissions | Requested only when needed, not granted by default. Enables two specific features the user deliberately activates: (1) fetching HTTP response headers from the target website to check security headers, and (2) crawling additional pages of the same website in Deep inspection mode. The extension accesses only the specific website the user is inspecting. |

**Content Script Match (`<all_urls>`) Justification:**
The content script is registered with `<all_urls>` so the extension can respond when the user inspects any website they choose to audit. The script is completely passive — it performs no actions, reads no data, and makes no network requests until it receives an explicit inspection request from the user via the popup. Without a universal match, users would be unable to audit arbitrary websites.

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
   - **GitHub Pages:** Push to a `gh-pages` branch or `docs/` folder in your repo. URL will be `https://yourusername.github.io/your-repo/privacy-policy.html`
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
**Support URL:** [RECOMMENDED — GitHub Issues URL or support email]
**Homepage URL:** [OPTIONAL]

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-11-06 | Initial submission | Draft |

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

