import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  Check,
  ExternalLink,
  RotateCcw,
  Sun,
  Moon,
  Copy,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Radio,
  Sliders,
} from 'lucide-react';
import { MESSAGE_CHANNELS } from '@/types/messaging';
import { messageBus } from '@/messaging/bus';
import { getBrowserAdapter } from '@/browser/adapters';
import type { IntelligenceProviderType } from '@/types/intelligence';
import { loadSavedTheme, saveTheme, applyThemeToDom, type AppTheme } from '@/utils/theme';
import siteRadarLogo from '../../assets/icons/icon128.png';

export type SettingsTab = 'overview' | 'mcp' | 'intelligence' | 'crawler';

interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  timeoutSeconds: number;
}

const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 50,
  maxDepth: 3,
  concurrency: 2,
  timeoutSeconds: 15,
};

interface ProviderItem {
  id: IntelligenceProviderType;
  name: string;
  summary: string;
  endpoint: string;
}

const PROVIDER_LIST: ProviderItem[] = [
  {
    id: 'doh',
    name: 'DNS-over-HTTPS (DoH)',
    summary: 'Resolves DNS A, AAAA, MX, and TXT records via Cloudflare (1.1.1.1) to verify DNSSEC and CNAME chains.',
    endpoint: 'https://cloudflare-dns.com/dns-query',
  },
  {
    id: 'ip-asn',
    name: 'IP & ASN Intelligence',
    summary: 'Identifies hosting provider, data center, Autonomous System Number (ASN), and network routing via ipapi.co.',
    endpoint: 'https://ipapi.co/',
  },
  {
    id: 'crt-sh',
    name: 'Certificate Transparency (crt.sh)',
    summary: 'Audits historical SSL/TLS certificates and known subdomains logged to public CT transparency logs.',
    endpoint: 'https://crt.sh/',
  },
  {
    id: 'tls',
    name: 'TLS Security Inspector',
    summary: 'Inspects active TLS protocol version, cipher suite strength, and certificate validity directly.',
    endpoint: 'Direct host connection',
  },
];

const getTabFromHash = (): SettingsTab => {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.toLowerCase().replace(/^#/, '');
  if (hash === 'mcp' || hash === 'welcome') return 'mcp';
  if (hash === 'intelligence') return 'intelligence';
  if (hash === 'crawler') return 'crawler';
  if (hash === 'overview') return 'overview';
  return 'overview';
};

export function OptionsApp() {
  const [activeTab, setActiveTab] = useState<SettingsTab>(getTabFromHash);
  const [globalConsent, setGlobalConsent] = useState(false);
  const [providerConsents, setProviderConsents] = useState<Record<string, boolean>>({
    doh: false,
    'ip-asn': false,
    'crt-sh': false,
    tls: false,
  });

  const [crawlConfig, setCrawlConfig] = useState<CrawlConfig>(DEFAULT_CRAWL_CONFIG);
  const [crawlFeedback, setCrawlFeedback] = useState<string | null>(null);
  const [expandedDisclosureProviderId, setExpandedDisclosureProviderId] = useState<string | null>(null);

  const [theme, setTheme] = useState<AppTheme>('dark');
  const [activeMcpTab, setActiveMcpTab] = useState<'claude' | 'cursor' | 'cli'>('claude');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const adapter = getBrowserAdapter();
        const [savedTheme, consentResults, stored] = await Promise.all([
          loadSavedTheme().catch(() => 'dark' as AppTheme),
          Promise.all(
            PROVIDER_LIST.map(async (p) => {
              try {
                const res = await messageBus.sendToBackground(
                  MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT,
                  { provider: p.id },
                );
                return [p.id, Boolean(res.granted)] as const;
              } catch {
                return [p.id, false] as const;
              }
            }),
          ),
          adapter.getStorage<CrawlConfig>(['crawlLimits']).catch(() => null),
        ]);

        if (mounted) {
          if (savedTheme) {
            setTheme(savedTheme);
            applyThemeToDom(savedTheme);
          }
          const consents: Record<string, boolean> = Object.fromEntries(consentResults);
          setProviderConsents(consents);
          setGlobalConsent(Object.values(consents).some(Boolean));

          if (stored?.crawlLimits) {
            setCrawlConfig(stored.crawlLimits);
          }
        }
      } catch (err) {
        console.warn('Error loading settings:', err);
      }
    }

    loadSettings();

    const handleHashChange = () => {
      const next = getTabFromHash();
      setActiveTab(next);
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      mounted = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#${tab}`);
    }
    const mainEl = document.querySelector('.main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  };

  const handleToggleProviderConsent = async (provider: IntelligenceProviderType) => {
    const nextGranted = !providerConsents[provider];
    setProviderConsents((prev) => ({ ...prev, [provider]: nextGranted }));

    try {
      await messageBus.sendToBackground(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, {
        provider,
        granted: nextGranted,
      });

      const anyGranted = nextGranted || Object.entries(providerConsents).some(([k, v]) => k !== provider && v);
      setGlobalConsent(anyGranted);
    } catch (err) {
      console.warn('Failed to update consent:', err);
    }
  };

  const handleToggleAllConsent = async (enable: boolean) => {
    setGlobalConsent(enable);
    const updated: Record<string, boolean> = {};
    for (const p of PROVIDER_LIST) {
      updated[p.id] = enable;
    }
    setProviderConsents(updated);

    for (const p of PROVIDER_LIST) {
      try {
        await messageBus.sendToBackground(MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT, {
          provider: p.id,
          granted: enable,
        });
      } catch {}
    }
  };

  const handleRevokeAllConsent = async () => {
    await handleToggleAllConsent(false);
  };

  const handleUpdateCrawlLimit = (field: keyof CrawlConfig, value: number) => {
    setCrawlConfig((prev) => {
      let clamped = value;
      if (field === 'maxPages') clamped = Math.max(5, Math.min(200, value || 5));
      if (field === 'maxDepth') clamped = Math.max(1, Math.min(5, value || 1));
      if (field === 'concurrency') clamped = Math.max(1, Math.min(4, value || 1));
      if (field === 'timeoutSeconds') clamped = Math.max(5, Math.min(60, value || 5));
      return { ...prev, [field]: clamped };
    });
  };

  const handleSaveCrawlLimits = async () => {
    try {
      const adapter = getBrowserAdapter();
      await adapter.setStorage({ crawlLimits: crawlConfig });
      setCrawlFeedback('Crawl boundaries saved');
    } catch {
      setCrawlFeedback('Failed to save crawl limits');
    }
    setTimeout(() => setCrawlFeedback(null), 2500);
  };

  const handleResetCrawlLimits = () => {
    setCrawlConfig(DEFAULT_CRAWL_CONFIG);
    setCrawlFeedback('Reset to default boundaries');
    setTimeout(() => setCrawlFeedback(null), 2500);
  };

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyThemeToDom(nextTheme);
    saveTheme(nextTheme);
  };

  const handleCopySnippet = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {}
  };

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        siteradar: {
          command: 'npx',
          args: ['tsx', 'src/mcp/index.ts'],
        },
      },
    },
    null,
    2,
  );

  return (
    <div data-theme={theme} className={`options-page ${theme}`}>
      <div className="layout-wrapper">
        {/* Static Desktop Sidebar (Permanent, Immovable) */}
        <aside className="sidebar" aria-label="Settings Navigation Sidebar">
          <div className="sidebar-brand">
            <img
              src={siteRadarLogo}
              alt="SiteRadar Logo"
              className="brand-logo-img"
            />
            <div>
              <div className="brand-title">SiteRadar</div>
              <div className="brand-sub">Settings &amp; Documentation</div>
            </div>
          </div>

          <div className="sidebar-meta">
            <div><span>Version</span> <strong>0.2.0</strong></div>
            <div><span>Architecture</span> <strong>Local-First MV3</strong></div>
            <div><span>Protocol</span> <strong>MCP 2025-03</strong></div>
            <div><span>License</span> <strong>MIT</strong></div>
          </div>

          <div className="nav-heading">Navigation</div>
          <nav className="sidebar-nav" aria-label="Main Sections">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <span>Overview &amp; Usage</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('mcp')}
              className={`nav-link ${activeTab === 'mcp' ? 'active' : ''}`}
            >
              <span>AI &amp; MCP Integration</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('intelligence')}
              className={`nav-link ${activeTab === 'intelligence' ? 'active' : ''}`}
            >
              <span>External Intelligence</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('crawler')}
              className={`nav-link ${activeTab === 'crawler' ? 'active' : ''}`}
            >
              <span>Crawler Boundaries</span>
            </button>
            <a
              href="privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
            >
              <span>Privacy Policy</span>
              <ExternalLink style={{ width: '12px', height: '12px', opacity: 0.6 }} />
            </a>
          </nav>

          <div className="sidebar-footer">
            <a href="https://github.com/tharidul/site-radar" target="_blank" rel="noopener noreferrer">
              GitHub Repository &rarr;
            </a>
            <a href="https://tharidulakmal.com" target="_blank" rel="noopener noreferrer">
              Developer Website &rarr;
            </a>
          </div>
        </aside>

        {/* Dynamic Main Content Pane (Switches per activeTab) */}
        <main className="main-content" aria-label="Settings Content Area">
          {/* Mobile Top Bar (< 1024px) */}
          <div className="mobile-header mobile-only">
            <div className="mobile-brand">
              <img
                src={siteRadarLogo}
                alt="SiteRadar Logo"
                className="brand-logo-img"
              />
              <div>
                <div className="brand-title">SiteRadar</div>
                <div className="brand-sub">Settings &amp; Documentation</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              className="btn-secondary"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon style={{ width: '14px', height: '14px' }} />
              ) : (
                <Sun style={{ width: '14px', height: '14px' }} />
              )}
            </button>
          </div>

          {/* Mobile Navigation Bar (< 1024px) */}
          <nav className="mobile-nav mobile-only" aria-label="Mobile Navigation Tabs">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className={`mobile-tab ${activeTab === 'overview' ? 'active' : ''}`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('mcp')}
              className={`mobile-tab ${activeTab === 'mcp' ? 'active' : ''}`}
            >
              AI &amp; MCP
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('intelligence')}
              className={`mobile-tab ${activeTab === 'intelligence' ? 'active' : ''}`}
            >
              Intelligence
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('crawler')}
              className={`mobile-tab ${activeTab === 'crawler' ? 'active' : ''}`}
            >
              Crawler
            </button>
            <a
              href="privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-tab"
            >
              Privacy &rarr;
            </a>
          </nav>

          {/* Desktop Content Header (>= 1024px) */}
          <header className="content-header desktop-only">
            <div className="header-titles">
              {activeTab === 'overview' && (
                <>
                  <h1 className="page-title">Overview &amp; Usage</h1>
                  <p className="page-subtitle">
                    Local-first browser diagnostics, multi-pillar auditing engine, and execution workflows.
                  </p>
                </>
              )}
              {activeTab === 'mcp' && (
                <>
                  <h1 className="page-title">AI Assistant &amp; MCP Integration</h1>
                  <p className="page-subtitle">
                    Connect SiteRadar to Claude Desktop, Cursor, and autonomous AI pair programmers via the Model Context Protocol.
                  </p>
                </>
              )}
              {activeTab === 'intelligence' && (
                <>
                  <h1 className="page-title">External Intelligence &amp; Network Lookups</h1>
                  <p className="page-subtitle">
                    Granular consent controls for DNS-over-HTTPS, IP routing, ASN geolocation, and Certificate Transparency lookups.
                  </p>
                </>
              )}
              {activeTab === 'crawler' && (
                <>
                  <h1 className="page-title">Deep Crawler Boundaries</h1>
                  <p className="page-subtitle">
                    Safety limits and rate-limiting boundaries for origin-confined multi-page crawl audits.
                  </p>
                </>
              )}
              <div className="meta-bar">
                <span><strong>Version:</strong> 0.2.0</span>
                <span><strong>Mode:</strong> Local-first</span>
                <span><strong>Engine:</strong> TypeScript + WXT</span>
                <span><strong>Protocol:</strong> MCP 2025-03</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              className="btn-secondary"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <>
                  <Moon style={{ width: '14px', height: '14px' }} />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun style={{ width: '14px', height: '14px' }} />
                  <span>Light</span>
                </>
              )}
            </button>
          </header>

          {/* Tab 1: Overview & Usage */}
          {activeTab === 'overview' && (
            <div className="tab-pane">
              {/* Highlights Grid */}
              <div className="highlights-grid">
                <div className="highlight-card">
                  <div className="highlight-title">Local-First Execution</div>
                  <div className="highlight-desc">
                    All audits execute strictly within your browser context. No browsing history, cookies, or payloads leave your machine.
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-title">5-Pillar Diagnostics</div>
                  <div className="highlight-desc">
                    Automated evaluation across Security, Core Web Vitals, SEO/AEO, WCAG 2.2 AA accessibility, and Best Practices.
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-title">Model Context Protocol</div>
                  <div className="highlight-desc">
                    Native MCP server connects SiteRadar directly to Claude Desktop, Cursor, and Antigravity AI agents.
                  </div>
                </div>
              </div>

              <section>
                <h2 className="section-heading">Execution Modes</h2>
                <p className="section-desc">
                  SiteRadar is a cross-browser technical and security auditor built for engineers, security analysts, and AI coding agents. It operates in three execution modes depending on your workflow:
                </p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Interface</th>
                        <th>Activation</th>
                        <th>Primary Use Case</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Toolbar Pop-up</strong></td>
                        <td>Click extension icon in browser toolbar</td>
                        <td>Instant single-tab inspection with score breakdown, headers, and quick fixes.</td>
                      </tr>
                      <tr>
                        <td><strong>Side Panel Mode</strong></td>
                        <td>Right-click any page &gt; <em>Open SiteRadar in Side Panel</em></td>
                        <td>Persistent side-by-side inspection while navigating or debugging multi-page workflows.</td>
                      </tr>
                      <tr>
                        <td><strong>AI / MCP Server</strong></td>
                        <td><code>pnpm mcp</code> or <code>claude_desktop_config.json</code></td>
                        <td>Direct agent invocation from Claude Desktop, Cursor, and autonomous AI pair programmers.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={{ marginTop: '28px' }}>
                <h2 className="section-heading">5-Pillar Diagnostic Engine</h2>
                <p className="section-desc">
                  Every audit evaluates your web properties against modern web performance, security, and accessibility standards:
                </p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pillar</th>
                        <th>Core Metrics Audited</th>
                        <th>Benchmark Standard</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Security &amp; Headers</strong></td>
                        <td>HSTS, CSP, X-Frame-Options, Referrer-Policy, nosniff, sensitive tokens</td>
                        <td>OWASP Secure Headers &amp; TLS best practices</td>
                      </tr>
                      <tr>
                        <td><strong>Core Web Vitals</strong></td>
                        <td>LCP, CLS, TTFB, DOM Interactive, network transfer sizes</td>
                        <td>Google Core Web Vitals (CWV) thresholds</td>
                      </tr>
                      <tr>
                        <td><strong>Accessibility</strong></td>
                        <td>Contrast ratios, ARIA attributes, semantic structure, image alt text</td>
                        <td>W3C WCAG 2.2 Level AA standard via axe-core</td>
                      </tr>
                      <tr>
                        <td><strong>SEO &amp; AEO</strong></td>
                        <td>Meta tags, Open Graph, Twitter cards, semantic hierarchy, JSON-LD, llms.txt</td>
                        <td>Search Engine &amp; AI Engine Optimization guidelines</td>
                      </tr>
                      <tr>
                        <td><strong>Technology &amp; Standards</strong></td>
                        <td>Framework fingerprinting, modern web APIs, console log anomaly capture</td>
                        <td>W3C Web Platform &amp; Chromium engine standards</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="callout" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <strong>Looking to automate SiteRadar with AI?</strong>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Connect Claude Desktop, Cursor, or CLI tools directly to our local Model Context Protocol (MCP) server.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('mcp')}
                  className="btn-primary"
                  style={{ flexShrink: 0 }}
                >
                  <span>Configure MCP</span>
                  <ArrowRight style={{ width: '13px', height: '13px' }} />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: AI & MCP Integration */}
          {activeTab === 'mcp' && (
            <div className="tab-pane">
              <section>
                <h2 className="section-heading">Model Context Protocol Server</h2>
                <p className="section-desc">
                  SiteRadar exposes its audit engine through the open <strong>Model Context Protocol (MCP)</strong>. This allows local AI assistants to inspect live web pages, audit security headers, analyze SEO, and evaluate WCAG accessibility directly from chat.
                </p>

                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveMcpTab('claude')}
                    className={`btn-tab ${activeMcpTab === 'claude' ? 'active' : ''}`}
                  >
                    Claude Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMcpTab('cursor')}
                    className={`btn-tab ${activeMcpTab === 'cursor' ? 'active' : ''}`}
                  >
                    Cursor IDE
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMcpTab('cli')}
                    className={`btn-tab ${activeMcpTab === 'cli' ? 'active' : ''}`}
                  >
                    Terminal / CLI
                  </button>
                </div>

                {activeMcpTab === 'claude' && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Add this entry to your <code>claude_desktop_config.json</code> configuration file:
                    </p>
                    <div style={{ position: 'relative' }}>
                      <pre className="code-block">{claudeConfigJson}</pre>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(claudeConfigJson, 'claude')}
                        className="btn-secondary"
                        style={{ position: 'absolute', top: '10px', right: '10px' }}
                      >
                        {copiedSnippet === 'claude' ? (
                          <>
                            <Check style={{ width: '13px', height: '13px', color: 'var(--accent-text)' }} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy style={{ width: '13px', height: '13px' }} />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeMcpTab === 'cursor' && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Configure in <strong>Cursor &gt; Settings &gt; Features &gt; MCP &gt; Add New Server</strong>:
                    </p>
                    <div className="callout" style={{ margin: '8px 0 12px' }}>
                      <div style={{ marginBottom: '4px' }}><strong>Server Name:</strong> <code>siteradar</code></div>
                      <div style={{ marginBottom: '4px' }}><strong>Server Type:</strong> <code>command</code></div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div><strong>Command:</strong> <code>npx tsx src/mcp/index.ts</code></div>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('npx tsx src/mcp/index.ts', 'cursor')}
                          className="btn-secondary"
                        >
                          {copiedSnippet === 'cursor' ? (
                            <>
                              <Check style={{ width: '13px', height: '13px', color: 'var(--accent-text)' }} />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy style={{ width: '13px', height: '13px' }} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeMcpTab === 'cli' && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Run the MCP server directly over standard input/output (stdio):
                    </p>
                    <div style={{ position: 'relative' }}>
                      <pre className="code-block">pnpm mcp&#10;# or: npx tsx src/mcp/index.ts</pre>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet('pnpm mcp', 'cli')}
                        className="btn-secondary"
                        style={{ position: 'absolute', top: '10px', right: '10px' }}
                      >
                        {copiedSnippet === 'cli' ? (
                          <>
                            <Check style={{ width: '13px', height: '13px', color: 'var(--accent-text)' }} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy style={{ width: '13px', height: '13px' }} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section style={{ marginTop: '28px' }}>
                <h3 className="sub-heading">Exposed MCP Tools</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tool Identifier</th>
                        <th>Runtime Mode</th>
                        <th>Capabilities</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>siteradar_full_audit</code></td>
                        <td>Hybrid (Fast / Deep)</td>
                        <td>Complete 5-pillar technical audit with 0–100 scoring model, Core Web Vitals, and prioritized deductions.</td>
                      </tr>
                      <tr>
                        <td><code>siteradar_audit_headers</code></td>
                        <td>Fast (~150ms)</td>
                        <td>Audits HSTS, CSP, X-Frame-Options, Referrer-Policy, nosniff, Permissions-Policy, and server banner leaks.</td>
                      </tr>
                      <tr>
                        <td><code>siteradar_audit_seo</code></td>
                        <td>Fast / Deep</td>
                        <td>Evaluates title, meta descriptions, canonical match, heading hierarchy, JSON-LD schemas, and <code>llms.txt</code>.</td>
                      </tr>
                      <tr>
                        <td><code>siteradar_detect_tech</code></td>
                        <td>Fast / Deep</td>
                        <td>Fingerprints React, Next.js, Vue, Tailwind, Nginx, Cloudflare, Vercel, and backend platform signatures.</td>
                      </tr>
                      <tr>
                        <td><code>siteradar_audit_accessibility</code></td>
                        <td>Deep (Playwright)</td>
                        <td>In-page axe-core execution reporting WCAG 2.2 AA violations, contrast failures, and remediation links.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="callout" style={{ marginTop: '20px' }}>
                <strong>Headless Browser &amp; Privacy Isolation:</strong> When deep audits or accessibility testing are requested, the MCP server launches Playwright Chromium in headless mode (<code>--no-sandbox</code>) with automated <code>axe-core</code> injection. This runs in a clean, ephemeral profile with zero access to your personal Chrome browser, history, or cookies. For complete data governance details, see our <a href="privacy-policy.html#mcp-governance" target="_blank" rel="noopener noreferrer">Privacy Policy (Section 5: AI &amp; MCP Auditing)</a>.
              </div>
            </div>
          )}

          {/* Tab 3: External Intelligence Opt-In */}
          {activeTab === 'intelligence' && (
            <div className="tab-pane">
              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                  <h2 className="section-heading" style={{ margin: 0, border: 'none' }}>
                    Network Lookups &amp; Consent
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleToggleAllConsent(!globalConsent)}
                    className="btn-secondary"
                    style={{ fontSize: 'var(--font-size-xs)' }}
                  >
                    {globalConsent ? 'Disable All' : 'Enable All'}
                  </button>
                </div>

                <p className="section-desc">
                  SiteRadar runs 100% locally by default. You can selectively enable trusted third-party lookups to enrich audits with infrastructure DNS records, ASN routing, and historical SSL certificate logs.
                </p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Endpoint</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROVIDER_LIST.map((provider) => {
                        const isGranted = Boolean(providerConsents[provider.id]);
                        const isExpanded = expandedDisclosureProviderId === provider.id;

                        return (
                          <React.Fragment key={provider.id}>
                            <tr>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{provider.name}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {provider.summary}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDisclosureProviderId(isExpanded ? null : provider.id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    fontSize: 'var(--font-size-2xs)',
                                    padding: 0,
                                    marginTop: '4px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {isExpanded ? 'Hide Details' : 'View Network Disclosure'}
                                </button>
                              </td>
                              <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'Roboto, monospace', color: 'var(--text-dim)' }}>
                                {provider.endpoint}
                              </td>
                              <td style={{ verticalAlign: 'middle' }}>
                                <label className="toggle-switch" aria-label={`Toggle consent for ${provider.name}`}>
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    onChange={() => handleToggleProviderConsent(provider.id)}
                                  />
                                  <span className="toggle-slider" />
                                </label>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={3} style={{ background: 'var(--surface-hover)', padding: '12px 16px', fontSize: 'var(--font-size-xs)' }}>
                                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                    <strong>Technical Transparency:</strong> When enabled, SiteRadar transmits only the target hostname to <code>{provider.endpoint}</code> to retrieve public DNS, routing, or CT logs. No personal data, session tokens, or browser cookies are included.
                                  </p>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {Object.values(providerConsents).some(Boolean) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={handleRevokeAllConsent}
                      className="btn-secondary"
                      style={{ color: '#f87171' }}
                    >
                      <RotateCcw style={{ width: '13px', height: '13px' }} />
                      <span>Revoke All External Permissions</span>
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 4: Deep Crawler Boundaries */}
          {activeTab === 'crawler' && (
            <div className="tab-pane">
              <section>
                <h2 className="section-heading">Multi-Page Crawler Boundaries</h2>
                <p className="section-desc">
                  Define the safety boundaries for multi-page crawl audits. SiteRadar strictly respects robots.txt, stays on the target origin, and rate-limits crawling to avoid impacting server workloads.
                </p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Safety Range</th>
                        <th>Active Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Maximum Pages</strong>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>Upper bound of pages crawled per domain.</div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>5 – 200 pages</td>
                        <td>
                          <input
                            type="number"
                            min={5}
                            max={200}
                            value={crawlConfig.maxPages}
                            onChange={(e) => handleUpdateCrawlLimit('maxPages', parseInt(e.target.value, 10))}
                            className="num-input"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Maximum Crawl Depth</strong>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>Maximum link depth from seed origin.</div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>1 – 5 levels</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={crawlConfig.maxDepth}
                            onChange={(e) => handleUpdateCrawlLimit('maxDepth', parseInt(e.target.value, 10))}
                            className="num-input"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max Concurrency</strong>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>Concurrent background fetch connections.</div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>1 – 4 workers</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={4}
                            value={crawlConfig.concurrency}
                            onChange={(e) => handleUpdateCrawlLimit('concurrency', parseInt(e.target.value, 10))}
                            className="num-input"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Page Timeout</strong>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>Seconds before aborting unresponsive requests.</div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>5 – 60 seconds</td>
                        <td>
                          <input
                            type="number"
                            min={5}
                            max={60}
                            value={crawlConfig.timeoutSeconds}
                            onChange={(e) => handleUpdateCrawlLimit('timeoutSeconds', parseInt(e.target.value, 10))}
                            className="num-input"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-text)' }}>
                    {crawlFeedback && <span>{crawlFeedback}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={handleResetCrawlLimits} className="btn-secondary">
                      Reset Defaults
                    </button>
                    <button type="button" onClick={handleSaveCrawlLimits} className="btn-primary">
                      Save Boundaries
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Clean Footer */}
          <footer>
            <div>SiteRadar &copy; 2026 Tharidu Lakmal (LKML). Released under the MIT License.</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <a href="privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <a href="https://github.com/tharidul/site-radar" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://tharidulakmal.com" target="_blank" rel="noopener noreferrer">Developer</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
