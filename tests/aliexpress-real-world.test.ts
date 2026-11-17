import { describe, it, expect } from 'vitest';
import { CorroborationEngine } from '../src/corroborator';
import { calculateInspectionScores } from '../src/scoring/score-engine';
import type { AuditFinding, WebsiteTarget } from '../src/types/inspection';

function makeFinding(partial: Partial<AuditFinding> & { id: string; category: any; ruleId: string; title: string; severity: any; status: any }): AuditFinding {
  return {
    description: partial.title,
    source: 'test',
    evidence: [],
    ...partial,
  };
}

describe('Real-World AliExpress Audit Corroboration', () => {
  it('accurately corroborates security headers and resolves accessibility density on e-commerce catalog', () => {
    const target: WebsiteTarget = {
      url: 'https://www.aliexpress.com/?acnt=347-178-5672&aff_platform=google&aff_short_key=UneMJZVf&albag=198689191614&albagn=888888&albbt=Google_7_fbrnd&albch=fbrnd&albcp=24232429843&crea=823894141858&device=c&gad_campaignid=24232429843&gad_source=1&gbraid=0AAAAAD1qHibQx9FizQ1I7yeORKYtu_2Kg&isSmbActive=false&isSmbAutoCall=false&isdl=y&memo1=&mtctp=e&needSmbHouyi=false&netw=g&plac=&slnk=&src=google&trgt=kwd-14802285088',
      origin: 'https://www.aliexpress.com',
      hostname: 'www.aliexpress.com',
      inspectedAt: Date.now(),
      isLocalDevelopment: false,
    };

    const modules = {
      media: { data: { totalImages: 285, missingAltCount: 5 } },
      dom: {
        data: {
          elementCount: 2909,
          nativeButtonsCount: 215,
          interactiveElementsCount: 350,
          textNodeCount: 1200,
          containersCount: 42,
        },
      },
      forms: {
        data: {
          formCount: 2,
          totalInputCount: 6,
          hasHiddenPasswordField: true,
          hasVisiblePasswordField: false,
          hasHiddenPostForm: true,
          hasVisiblePostForm: false,
        },
      },
      links: {
        data: {
          totalLinks: 210,
          internalLinks: [],
          externalLinks: [
            { url: 'https://login.aliexpress.com' },
            { url: 'https://shoppingcart.aliexpress.com' },
          ],
          isolatedCheckoutOrigins: ['login.aliexpress.com', 'shoppingcart.aliexpress.com'],
          invalidProtocols: [],
          emptyHrefs: 0,
        },
      },
      security: { data: { headers: {} } },
      performance: { data: { fcp: 708, lcp: 2108 } },
    };

    const rawFindings: AuditFinding[] = [
      // Security
      makeFinding({ id: '1', category: 'security', ruleId: 'sec-missing-x-frame-options', title: 'Missing Clickjacking Protection', severity: 'medium', status: 'failed' }),
      makeFinding({ id: '2', category: 'security', ruleId: 'sec-missing-csp', title: 'Missing Content Security Policy', severity: 'medium', status: 'failed' }),
      makeFinding({ id: '3', category: 'security', ruleId: 'sec-missing-hsts', title: 'Missing HSTS Header', severity: 'medium', status: 'failed' }),
      makeFinding({ id: '4', category: 'security', ruleId: 'sec-missing-referrer-policy', title: 'Missing or Insecure Referrer-Policy', severity: 'low', status: 'failed' }),
      makeFinding({ id: '5', category: 'security', ruleId: 'sec-missing-x-content-type-options', title: 'Missing X-Content-Type-Options Header', severity: 'low', status: 'failed' }),
      makeFinding({ id: '6', category: 'security', ruleId: 'sec-https-enforced', title: 'HTTPS Enforced', severity: 'high', status: 'passed' }),
      makeFinding({ id: '7', category: 'security', ruleId: 'sec-form-action-secure', title: 'Form Actions Secure', severity: 'high', status: 'passed' }),

      // Accessibility
      makeFinding({ id: '8', category: 'accessibility', ruleId: 'a11y-missing-alt', title: 'Image Accessible Name Alternatives', severity: 'high', status: 'failed', evidence: [{ label: 'Images Missing Alt', value: 5, source: 'media', observedAt: Date.now() }, { label: 'Total Images Evaluated', value: 285, source: 'media', observedAt: Date.now() }] }),
      makeFinding({ id: '9', category: 'accessibility', ruleId: 'a11y-axe-image-alt', title: 'axe: image-alt', severity: 'critical', status: 'failed', evidence: [{ label: 'Nodes Affected', value: 2, source: 'axe', observedAt: Date.now() }] }),
      makeFinding({ id: '10', category: 'accessibility', ruleId: 'a11y-axe-label-content-name-mismatch', title: 'axe: label-content-name-mismatch', severity: 'high', status: 'failed', evidence: [{ label: 'Nodes Affected', value: 46, source: 'axe', observedAt: Date.now() }] }),
      makeFinding({ id: '11', category: 'accessibility', ruleId: 'a11y-axe-color-contrast', title: 'axe: color-contrast', severity: 'high', status: 'failed', evidence: [{ label: 'Nodes Affected', value: 36, source: 'axe', observedAt: Date.now() }] }),
      makeFinding({ id: '12', category: 'accessibility', ruleId: 'a11y-axe-region', title: 'axe: region', severity: 'medium', status: 'failed', evidence: [{ label: 'Nodes Affected', value: 2, source: 'axe', observedAt: Date.now() }] }),
      makeFinding({ id: '13', category: 'accessibility', ruleId: 'a11y-axe-landmark-unique', title: 'axe: landmark-unique', severity: 'medium', status: 'failed', evidence: [{ label: 'Nodes Affected', value: 1, source: 'axe', observedAt: Date.now() }] }),
      makeFinding({ id: '14', category: 'accessibility', ruleId: 'a11y-missing-lang', title: 'HTML Lang', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '15', category: 'accessibility', ruleId: 'a11y-missing-landmarks', title: 'Main Landmark', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '16', category: 'accessibility', ruleId: 'resp-disables-zoom', title: 'User Scalable', severity: 'high', status: 'passed' }),
      makeFinding({ id: '17', category: 'aeo', ruleId: 'ago-form-labels', title: 'Form Labels', severity: 'medium', status: 'passed' }),

      // Performance
      makeFinding({ id: '18', category: 'performance', ruleId: 'perf-render-blocking-resources', title: 'Render-Blocking Scripts Detected', severity: 'medium', status: 'warning' }),
      makeFinding({ id: '19', category: 'performance', ruleId: 'perf-excessive-dom-depth', title: 'DOM Tree Complexity and Size', severity: 'low', status: 'warning' }),
      makeFinding({ id: '20', category: 'performance', ruleId: 'perf-lcp', title: 'Largest Contentful Paint', severity: 'high', status: 'passed' }),
      makeFinding({ id: '21', category: 'performance', ruleId: 'perf-cls', title: 'Cumulative Layout Shift', severity: 'high', status: 'passed' }),
      makeFinding({ id: '22', category: 'performance', ruleId: 'perf-fcp', title: 'First Contentful Paint', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '23', category: 'performance', ruleId: 'perf-ttfb', title: 'Time to First Byte', severity: 'medium', status: 'passed' }),

      // SEO
      makeFinding({ id: '24', category: 'seo', ruleId: 'seo-canonical-matches', title: 'Canonical URL Configuration', severity: 'medium', status: 'warning', evidence: [{ label: 'Declared Canonical URL', value: 'https://www.aliexpress.com', source: 'seo', observedAt: Date.now() }, { label: 'Active URL', value: target.url, source: 'seo', observedAt: Date.now() }] }),
      makeFinding({ id: '25', category: 'seo', ruleId: 'seo-title-present', title: 'Title Present', severity: 'high', status: 'passed' }),
      makeFinding({ id: '26', category: 'seo', ruleId: 'seo-meta-description', title: 'Meta Description', severity: 'high', status: 'passed' }),
      makeFinding({ id: '27', category: 'seo', ruleId: 'seo-robots-valid', title: 'Robots TXT Valid', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '28', category: 'seo', ruleId: 'seo-hreflang-valid', title: 'Hreflang Valid', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '29', category: 'seo', ruleId: 'seo-sitemap-declared', title: 'Sitemap Declared', severity: 'low', status: 'passed' }),
      makeFinding({ id: '30', category: 'seo', ruleId: 'seo-structured-data-valid', title: 'Structured Data Valid', severity: 'medium', status: 'passed' }),
      makeFinding({ id: '31', category: 'seo', ruleId: 'seo-opengraph-valid', title: 'OpenGraph Valid', severity: 'low', status: 'passed' }),
    ];

    const corroborator = new CorroborationEngine();
    const corroboratedFindings = corroborator.corroborate(rawFindings, { target, modules });
    const scoreResult = calculateInspectionScores(corroboratedFindings);

    // 1. Security Checks
    const secScore = scoreResult.scores.security;
    expect(secScore).toBeDefined();
    expect(secScore!.score).toBe(100);
    expect(secScore!.hasCriticalFailure).toBe(false);
    expect(secScore!.criticalCapTriggered).toBe(false);
    expect(secScore!.realityCounts!.ARCHITECTURAL_PATTERN).toBe(4);
    expect(secScore!.realityCounts!.SYNTHETIC_NOISE).toBe(1);

    // 2. Accessibility Checks
    const a11yScore = scoreResult.scores.accessibility;
    expect(a11yScore).toBeDefined();
    expect(a11yScore!.score).toBeGreaterThanOrEqual(65);
    expect(a11yScore!.score).toBeLessThanOrEqual(75);
    expect(a11yScore!.hasCriticalFailure).toBe(false);
    expect(a11yScore!.criticalCapTriggered).toBe(false);
    // axe: image-alt critical deduction reduced from -25 to -2 pts
    const axeImgAltDeduction = a11yScore!.deductionsExplanation!.find((d) => d.includes('axe: image-alt'));
    expect(axeImgAltDeduction).toBeDefined();
    expect(axeImgAltDeduction).toMatch(/-\s*[12]\s*pts/);

    // 3. Performance & SEO Checks
    const perfScore = scoreResult.scores.performance;
    expect(perfScore).toBeDefined();
    expect(perfScore!.score).toBe(100);
    const seoScore = scoreResult.scores.seo;
    expect(seoScore).toBeDefined();
    expect(seoScore!.score).toBe(100);

    // Overall balanced score reflects high quality e-commerce storefront
    expect(scoreResult.overallScore).toBeGreaterThanOrEqual(85);
  });
});
