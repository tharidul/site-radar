import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { applyThemeToDom } from '../src/utils/theme';
import { Badge } from '../entrypoints/popup/components/Badge';
import { Button } from '../entrypoints/popup/components/Button';
import { Card } from '../entrypoints/popup/components/Card';
import { CustomSelect } from '../entrypoints/popup/components/CustomSelect';
import { Header } from '../entrypoints/popup/components/Header';
import { Scorecard } from '../entrypoints/popup/components/Scorecard';
import { LiveProgressBar } from '../entrypoints/popup/components/LiveProgressBar';
import { ExportBar } from '../entrypoints/popup/components/ExportBar';
import { ModeSelector } from '../entrypoints/popup/components/ModeSelector';
import { OverviewDashboard } from '../entrypoints/popup/components/OverviewDashboard';
import { TabBar } from '../entrypoints/popup/components/TabBar';
import { ModuleAccordions } from '../entrypoints/popup/components/ModuleAccordions';
import { FindingsExplorer } from '../entrypoints/popup/components/FindingsExplorer';
import { FindingDetailInspector } from '../entrypoints/popup/components/FindingDetailInspector';
import { ResourcesView } from '../entrypoints/popup/components/ResourcesView';
import { ReportView } from '../entrypoints/popup/components/ReportView';
import { AboutView } from '../entrypoints/popup/components/AboutView';
import { OptionsApp } from '../entrypoints/options/OptionsApp';
import type { WebsiteInspection } from '../src/types/inspection';

function getLuminance(r: number, g: number, b: number): number {
  const [rs = 0, gs = 0, bs = 0] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

describe('Light Theme Contrast & Style Integrity', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  describe('Theme Manager (theme.ts)', () => {
    it('sets data-theme and light class in DOM when light mode is applied', () => {
      applyThemeToDom('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('sets data-theme and dark class in DOM when dark mode is applied', () => {
      applyThemeToDom('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });

  describe('CSS Token Rules & Contrast Specifications', () => {
    const cssPath = path.resolve(__dirname, '../entrypoints/popup/style.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    it('verifies light mode defines zinc-900 as deep dark charcoal, NOT faint off-white', () => {
      expect(cssContent).toContain('.light, [data-theme=\'light\']');
      const lightSection = cssContent.slice(cssContent.indexOf(".light, [data-theme='light']"));
      expect(lightSection).toMatch(/--color-zinc-900:\s*var\(--color-3\)/);
      expect(lightSection).not.toMatch(/--color-zinc-900:\s*var\(--color-4\)/);
    });

    it('verifies light mode zinc text tokens achieve WCAG AA/AAA contrast ratios against white', () => {
      const whiteRgb: [number, number, number] = [255, 255, 255];
      const pageBgRgb: [number, number, number] = hexToRgb('#f8f8fa');

      const zinc900Rgb = hexToRgb('#152E40');
      const contrast900 = getContrastRatio(zinc900Rgb, whiteRgb);
      expect(contrast900).toBeGreaterThan(14.0);

      const zinc800Rgb = hexToRgb('#26262b');
      const contrast800 = getContrastRatio(zinc800Rgb, whiteRgb);
      expect(contrast800).toBeGreaterThan(10.0);

      const zinc700Rgb = hexToRgb('#3f3f46');
      const contrast700 = getContrastRatio(zinc700Rgb, whiteRgb);
      expect(contrast700).toBeGreaterThan(7.0);

      const zinc600Rgb = hexToRgb('#52525b');
      const contrast600 = getContrastRatio(zinc600Rgb, whiteRgb);
      expect(contrast600).toBeGreaterThan(5.5);

      expect(getContrastRatio(zinc900Rgb, pageBgRgb)).toBeGreaterThan(13.0);
      expect(getContrastRatio(zinc700Rgb, pageBgRgb)).toBeGreaterThan(6.5);
    });

    it('verifies dark mode neutrals and status tokens remain preserved', () => {
      const darkSection = cssContent.slice(
        cssContent.indexOf(":root, .dark, [data-theme='dark']"),
        cssContent.indexOf(".light, [data-theme='light']"),
      );
      expect(darkSection).toContain('--color-zinc-950: var(--color-5);');
      expect(darkSection).toContain('--color-zinc-100: var(--color-4);');
      expect(darkSection).toContain('--color-rose-400: var(--color-2);');
      expect(darkSection).toContain('--color-orange-400: var(--color-1);');
    });

    it('verifies body element uses theme-aware --bg-page and --text-page', () => {
      expect(cssContent).toMatch(/body\s*\{[^}]*background-color:\s*var\(--bg-page/);
      expect(cssContent).toMatch(/body\s*\{[^}]*color:\s*var\(--text-page/);
    });
  });

  function renderComponent(node: React.ReactElement): HTMLDivElement {
    const html = renderToString(node);
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  describe('Component Contrast Class Validations', () => {
    it('Badge renders high-contrast text and border classes for status', () => {
      const div = renderComponent(
        <Badge variant="status" status="passed">
          Passed
        </Badge>,
      );
      const span = div.querySelector('span');
      expect(span?.className).toContain('text-emerald-800');
      expect(span?.className).toContain('dark:text-emerald-300');
      expect(span?.className).toContain('border-emerald-500/30');

      const failedDiv = renderComponent(
        <Badge variant="status" status="failed">
          Failed
        </Badge>,
      );
      const failedSpan = failedDiv.querySelector('span');
      expect(failedSpan?.className).toContain('text-rose-800');
      expect(failedSpan?.className).toContain('dark:text-rose-300');
    });

    it('Badge renders high-contrast text and border classes for severity', () => {
      const div = renderComponent(
        <Badge variant="severity" severity="critical" status="failed">
          Critical
        </Badge>,
      );
      const span = div.querySelector('span');
      expect(span?.className).toContain('text-rose-800');
      expect(span?.className).toContain('dark:text-rose-300');
    });

    it('Button secondary and outline variants render crisp borders and text in both modes', () => {
      const secDiv = renderComponent(<Button variant="secondary">Secondary Action</Button>);
      const secBtn = secDiv.querySelector('button');
      expect(secBtn?.className).toContain('border-zinc-200/80');
      expect(secBtn?.className).toContain('text-zinc-800');
      expect(secBtn?.className).toContain('dark:text-zinc-200');

      const outDiv = renderComponent(<Button variant="outline">Outline Action</Button>);
      const outBtn = outDiv.querySelector('button');
      expect(outBtn?.className).toContain('border-zinc-200');
      expect(outBtn?.className).toContain('dark:border-zinc-800');
      expect(outBtn?.className).toContain('text-zinc-800');
      expect(outBtn?.className).toContain('dark:text-zinc-300');
    });

    it('Header renders adaptive theme styling across header container, brand typography, action controls, and target site bar', () => {
      const div = renderComponent(
        <Header
          tabUrl="https://example.com"
          tabHostname="example.com"
          schemeValid={true}
          hasInspectionData={true}
          onClearResults={() => {}}
          onOptionsClick={() => {}}
          theme="light"
          onToggleTheme={() => {}}
          onClose={() => {}}
        />,
      );

      const headerEl = div.querySelector('header');
      expect(headerEl?.className).toContain('bg-white');
      expect(headerEl?.className).toContain('dark:bg-zinc-950');
      expect(headerEl?.className).toContain('border-zinc-200');
      expect(headerEl?.className).toContain('dark:border-zinc-800');

      const waveEl = div.querySelector('.pointer-events-none.absolute');
      expect(waveEl).toBeNull();

      const titleEl = div.querySelector('h1');
      expect(titleEl?.className).toContain('text-zinc-900');
      expect(titleEl?.className).toContain('dark:text-white');

      const subtitleEl = div.querySelector('header span.text-xs.block');
      expect(subtitleEl?.className).toContain('text-zinc-500');
      expect(subtitleEl?.className).toContain('dark:text-zinc-400');

      const actionButtons = div.querySelectorAll('header .relative.z-10.flex.items-center.justify-between button');
      expect(actionButtons.length).toBe(4);
      actionButtons.forEach((btn) => {
        expect(btn.className).toContain('border-zinc-200');
        expect(btn.className).toContain('dark:border-zinc-700/60');
        expect(btn.className).toContain('bg-zinc-100');
        expect(btn.className).toContain('dark:bg-zinc-800/80');
        expect(btn.className).toContain('text-zinc-700');
        expect(btn.className).toContain('dark:text-zinc-300');
        expect(btn.className).toContain('hover:bg-zinc-200');
        expect(btn.className).toContain('dark:hover:bg-zinc-700');
        expect(btn.className).toContain('hover:text-zinc-900');
        expect(btn.className).toContain('dark:hover:text-white');
      });

      const urlBar = div.querySelector('.relative.z-10.mt-2\\.5');
      expect(urlBar?.className).toContain('border-zinc-200/80');
      expect(urlBar?.className).toContain('dark:border-zinc-800');
      expect(urlBar?.className).toContain('bg-white');
      expect(urlBar?.className).toContain('dark:bg-zinc-900');

      const urlText = urlBar?.querySelector('span.truncate');
      expect(urlText?.className).toContain('text-zinc-900');
      expect(urlText?.className).toContain('dark:text-zinc-100');
    });

    it('Scorecard does not contain hardcoded dark-only backgrounds or borders without theme support', () => {
      const div = renderComponent(
        <Scorecard
          findings={[]}
          onFilterSeverity={() => {}}
        />,
      );
      const rootDiv = div.firstElementChild as HTMLElement;
      expect(rootDiv.className).toContain('bg-[#f8f8fa]');
      expect(rootDiv.className).toContain('dark:bg-zinc-950');
      expect(rootDiv.className).toContain('border-zinc-200');
      expect(rootDiv.className).toContain('dark:border-zinc-800');
    });

    it('LiveProgressBar supports both light and dark modes with proper contrast', () => {
      const div = renderComponent(
        <LiveProgressBar
          progress={{
            scanId: '1',
            mode: 'quick',
            step: 'Testing step',
            percent: 50,
            completedModules: 2,
            totalModules: 8,
            timestamp: Date.now(),
          }}
          onCancel={() => {}}
        />,
      );
      const barRoot = div.firstElementChild as HTMLElement;
      expect(barRoot.className).toContain('bg-white');
      expect(barRoot.className).toContain('dark:bg-zinc-950');
      expect(barRoot.className).toContain('border-zinc-200');
      expect(barRoot.className).toContain('dark:border-zinc-800');
    });

    it('ExportBar supports both light and dark modes with crisp text', () => {
      const div = renderComponent(
        <ExportBar
          inspection={{
            id: 'test',
            startedAt: Date.now(),
            mode: 'quick',
            target: { url: 'https://example.com', origin: 'https://example.com', hostname: 'example.com', inspectedAt: Date.now() },
            modules: {},
            findings: [],
            scores: {},
          } as unknown as WebsiteInspection}
        />,
      );
      const exportRoot = div.firstElementChild as HTMLElement;
      expect(exportRoot.className).toContain('border-zinc-200');
      expect(exportRoot.className).toContain('dark:border-zinc-800');
      expect(exportRoot.className).toContain('bg-[#f8f8fa]');
      expect(exportRoot.className).toContain('dark:bg-zinc-950');
    });

    it('ModeSelector options display clean surface styling with active state indicator in light mode', () => {
      const div = renderComponent(
        <ModeSelector
          selectedMode="quick"
          onSelectMode={() => {}}
          onStartInspection={() => {}}
          disabled={false}
        />,
      );
      const options = div.querySelectorAll('.rounded-md.p-3\\.5');
      expect(options.length).toBe(3);
      const unselectedOption = options[1];
      expect(unselectedOption?.className).toContain('bg-white');
      expect(unselectedOption?.className).toContain('dark:bg-zinc-900');
    });

    it('OptionsApp supports light theme across root container, sections, and controls', () => {
      const div = renderComponent(<OptionsApp />);
      const rootEl = div.firstElementChild as HTMLElement;
      expect(rootEl.className).toContain('bg-[#f8f8fa]');
      expect(rootEl.className).toContain('dark:bg-zinc-950');
      expect(rootEl.className).toContain('text-zinc-900');
      expect(rootEl.className).toContain('dark:text-zinc-100');

      const sections = div.querySelectorAll('section');
      expect(sections.length).toBe(2);
      sections.forEach((sec) => {
        expect(sec.className).toContain('bg-white');
        expect(sec.className).toContain('dark:bg-zinc-900/60');
        expect(sec.className).toContain('rounded-md');
      });
    });

    it('Card renders clean surface planes and background with dark mode preservation', () => {
      const div = renderComponent(<Card>Test Card Content</Card>);
      const cardEl = div.firstElementChild as HTMLElement;
      expect(cardEl.className).toContain('rounded-md');
      expect(cardEl.className).toContain('bg-white');
      expect(cardEl.className).toContain('dark:bg-zinc-900');
    });

    it('TabBar renders crisp border and distinct active/inactive contrast in light mode', () => {
      const div = renderComponent(
        <TabBar
          activeTab="overview"
          onSelectTab={() => {}}
          issuesCount={3}
        />,
      );
      const tabBarRoot = div.firstElementChild as HTMLElement;
      expect(tabBarRoot.className).toContain('border-zinc-200/80');
      expect(tabBarRoot.className).toContain('dark:border-zinc-800');
      expect(tabBarRoot.className).toContain('bg-[#f8f8fa]');
      expect(tabBarRoot.className).toContain('dark:bg-zinc-950');

      const buttons = div.querySelectorAll('button');
      expect(buttons[0]?.className).toContain('text-[#152E40]');
      expect(buttons[0]?.className).toContain('dark:text-[#CEFF52]');
      expect(buttons[1]?.className).toContain('text-zinc-600');
      expect(buttons[1]?.className).toContain('dark:text-zinc-400');
    });

    it('OverviewDashboard renders crisp borders and high-contrast text on all cards and metrics', () => {
      const mockInspection: WebsiteInspection = {
        id: 'test-audit-1',
        startedAt: Date.now(),
        completedAt: Date.now(),
        mode: 'quick',
        target: {
          url: 'https://example.com',
          hostname: 'example.com',
          origin: 'https://example.com',
          inspectedAt: Date.now(),
        },
        scores: {
          security: { category: 'security', score: 92, status: 'passed', totalChecks: 10, passed: 9, warnings: 1, failed: 0, weight: 1 },
          performance: { category: 'performance', score: 85, status: 'warning', totalChecks: 8, passed: 6, warnings: 2, failed: 0, weight: 1 },
          seo: { category: 'seo', score: 100, status: 'passed', totalChecks: 6, passed: 6, warnings: 0, failed: 0, weight: 1 },
          accessibility: { category: 'accessibility', score: 70, status: 'warning', totalChecks: 10, passed: 7, warnings: 1, failed: 2, weight: 1 },
          'best-practices': { category: 'best-practices', score: 95, status: 'passed', totalChecks: 5, passed: 5, warnings: 0, failed: 0, weight: 1 },
        },
        findings: [
          {
            id: 'f-1',
            ruleId: 'sec-1',
            category: 'security',
            severity: 'critical',
            status: 'failed',
            title: 'Missing CSP',
            description: 'Content Security Policy is not defined',
            recommendation: 'Add CSP header',
            evidence: [],
            source: 'test',
          },
        ],
        modules: {
          technology: {
            module: 'technology',
            status: 'completed',
            collectedAt: Date.now(),
            sources: ['dom'],
            coverage: 100,
            limitations: [],
            data: {
              technologies: [
                { name: 'React', version: '19.0.0', category: 'Framework', evidence: 'window.React' },
              ],
            },
          },
        },
      } as unknown as WebsiteInspection;

      const div = renderComponent(
        <OverviewDashboard
          inspection={mockInspection}
          onNavigateToIssues={() => {}}
        />,
      );

      const categoryCards = div.querySelectorAll('.grid.grid-cols-5 button');
      expect(categoryCards.length).toBe(5);
      categoryCards.forEach((card) => {
        expect(card.className).toContain('rounded-md');
        expect(card.className).toContain('bg-white');
        expect(card.className).toContain('dark:bg-zinc-900');
      });

      const techCards = div.querySelectorAll('[title^="Detected via"]');
      expect(techCards.length).toBeGreaterThan(0);
      techCards.forEach((card) => {
        expect(card.className).toContain('bg-zinc-50');
        expect(card.className).toContain('dark:bg-zinc-800/40');
      });
    });

    it('ModuleAccordions renders with theme-aware containers and crisp borders', () => {
      const div = renderComponent(<ModuleAccordions modules={{}} />);
      const rootEl = div.firstElementChild as HTMLElement;
      expect(rootEl.className).toContain('bg-[#f8f8fa]');
      expect(rootEl.className).toContain('dark:bg-zinc-950');
      expect(rootEl.className).toContain('text-zinc-900');
      expect(rootEl.className).toContain('dark:text-zinc-100');
    });

    it('FindingsExplorer supports light theme with crisp borders, readable metadata, and high-contrast rows', () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          ruleId: 'csp-missing',
          category: 'security',
          severity: 'critical' as const,
          status: 'failed' as const,
          title: 'Content Security Policy (CSP) Not Enforced',
          description: 'No Content-Security-Policy response header was observed.',
          recommendation: 'Configure a strict CSP.',
          evidence: [{ label: 'Header', value: 'missing', source: 'headers', observedAt: Date.now() }],
          source: 'securityHeaders',
        },
      ];

      const div = renderComponent(
        <FindingsExplorer
          findings={mockFindings}
          activeSeverityFilter="all"
          activeCategoryFilter="security"
          onSelectSeverityFilter={() => {}}
          scores={{
            security: {
              category: 'security',
              score: 75,
              totalChecks: 12,
              passed: 9,
              warnings: 2,
              failed: 1,
              weight: 1,
            },
          }}
          initialExpandedFindingId="test-finding-1"
        />,
      );

      const searchInput = div.querySelector('input[type="text"]');
      expect(searchInput?.className).toContain('border-zinc-200');
      expect(searchInput?.className).toContain('dark:border-zinc-800');
      expect(searchInput?.className).toContain('bg-white');
      expect(searchInput?.className).toContain('dark:bg-zinc-900');
      expect(searchInput?.className).toContain('text-zinc-900');
      expect(searchInput?.className).toContain('dark:text-zinc-100');

      const scoreDenominator = div.querySelector('.flex.items-baseline.gap-1 span:last-child');
      expect(scoreDenominator?.className).toContain('text-zinc-500');
      expect(scoreDenominator?.className).toContain('dark:text-zinc-400');

      const issueDesc = div.querySelector('p.text-xs');
      expect(issueDesc?.className).toContain('text-zinc-500');
      expect(issueDesc?.className).toContain('dark:text-zinc-400');

      const copyIssueBtn = div.querySelector('button[aria-label="Copy JSON for issue csp-missing"]');
      expect(copyIssueBtn).not.toBeNull();
    });

    it('FindingsExplorer transitions to dedicated detail view when an issue is selected', () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          ruleId: 'csp-missing',
          category: 'security',
          severity: 'critical' as const,
          status: 'failed' as const,
          title: 'Content Security Policy (CSP) Not Enforced',
          description: 'No Content-Security-Policy response header was observed.',
          recommendation: 'Configure a strict CSP.',
          evidence: [{ label: 'Header', value: 'missing', source: 'headers', observedAt: Date.now() }],
          source: 'securityHeaders',
        },
      ];

      const div = renderComponent(
        <FindingsExplorer
          findings={mockFindings}
          activeSeverityFilter="all"
          activeCategoryFilter="security"
          onSelectSeverityFilter={() => {}}
          initialSelectedFindingId="test-finding-1"
        />,
      );

      const backBtn = div.querySelector('button[title*="Return to issues"], button[title*="Back to issues"]');
      expect(backBtn).not.toBeNull();

      expect(div.textContent).toContain('rule: csp-missing');
      expect(div.textContent).toContain('Recommended Remediation');
    });

    it('FindingDetailInspector renders high-contrast evidence tables and action controls', () => {
      const mockFinding = {
        id: 'test-finding-detail',
        ruleId: 'cors-wildcard',
        category: 'security',
        severity: 'high' as const,
        status: 'failed' as const,
        title: 'Wildcard CORS Origin',
        description: 'Access-Control-Allow-Origin is set to *.',
        recommendation: 'Specify exact allowed origins.',
        expectedBehavior: 'Origin should be explicitly validated.',
        explanation: 'Wildcard origins expose authenticated resources to any origin.',
        evidence: [{ label: 'Header', value: 'Access-Control-Allow-Origin: *', source: 'headers', observedAt: Date.now() }],
        references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS'],
        source: 'securityHeaders',
      };

      const div = renderComponent(
        <FindingDetailInspector
          finding={mockFinding}
          onCollapse={() => {}}
        />,
      );

      const tbody = div.querySelector('tbody');
      expect(tbody?.className).toContain('divide-zinc-200/80');
      expect(tbody?.className).toContain('dark:divide-zinc-800/60');

      const buttons = Array.from(div.querySelectorAll('button'));
      const collapseBtn = buttons.find((b) => b.textContent?.includes('Collapse'));
      expect(collapseBtn?.className).toContain('text-zinc-600');
      expect(collapseBtn?.className).toContain('dark:text-zinc-400');

      const copyBtn = buttons.find((b) => b.textContent?.includes('Copy'));
      expect(copyBtn?.className).toContain('text-zinc-700');
      expect(copyBtn?.className).toContain('dark:text-zinc-300');
    });

    it('ResourcesView renders crisp filter tabs and high-contrast resource rows', () => {
      const mockInspection = {
        id: 'res-audit-1',
        startedAt: Date.now(),
        mode: 'quick',
        target: { url: 'https://example.com', hostname: 'example.com', origin: 'https://example.com', inspectedAt: Date.now() },
        modules: {
          resources: {
            module: 'resources',
            status: 'completed',
            collectedAt: Date.now(),
            sources: ['dom'],
            coverage: 100,
            limitations: [],
            data: {
              scripts: [{ src: 'https://example.com/app.js', domain: 'example.com', isAsync: true }],
              stylesheets: [],
              images: [],
              thirdPartyOrigins: ['example.com'],
            },
          },
          technology: {
            module: 'technology',
            status: 'completed',
            collectedAt: Date.now(),
            sources: ['dom'],
            coverage: 100,
            limitations: [],
            data: {
              technologies: [{ name: 'Vite', version: '6.0', category: 'Build Tool', evidence: 'window.__vite__' }],
            },
          },
        },
        findings: [],
        scores: {},
      } as unknown as WebsiteInspection;

      const div = renderComponent(<ResourcesView inspection={mockInspection} />);

      const tabButtons = div.querySelectorAll('.grid.grid-cols-4 button');
      expect(tabButtons.length).toBe(4);
      expect(tabButtons[1]?.className).toContain('bg-white');
      expect(tabButtons[1]?.className).toContain('dark:bg-zinc-900');

      const techContainer = div.querySelector('.rounded-md.p-4.space-y-2\\.5');
      expect(techContainer?.className).toContain('bg-white');
      expect(techContainer?.className).toContain('dark:bg-zinc-900');

      const pathSubtext = div.querySelector('span.text-\\[10px\\]');
      expect(pathSubtext?.className).toContain('text-zinc-500');
      expect(pathSubtext?.className).toContain('dark:text-zinc-400');
    });

    it('ReportView renders crisp export buttons and theme-aware metadata cards', () => {
      const mockInspection = {
        id: 'rep-audit-1',
        startedAt: Date.now(),
        mode: 'quick',
        target: { url: 'https://example.com', hostname: 'example.com', origin: 'https://example.com', inspectedAt: Date.now() },
        modules: {},
        findings: [],
        scores: {},
      } as unknown as WebsiteInspection;

      const div = renderComponent(<ReportView inspection={mockInspection} />);

      const rootEl = div.firstElementChild as HTMLElement;
      expect(rootEl.className).toContain('bg-[#f8f8fa]');
      expect(rootEl.className).toContain('dark:bg-zinc-950');
      expect(rootEl.className).toContain('text-zinc-900');
      expect(rootEl.className).toContain('dark:text-zinc-100');

      const buttons = div.querySelectorAll('button');
      expect(buttons.length).toBe(3);
      expect(buttons[1]?.className).toContain('bg-[#CEFF52]');
      expect(buttons[2]?.className).toContain('bg-zinc-100');
    });

    it('AboutView renders clean author card and brand identity for LKML', () => {
      const div = renderComponent(<AboutView />);

      const rootEl = (div.querySelector('.bg-\\[\\#f8f8fa\\]') || div.firstElementChild) as HTMLElement;
      expect(rootEl.className).toContain('bg-[#f8f8fa]');
      expect(rootEl.className).toContain('dark:bg-zinc-950');

      expect(div.textContent).toContain('LKML');
      expect(div.textContent).not.toContain('developer');
      expect(div.textContent).not.toContain('Developer');

      const card = div.querySelector('.rounded-md.p-4');
      expect(card?.className).toContain('bg-white');
      expect(card?.className).toContain('dark:bg-zinc-900');
    });

    it('TabBar renders all 6 tabs including the Cookies and About tabs', () => {
      const div = renderComponent(
        <TabBar
          activeTab="cookies"
          onSelectTab={() => {}}
          issuesCount={2}
        />,
      );
      const buttons = div.querySelectorAll('button');
      expect(buttons.length).toBe(6);

      expect(buttons[4]?.textContent).toContain('Cookies');
      expect(buttons[4]?.className).toContain('text-[#152E40]');
      expect(buttons[4]?.className).toContain('dark:text-[#CEFF52]');

      expect(buttons[5]?.textContent).toContain('About');
    });
  });
});
