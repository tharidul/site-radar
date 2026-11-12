# SiteRadar MCP Server (Model Context Protocol)

The **SiteRadar MCP Server** exposes the SiteRadar audit engine as standardized MCP tools. It enables AI coding assistants and autonomous agents (such as Antigravity, Claude Desktop, Cursor, and Codex) to audit websites, inspect security headers, evaluate SEO/AEO, detect tech stacks, and run live WCAG 2.2 AA accessibility evaluations on demand.

---

## 🛠️ Available MCP Tools

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `siteradar_audit_headers` | `url` *(required)* | Fast audit of HTTP response headers, missing security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff), and server leaks. |
| `siteradar_audit_seo` | `url` *(required)*, `useBrowser` *(optional)* | Audits title, meta descriptions, canonical URLs, heading hierarchy, JSON-LD structured data, AEO question headings, and `llms.txt`. |
| `siteradar_detect_tech` | `url` *(required)*, `deep` *(optional)* | Fingerprints frontend frameworks (React, Next.js, Vue, Angular, Svelte), CSS libraries (Tailwind, Bootstrap), servers (Nginx, Apache), and CDNs (Cloudflare, Vercel). |
| `siteradar_audit_accessibility` | `url` *(required)*, `timeoutMs` *(optional)* | Launches headless Playwright to inject and execute **axe-core** in the live DOM. Reports WCAG 2.2 AA violations, color contrast, landmarks, image alt attributes, and remedy links. |
| `siteradar_full_audit` | `url` *(required)*, `mode` *('deep' \| 'fast')*, `timeoutMs` *(optional)* | Comprehensive 5-pillar technical audit (Security, Performance & Core Web Vitals, SEO, Accessibility, Best Practices) computing 0–100 scores and deduction breakdowns. |

---

## 🚀 Quick Start

Run the server directly via stdio:

```bash
pnpm mcp
# or
npx tsx src/mcp/index.ts
```

---

## ⚙️ Configuration

### 1. Antigravity / Gemini
The server is preconfigured in `.agents/mcp_config.json`:
```json
{
  "mcpServers": {
    "siteradar": {
      "command": "npx",
      "args": [
        "tsx",
        "/home/lkml/LKML/Extentions/website-intelligence/src/mcp/index.ts"
      ]
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "siteradar": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/site-radar/src/mcp/index.ts"
      ]
    }
  }
}
```

### 3. Cursor
Add to **Settings > Features > MCP**:
- **Name:** `siteradar`
- **Type:** `command`
- **Command:** `npx tsx /path/to/site-radar/src/mcp/index.ts`

---

## 🧪 Testing

Run the automated test suite:
```bash
pnpm vitest run tests/mcp-server.test.ts
```

