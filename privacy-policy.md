# Privacy Policy — Website Intelligence & Security Auditor

**Effective Date:** [PUBLISHER TO INSERT DATE]
**Last Updated:** 2026-11-06

---

## 1. Introduction

This Privacy Policy describes how **Website Intelligence & Security Auditor** (the "Extension") handles information during its operation. This policy is written to accurately reflect the Extension's actual implemented behavior as of the version described below.

We are committed to transparency: this policy does not describe aspirational practices — it describes what the code actually does.

---

## 2. Extension Description

Website Intelligence & Security Auditor is a browser extension that inspects the currently active website at the user's explicit request. It evaluates the site's security posture, performance characteristics, SEO metadata, accessibility compliance, and web development best practices. It generates evidence-based findings, severity-classified issue reports, category scores, and downloadable audit reports.

**Version covered by this policy:** 0.1.0

---

## 3. Information We Collect

### 3.1 Information We Do NOT Collect

The Extension does **not** collect:

- Your browsing history
- Cookies from any website
- Authentication credentials or passwords
- Form field values or user-submitted data
- Personally identifiable information about website visitors
- Financial information
- Local storage or session storage contents of inspected websites
- Analytics or telemetry about how you use the Extension
- Error logs transmitted to any server
- Any information from websites you visit that you do not explicitly inspect

### 3.2 Information Processed During Inspection

When you explicitly start an inspection of a website, the Extension accesses the following information **from the tab you are currently viewing**:

**Always accessed (local processing only):**
- The URL of the active tab you chose to inspect
- The page title
- HTML document structure and DOM elements (meta tags, headings, links, images, scripts, stylesheets, form elements)
- Structural metadata about forms (field types, autocomplete attributes, whether fields have values — **not the values themselves**)
- External resource URLs referenced by the page (scripts, stylesheets, images, iframes)
- HTTP response headers returned by the server when the Extension fetches the page

**Optionally accessed (only when you enable consent for specific providers):**
- The resolved IP address of the inspected domain (sent to ipapi.co for ASN/geolocation lookup)
- The hostname of the inspected domain (sent to a DNS-over-HTTPS provider for DNS record lookup)
- The domain name of the inspected site (sent to crt.sh for Certificate Transparency log query)

---

## 4. How Website Information Is Processed

### 4.1 Local Processing

The vast majority of inspection work happens entirely within your browser:

- **DOM analysis:** The content script reads the page's document structure inside your browser tab. This information never leaves your device during local analysis.
- **Security header analysis:** The Extension makes a background HTTP HEAD request to the target URL to retrieve response headers. This is a direct request from your browser to the target website — the same request your browser would make anyway. No third-party server is involved.
- **Accessibility testing:** Runs entirely in your browser. No page content is transmitted externally.
- **Performance, SEO, and best-practice analysis:** Run entirely in your browser using the collected DOM data.
- **Scoring:** Calculated locally from the analysis results.

### 4.2 Deep Crawl Mode

When you use "Deep" inspection mode, the Extension fetches additional pages from the **same domain** as the page you are inspecting (bounded to a maximum of 50 pages by default). These fetches are made directly from your browser to the target website. No intermediary server is involved. The crawled page content is used only to identify the site's link structure and is processed in memory.

The Extension identifies itself to the target server with the User-Agent string `WebsiteIntelligenceBot/1.0` during crawl fetches.

---

## 5. Information Transmitted to External Servers

The Extension transmits information to external servers **only** in the following circumstances, **all of which require your explicit consent** in the Extension's Settings page:

| External Service | Data Transmitted | Purpose | Their Privacy Policy |
|-----------------|-----------------|---------|---------------------|
| Cloudflare DNS-over-HTTPS (`cloudflare-dns.com`) | Hostname, DNS record type | Look up DNS records for the inspected domain | https://www.cloudflare.com/privacypolicy/ |
| ipapi.co | Public IP address of inspected server | Identify ASN, hosting provider, geographic region | https://ipapi.co/privacy/ |
| crt.sh (Sectigo) | Domain name of inspected site | Query public Certificate Transparency logs | https://crt.sh/ |

**Default state:** All external lookups are **disabled by default**. You must individually enable each provider in Settings > External Intelligence Consent.

**IP address privacy:** The Extension enforces a strict private-network guard. It will never transmit a private, loopback, or link-local IP address to any external service.

---

## 6. Local Storage

The Extension writes only the following minimal configuration to your browser's local storage:

| Key | Value | Purpose |
|-----|-------|---------|
| `theme` | `"dark"` or `"light"` | Remembers your preferred color theme |
| `crawlLimits` | `{ maxPages, maxDepth, concurrency, timeoutSeconds }` | Remembers your deep crawl configuration |

**Audit results, findings, scores, inspection reports, URLs, and website content are never written to storage.** They exist only in the Extension's service worker memory during your active session and are cleared when you click "Clear" or when the browser session ends.

---

## 7. Third-Party Services and Integrations

The Extension bundles the **axe-core** accessibility testing library (by Deque Systems). This library runs entirely within your browser and makes no network requests.

No analytics platforms, advertising networks, or tracking services are included or integrated.

---

## 8. Data Sharing Practices

We do **not**:
- Sell any information to third parties
- Share inspection results with any party
- Use inspection data for advertising purposes
- Use inspection data for user profiling
- Share data for any purpose unrelated to the Extension's audit function

The only information that leaves your device is the information transmitted to the optional external intelligence providers listed in Section 5, and only when you have explicitly enabled each provider.

---

## 9. Data Retention

| Information | Retention |
|-------------|-----------|
| Inspection results, findings, scores | Until you click "Clear" or close the popup; never persisted to storage |
| Active tab URL (during inspection) | In memory during inspection only |
| Session API keys (if entered) | In service worker memory only; cleared when SW restarts or you remove the key |
| Theme preference | In `chrome.storage.local` until you change it or uninstall |
| Crawl limit configuration | In `chrome.storage.local` until you change it or uninstall |
| Exported JSON / HTML reports | On your device only; controlled entirely by you |

---

## 10. Data Deletion

**To clear current inspection results:** Click the "Clear" button (trash icon) in the Extension popup header.

**To reset crawl configuration:** Click "Reset Defaults" in the Extension Settings page.

**To revoke all external intelligence consent:** Click "Revoke All" in Settings > External Intelligence Consent.

**To remove an API key:** Click the trash icon next to the provider name in Settings > Third-Party API Keys.

**To remove all Extension data:** Uninstall the Extension. This removes all `chrome.storage.local` data associated with the Extension.

---

## 11. Data Security

The Extension implements the following security measures:

- **Secret redaction:** Before any page data is processed or included in a report, the Extension automatically redacts known credential patterns (API keys, JWT tokens, AWS keys, GitHub tokens, Stripe keys, Bearer/Basic authentication headers, credit card numbers, passwords in URLs).
- **Private network guard:** The Extension will not make requests to private IP addresses, loopback addresses, or reserved network ranges.
- **DNS rebinding protection:** DNS responses that resolve to private IP addresses are blocked.
- **Scheme validation:** The Extension will not inspect `chrome://`, `about:`, `file://`, or other internal browser pages.
- **Consent gating:** External network lookups cannot be triggered without your explicit opt-in for each provider.

---

## 12. Permissions and Their Purposes

| Permission | Why It Is Required |
|------------|-------------------|
| `activeTab` | To identify the tab you are inspecting and to run inspection scripts in that tab when you click "Start Inspection." |
| `scripting` | To run inspection code in the tab's main JavaScript context, necessary for framework detection (React, Vue, Angular, etc.) from window-level globals. |
| `storage` | To remember your theme preference and crawl configuration between sessions. |
| `optional_host_permissions: *://*/*` | Requested only when needed. Enables fetching HTTP response headers from the target website and crawling additional pages in deep inspection mode. |

The content script is registered to run on all URLs so it can respond when you audit any website you choose. The script is **passive** — it performs no actions until you explicitly start an inspection from the popup.

---

## 13. User Rights and Privacy Choices

You have full control over all data the Extension handles:
- **Inspect selectively:** The Extension only inspects the site you explicitly choose.
- **Disable external lookups:** Each external intelligence provider can be individually disabled in Settings at any time.
- **Clear results instantly:** Click "Clear" at any time to remove all inspection data from memory.
- **Control exports:** Exported reports go to your device only.
- **Uninstall completely:** Removes all stored configuration data.

---

## 14. Children's Privacy

The Extension is intended for web developers and security professionals. It is not directed at children under 13 and does not knowingly collect information from children.

---

## 15. Limited Use Compliance

The Extension's access to and use of information obtained through inspecting websites is limited to providing the website audit features visible to the user. The Extension does not use website content for unrelated purposes, does not transfer data to third parties except as described in Section 5 (optional, consent-gated), does not use data for creditworthiness determination, and does not sell user data.

This complies with the Chrome Web Store User Data Policy Limited Use requirements.

---

## 16. Changes to This Privacy Policy

If the Extension's data handling practices change materially, this policy will be updated. The "Last Updated" date at the top reflects the most recent change.

---

## 17. Contact Information

For privacy questions or concerns:

**Publisher:** [PUBLISHER NAME — REQUIRED BEFORE PUBLISHING]
**Contact Email:** [PUBLISHER EMAIL — REQUIRED BEFORE PUBLISHING]
**Support:** [SUPPORT URL OR EMAIL — REQUIRED BEFORE PUBLISHING]

---

## 18. Effective Date

This Privacy Policy is effective as of [PUBLISHER TO INSERT DATE].

---

*This policy reflects the actual implemented behavior of Website Intelligence & Security Auditor version 0.1.0 as audited on 2026-11-06.*

