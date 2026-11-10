# Privacy Policy — SiteRadar

**Effective Date:** November 9, 2026  
**Version:** 0.1.0  
**Developer & Publisher:** Tharidu Lakmal (LKML)  
**Website:** [https://tharidulakmal.com](https://tharidulakmal.com)  
**Repository:** [https://github.com/tharidul/site-radar](https://github.com/tharidul/site-radar)  

---

## 1. Overview

SiteRadar is an open-source browser extension for technical site auditing. It inspects active web pages when you click "Inspect Page" or run an audit mode. It evaluates technical architecture, performance timings, accessibility (axe-core), standard SEO, AEO (LLMs.txt & AI crawlers), AGO (agent optimization), security response headers, and resource transfer weights.

All core analysis runs locally in your browser tab and background service worker. SiteRadar does not operate tracking servers, telemetry services, or data collection pipelines.

---

## 2. Data Not Collected

SiteRadar does not collect, record, or transmit:

- Browsing history or URLs of visited pages outside explicit audits
- Cookie tracking or telemetry. When using the on-demand Cookie Manager tab, cookies for the active domain are inspected and edited strictly locally within your browser and are never transmitted to any external server.
- Form input values, keystrokes, or submitted personal information
- Authentication credentials, passwords, or authentication tokens
- Analytics, telemetry, usage metrics, or crash reports
- Personally identifiable user information

---

## 3. Data Processed During Audits

When you start an audit on a tab, SiteRadar accesses the following information locally from that specific tab:

- **Page Document & DOM:** Tag hierarchy, headings, meta tags, links, scripts, stylesheets, and image elements.
- **Form Structure:** Field names, types, and autocomplete attributes. Field values are never read or captured.
- **Navigation & Paint Timings:** TTFB, FCP, LCP, DOM ready, and window load times from the browser Performance API.
- **Network Resources:** Resource timing entries (count, file types, transfer sizes, and decoded body sizes) from the browser Performance Timeline.
- **HTTP Response Headers:** Fetched via a direct HTTP HEAD request from your browser to the target site origin.

---

## 4. Deep Crawl Mode

In Deep Crawl mode, SiteRadar discovers internal links and fetches up to 50 additional pages directly from the same target domain. These requests originate directly from your browser to the host website, with User-Agent header `WebsiteIntelligenceBot/1.0`. Crawled data is processed in memory and discarded when the session ends.

---

## 5. External Intelligence Lookups (Opt-In Only)

**Default State:** All external lookups are disabled by default. No data leaves your machine unless you enable a specific provider in Settings > External Intelligence Opt-In.

| Provider | Data Sent | Purpose | Privacy Policy |
| :--- | :--- | :--- | :--- |
| Cloudflare DNS-over-HTTPS (`cloudflare-dns.com`) | Inspected domain hostname | Query public DNS records (A, AAAA, MX, TXT, NS, CAA) | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| ipapi.co | Resolved server IP address | Identify ASN, server location, and hosting network | [ipapi.co/privacy](https://ipapi.co/privacy/) |
| crt.sh (Sectigo) | Inspected domain name | Query public Certificate Transparency logs | [crt.sh](https://crt.sh/) |

SiteRadar enforces a private network guard: it never sends private (RFC 1918), loopback (127.0.0.1/::1), or link-local IP addresses to external services.

---

## 6. Local Browser Storage

SiteRadar writes only two user configuration records to `chrome.storage.local`:

| Storage Key | Stored Value | Function |
| :--- | :--- | :--- |
| `theme` | `"dark"` or `"light"` | Persists your chosen interface theme |
| `crawlLimits` | maxPages, depth, concurrency, timeout | Persists your crawler configuration limits |

Audit results, findings, scores, and crawled URLs are stored exclusively in temporary service worker RAM. They are never written to disk or browser storage.

---

## 7. Data Retention & Automatic Purging

- **Tab Navigation:** Navigating away from the audited domain purges the active report from memory.
- **Browser Close:** Closing the browser destroys all in-memory audit results immediately.
- **Manual Reset:** Clicking the Reset button in the header purges all in-memory state.
- **Exported Reports:** JSON and HTML audit reports are saved to your local Downloads folder only when you click "Export".
- **Uninstalling:** Removing the extension deletes all stored preferences from `chrome.storage.local`.

---

## 8. Automated Secret Redaction

Before any extracted metadata or HTTP headers enter the inspection report, SiteRadar runs an automated redactor that masks:

- API keys and secret tokens (OpenAI, Anthropic, Stripe, AWS access keys, GitHub tokens)
- JSON Web Tokens (JWT)
- HTTP Authorization headers (Bearer tokens, Basic auth credentials)
- Luhn-validated credit card numbers
- Password query parameters in URLs

---

## 9. Browser Permissions

| Permission | Exact Purpose |
| :--- | :--- |
| `activeTab` | Enables inspection on the tab you are actively viewing when you trigger an audit. |
| `scripting` | Executes the lightweight in-tab collector to read DOM elements, SEO tags, and window-level framework globals. |
| `storage` | Saves your theme preference and crawler limits locally across browser sessions. |
| `cookies` | Enables the Cookie Manager tab to inspect, edit, and audit security attributes (HttpOnly, Secure, SameSite) of cookies for the active domain locally. |
| `optional_host_permissions (*://*/*)` | Requested on demand to inspect HTTP headers and crawl pages on domains you audit. |

---

## 10. Third-Party Code

SiteRadar bundles **axe-core** (by Deque Systems) for accessibility compliance testing. The axe-core engine executes locally in your browser and makes zero network requests. No third-party analytics, tracking SDKs, or ad scripts are bundled in the extension.

---

## 11. Developer Contact & Source Code

SiteRadar is open source under the MIT License.

- **Developer:** Tharidu Lakmal (LKML)
- **Website:** [https://tharidulakmal.com](https://tharidulakmal.com)
- **Source Repository:** [https://github.com/tharidul/site-radar](https://github.com/tharidul/site-radar)
