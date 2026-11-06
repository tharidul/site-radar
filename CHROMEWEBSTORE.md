# Chrome Web Store Listing — SiteRadar

> Last Updated: 2026-11-07

---

## Store Listing

**Extension Name**
SiteRadar

**Short Description** (114 characters)
Audit any website for security, speed, SEO, and accessibility. Local-first checks, scores, and downloadable reports.

**Detailed Description**
SiteRadar audits the security, performance, SEO, and accessibility of any web page directly inside your browser. No website data ever leaves your device.

Open the extension on any tab, pick an audit depth, and get concrete findings with actionable steps to fix each issue.

Key Features:

• Security Checks: Detects missing HTTPS, absent CSP headers, missing HSTS, frame protection gaps, mixed content, and unverified CDN scripts without Subresource Integrity (SRI) hashes.

• Speed & Web Vitals: Surfaces render-blocking scripts, unoptimized images, caching headers, and visible Core Web Vitals (LCP, CLS, TTFB) from the active document.

• SEO & Social Metadata: Reviews title and description lengths, Open Graph tags, Twitter cards, canonical URLs, robots directives, and sitemap availability.

• Accessibility (WCAG 2.1): Runs automated checks for color contrast, image alt attributes, ARIA landmarks, keyboard accessibility, and form labels using axe-core.

• Tech Stack Detection: Identifies frameworks and libraries (Next.js, React, Tailwind CSS, Vue, WordPress, etc.) and versions directly from DOM and runtime globals.

• Asset Inventory: Browse all scripts, stylesheets, images, and external origins loaded by the page, with inline previews and direct links to inspect each asset.

• Deep Crawl Mode: Crawls linked same-origin pages to catch site-wide broken links, missing meta tags, and robots.txt issues across up to 50 pages.

• Offline Reports: Export the complete audit as a self-contained HTML file or a structured JSON report to share with clients or your team.

Local and Private:
All audits run locally in your browser session. The extension collects no browsing history, runs no analytics, and does not upload your page content. Optional network lookups (DNS, IP intelligence, and certificate logs) require your explicit consent in Settings and remain off by default.

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

