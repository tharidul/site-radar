# SiteRadar: 10-Website Real-World Audit Benchmark

**Execution Date:** 2026-11-17T08:51:11.950Z
**Audit Engine:** SiteRadar v0.2.0 with Corroboration Engine (Blast-Radius & Reality Model)
**Audit Mode:** DEEP (Playwright Headless Browser + axe-core + CWV)
**Total Benchmark Runtime:** 54.8 seconds

## 1. Executive Summary Table

| Website | Archetype | Overall Score | Security | Perf | SEO | A11y | Best Pract | Tech Detected | Time |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| **Hacker News** | Lightweight Community Forum | **🟡 86** | 100 | 100 | 85 | 39 | 94 | N/A | 4.4s |
| **Wikipedia** | Massive Content / Open Encyclopedia | **🟢 96** | 100 | 95 | 93 | 99 | 100 | N/A | 6.7s |
| **GitHub** | Developer Platform & Cloud SaaS | **🟢 98** | 100 | 95 | 100 | 100 | 100 | React | 5.9s |
| **Stripe** | Fintech & Payment Infrastructure | **🟢 98** | 100 | 95 | 100 | 96 | 100 | React, Next.js | 8.3s |
| **Vercel** | Next.js Edge Jamstack Showcase | **🟢 93** | 100 | 93 | 100 | 67 | 100 | React, Next.js, Tailwind CSS | 4.3s |
| **MDN Web Docs** | Technical Documentation & Standards | **🟢 96** | 100 | 100 | 100 | 75 | 100 | N/A | 3.4s |
| **BBC News** | Global Editorial News & Media | **🟢 90** | 89 | 88 | 94 | 87 | 100 | React, Next.js | 6.4s |
| **Python.org** | Open Source Community Portal | **🟢 91** | 87 | 93 | 100 | 81 | 100 | jQuery | 3.2s |
| **AliExpress** | Enterprise E-Commerce Storefront | **🟡 74** | 71 | 82 | 92 | 22 | 94 | N/A | 4.4s |
| **Cloudflare** | Web Security & Edge Infrastructure | **🟢 94** | 100 | 88 | 100 | 89 | 97 | Astro, Tailwind CSS, Cloudflare | 7.8s |

## 2. Corroboration Reality State Analysis

The Corroboration Engine categorizes candidate findings into 4 reality states, eliminating false positives caused by enterprise trust boundaries and synthetic simulation noise.

| Website | True Defects | Architectural Patterns | Observability Limits | Synthetic Noise | Total Evaluated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Hacker News** | 45 | 1 | 1 | 1 | 48 |
| **Wikipedia** | 36 | 4 | 1 | 1 | 42 |
| **GitHub** | 39 | 2 | 1 | 1 | 43 |
| **Stripe** | 42 | 2 | 1 | 1 | 46 |
| **Vercel** | 43 | 0 | 1 | 1 | 45 |
| **MDN Web Docs** | 42 | 0 | 1 | 1 | 44 |
| **BBC News** | 42 | 2 | 2 | 1 | 47 |
| **Python.org** | 45 | 3 | 1 | 1 | 50 |
| **AliExpress** | 42 | 3 | 1 | 1 | 47 |
| **Cloudflare** | 41 | 2 | 2 | 1 | 46 |

## 3. Deep-Dive Per-Site Findings

### Hacker News (https://news.ycombinator.com)

- **Archetype:** Lightweight Community Forum
- **Overall Score:** **86/100**
- **Scores:** Security: 100 | Perf: 100 | SEO: 85 | A11y: 39 | Best Practices: 94
- **Technologies Detected:** None identified
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Form elements must have labels (*critical*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Images must have alternative text (*critical*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Elements must meet minimum color contrast ratio thresholds (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Links must have discernible text (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Image Accessible Name Alternatives (*high*) [TRUE_DEFECT]

### Wikipedia (https://en.wikipedia.org/wiki/Main_Page)

- **Archetype:** Massive Content / Open Encyclopedia
- **Overall Score:** **96/100**
- **Scores:** Security: 100 | Perf: 95 | SEO: 93 | A11y: 99 | Best Practices: 100
- **Technologies Detected:** None identified
- **Top Priority Findings:**
  - **[AEO]** Agentic Form Labels & Autocomplete (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: ARIA role should be appropriate for the element (*low*) [TRUE_DEFECT]
  - **[PERFORMANCE]** DOM Tree Complexity and Size (*low*) [TRUE_DEFECT]
  - **[SEO]** Meta Description Present (*low*) [TRUE_DEFECT]
  - **[AEO]** Agent Context Window DOM Complexity (*low*) [TRUE_DEFECT]

### GitHub (https://github.com)

- **Archetype:** Developer Platform & Cloud SaaS
- **Overall Score:** **98/100**
- **Scores:** Security: 100 | Perf: 95 | SEO: 100 | A11y: 100 | Best Practices: 100
- **Technologies Detected:** React
- **Top Priority Findings:**
  - **[AEO]** Agentic Form Labels & Autocomplete (*medium*) [TRUE_DEFECT]
  - **[PERFORMANCE]** DOM Tree Complexity and Size (*low*) [TRUE_DEFECT]
  - **[AEO]** Agent Context Window DOM Complexity (*low*) [TRUE_DEFECT]

### Stripe (https://stripe.com)

- **Archetype:** Fintech & Payment Infrastructure
- **Overall Score:** **98/100**
- **Scores:** Security: 100 | Perf: 95 | SEO: 100 | A11y: 96 | Best Practices: 100
- **Technologies Detected:** React, Next.js
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Elements must have their visible text as part of their accessible name (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Elements must meet minimum color contrast ratio thresholds (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Headings should not be empty (*low*) [TRUE_DEFECT]
  - **[PERFORMANCE]** DOM Tree Complexity and Size (*low*) [TRUE_DEFECT]
  - **[AEO]** Agent Context Window DOM Complexity (*low*) [TRUE_DEFECT]

### Vercel (https://vercel.com)

- **Archetype:** Next.js Edge Jamstack Showcase
- **Overall Score:** **93/100**
- **Scores:** Security: 100 | Perf: 93 | SEO: 100 | A11y: 67 | Best Practices: 100
- **Technologies Detected:** React, Next.js, Tailwind CSS
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Links must have discernible text (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Viewport Disables User Zooming (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Zooming and scaling must not be disabled (*medium*) [TRUE_DEFECT]
  - **[PERFORMANCE]** Render-Blocking Scripts Detected (*medium*) [TRUE_DEFECT]

### MDN Web Docs (https://developer.mozilla.org/en-US/)

- **Archetype:** Technical Documentation & Standards
- **Overall Score:** **96/100**
- **Scores:** Security: 100 | Perf: 100 | SEO: 100 | A11y: 75 | Best Practices: 100
- **Technologies Detected:** None identified
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: All page content should be contained by landmarks (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Document should have one main landmark (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Landmarks should have a unique role or role/label/title (i.e. accessible name) combination (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Semantic Landmark Regions (*low*) [TRUE_DEFECT]

### BBC News (https://www.bbc.com)

- **Archetype:** Global Editorial News & Media
- **Overall Score:** **90/100**
- **Scores:** Security: 89 | Perf: 88 | SEO: 94 | A11y: 87 | Best Practices: 100
- **Technologies Detected:** React, Next.js
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Elements must have their visible text as part of their accessible name (*high*) [TRUE_DEFECT]
  - **[SECURITY]** Missing Content Security Policy (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Landmarks should have a unique role or role/label/title (i.e. accessible name) combination (*medium*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Page should contain a level-one heading (*medium*) [TRUE_DEFECT]
  - **[PERFORMANCE]** Render-Blocking Scripts Detected (*medium*) [TRUE_DEFECT]

### Python.org (https://www.python.org)

- **Archetype:** Open Source Community Portal
- **Overall Score:** **91/100**
- **Scores:** Security: 87 | Perf: 93 | SEO: 100 | A11y: 81 | Best Practices: 100
- **Technologies Detected:** jQuery
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Certain ARIA roles must be contained by particular parents (*critical*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Certain ARIA roles must contain particular children (*critical*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: <li> elements must be contained in a <ul> or <ol> (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: <ul> and <ol> must only directly contain <li>, <script> or <template> elements (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Elements must meet minimum color contrast ratio thresholds (*high*) [TRUE_DEFECT]

### AliExpress (https://www.aliexpress.com)

- **Archetype:** Enterprise E-Commerce Storefront
- **Overall Score:** **74/100**
- **Scores:** Security: 71 | Perf: 82 | SEO: 92 | A11y: 22 | Best Practices: 94
- **Technologies Detected:** None identified
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Images must have alternative text (*critical*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: <html> element must have a lang attribute (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** axe: Elements must meet minimum color contrast ratio thresholds (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Image Accessible Name Alternatives (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Viewport Disables User Zooming (*high*) [TRUE_DEFECT]

### Cloudflare (https://www.cloudflare.com)

- **Archetype:** Web Security & Edge Infrastructure
- **Overall Score:** **94/100**
- **Scores:** Security: 100 | Perf: 88 | SEO: 100 | A11y: 89 | Best Practices: 97
- **Technologies Detected:** Astro (6.3.7), Tailwind CSS, Cloudflare
- **Top Priority Findings:**
  - **[ACCESSIBILITY]** axe: Elements must meet minimum color contrast ratio thresholds (*high*) [TRUE_DEFECT]
  - **[ACCESSIBILITY]** Image Accessible Name Alternatives (*high*) [TRUE_DEFECT]
  - **[PERFORMANCE]** Render-Blocking Scripts Detected (*medium*) [TRUE_DEFECT]
  - **[PERFORMANCE]** DOM Tree Complexity and Size (*low*) [TRUE_DEFECT]
  - **[BEST-PRACTICES]** Software Version Disclosed in Meta Generator (*low*) [TRUE_DEFECT]

