import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type {
  FindingStatus,
  Severity,
} from '../../../src/types/inspection';
import type {
  BlastTier,
  RealityState,
} from '../../../src/corroborator/types';

export interface ExpectedFinding {
  ruleId: string;
  category: string;
  expectedStatus: FindingStatus;
  expectedRealityState: RealityState;
  expectedBlastTier?: BlastTier;
  expectedMultiplier?: number;
  severity?: Severity;
  description?: string;
}

export interface ExpectedScores {
  overall: { min: number; max: number; exact?: number };
  security?: { min: number; max: number };
  performance?: { min: number; max: number };
  accessibility?: { min: number; max: number };
  seo?: { min: number; max: number };
  bestPractices?: { min: number; max: number };
  telemetryCoverageIndex?: { min: number; max: number };
}

export interface SimulatedContext {
  url: string;
  origin: string;
  hostname: string;
  performance?: {
    fcpMs?: number;
    lcpMs?: number;
    clsScore?: number;
    ttfbMs?: number;
  };
  headers?: Record<string, string>;
  isLocalDevelopment?: boolean;
}

export interface CalibrationCase {
  id: string;
  caseNumber: number;
  name: string;
  fixtureFile: string;
  fixturePath: string;
  targetUrl: string;
  description: string;
  archetype: string;
  primaryRealityState: RealityState | 'PASS';
  expectedRealityStates: Record<RealityState, number>;
  expectedScores: ExpectedScores;
  expectedFindings: ExpectedFinding[];
  invariants: string[];
  simulatedContext: SimulatedContext;
  loadHtml: () => string;
}

const getFixturesDir = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return path.resolve(process.cwd(), 'tests/fixtures/calibration');
};

const FIXTURES_DIR = getFixturesDir();

export function loadFixtureHtml(fixtureFileOrPath: string): string {
  const normalized = fixtureFileOrPath.replace(/^tests\/fixtures\/calibration\//, '');
  const candidate1 = path.join(FIXTURES_DIR, normalized);
  if (fs.existsSync(candidate1)) {
    return fs.readFileSync(candidate1, 'utf-8');
  }
  const candidate2 = path.resolve(process.cwd(), 'tests/fixtures/calibration', normalized);
  if (fs.existsSync(candidate2)) {
    return fs.readFileSync(candidate2, 'utf-8');
  }
  return fs.readFileSync(candidate1, 'utf-8');
}

function createHtmlLoader(filename: string): () => string {
  return () => loadFixtureHtml(filename);
}

export const cleanBaselineCase: CalibrationCase = {
  id: '01-clean-baseline',
  caseNumber: 1,
  name: 'Clean Compliant Baseline',
  fixtureFile: '01-clean-baseline.html',
  fixturePath: 'tests/fixtures/calibration/01-clean-baseline.html',
  targetUrl: 'https://example.com/clean-baseline',
  description:
    'Perfect HTML5 reference page adhering to all WCAG 2.2 AA, SEO, security context, and responsiveness standards with zero defects.',
  archetype: 'Perfect Reference Page',
  primaryRealityState: 'PASS',
  expectedRealityStates: {
    TRUE_DEFECT: 0,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 0,
  },
  expectedScores: {
    overall: { min: 100, max: 100, exact: 100 },
    security: { min: 100, max: 100 },
    performance: { min: 100, max: 100 },
    accessibility: { min: 100, max: 100 },
    seo: { min: 100, max: 100 },
    bestPractices: { min: 100, max: 100 },
    telemetryCoverageIndex: { min: 100, max: 100 },
  },
  expectedFindings: [
    {
      ruleId: 'sec-https-enforced',
      category: 'security',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'critical',
      description: 'HTTPS protocol enforced on reference page',
    },
    {
      ruleId: 'seo-title-present',
      category: 'seo',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'high',
      description: 'Valid, descriptive title tag within 10-70 characters',
    },
    {
      ruleId: 'seo-canonical-matches',
      category: 'seo',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'low',
      description: 'Self-referencing canonical URL matches target URL',
    },
    {
      ruleId: 'a11y-missing-lang',
      category: 'accessibility',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'medium',
      description: 'Root html tag declares valid lang="en"',
    },
    {
      ruleId: 'a11y-missing-landmarks',
      category: 'accessibility',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'low',
      description: 'Semantic <main> landmark region present',
    },
    {
      ruleId: 'a11y-missing-alt',
      category: 'accessibility',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'high',
      description: 'All images have descriptive accessible names',
    },
    {
      ruleId: 'resp-viewport-valid',
      category: 'best-practices',
      expectedStatus: 'passed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedMultiplier: 1.0,
      severity: 'high',
      description: 'Mobile responsive meta viewport configured correctly',
    },
  ],
  invariants: [
    'Overall audit score must equal 100 with zero deductions',
    'Zero TRUE_DEFECT violations detected',
    'Zero SYNTHETIC_NOISE or false-positive alarms',
    'Telemetry Coverage Index must be 100%',
  ],
  simulatedContext: {
    url: 'https://example.com/clean-baseline',
    origin: 'https://example.com',
    hostname: 'example.com',
    performance: {
      fcpMs: 450,
      lcpMs: 900,
      clsScore: 0.0,
      ttfbMs: 80,
    },
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  },
  loadHtml: createHtmlLoader('01-clean-baseline.html'),
};

export const criticalCheckoutFailCase: CalibrationCase = {
  id: '02-critical-checkout-fail',
  caseNumber: 2,
  name: 'Critical Checkout Failure',
  fixtureFile: '02-critical-checkout-fail.html',
  fixturePath: 'tests/fixtures/calibration/02-critical-checkout-fail.html',
  targetUrl: 'https://example.com/checkout',
  description:
    'E-commerce checkout simulation exhibiting high-blast true defects: form action submitting to http://, password/PIN transmitted over insecure endpoint, and unlabeled submit button.',
  archetype: 'E-Commerce Checkout Simulation',
  primaryRealityState: 'TRUE_DEFECT',
  expectedRealityStates: {
    TRUE_DEFECT: 3,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 0,
  },
  expectedScores: {
    overall: { min: 70, max: 80 },
    security: { min: 0, max: 49 },
    accessibility: { min: 0, max: 70 },
  },
  expectedFindings: [
    {
      ruleId: 'sec-insecure-form-action',
      category: 'security',
      expectedStatus: 'failed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedBlastTier: 'critical_flow',
      expectedMultiplier: 1.0,
      severity: 'critical',
      description: 'Checkout form action submits credentials over unencrypted HTTP endpoint',
    },
    {
      ruleId: 'sec-password-over-http',
      category: 'security',
      expectedStatus: 'failed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedBlastTier: 'critical_flow',
      expectedMultiplier: 1.0,
      severity: 'critical',
      description: 'Password / security PIN input field transmitted to insecure recipient',
    },
    {
      ruleId: 'a11y-axe-button-name',
      category: 'accessibility',
      expectedStatus: 'failed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedBlastTier: 'interactive',
      expectedMultiplier: 1.0,
      severity: 'critical',
      description: 'Primary purchase submit button lacks accessible name/label',
    },
  ],
  invariants: [
    'Unencrypted form action and password over HTTP must be classified as TRUE_DEFECT',
    'Critical failure flow control override must cap security score at <= 49',
    'High blast tier on payment flow must produce severe score deduction',
    'Unlabeled submit button must register as an interactive accessibility defect',
  ],
  simulatedContext: {
    url: 'https://example.com/checkout',
    origin: 'https://example.com',
    hostname: 'example.com',
    performance: {
      fcpMs: 650,
      lcpMs: 1400,
      clsScore: 0.01,
      ttfbMs: 110,
    },
  },
  loadHtml: createHtmlLoader('02-critical-checkout-fail.html'),
};

export const decorativeAltFailCase: CalibrationCase = {
  id: '03-decorative-alt-fail',
  caseNumber: 3,
  name: 'Decorative Alt Low Blast Failure',
  fixtureFile: '03-decorative-alt-fail.html',
  fixturePath: 'tests/fixtures/calibration/03-decorative-alt-fail.html',
  targetUrl: 'https://example.com/catalog',
  description:
    'Product catalog grid with 300 thumbnail images where only 2 omit alt attributes. Demonstrates continuous density scoring and decorative blast tier dampening.',
  archetype: 'Massive Product Grid',
  primaryRealityState: 'TRUE_DEFECT',
  expectedRealityStates: {
    TRUE_DEFECT: 1,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 0,
  },
  expectedScores: {
    overall: { min: 98, max: 100 },
    accessibility: { min: 97, max: 100 },
  },
  expectedFindings: [
    {
      ruleId: 'a11y-missing-alt',
      category: 'accessibility',
      expectedStatus: 'failed',
      expectedRealityState: 'TRUE_DEFECT',
      expectedBlastTier: 'decorative',
      expectedMultiplier: 1.0,
      severity: 'high',
      description: 'Two catalog thumbnails out of 300 lack alt attributes',
    },
  ],
  invariants: [
    'Missing 2 thumbnail alts out of 300 images must deduct <= 2 points (accessibility score >= 98)',
    'Must NOT trigger catastrophic critical override cap or drop score below 95',
    'Target scope must resolve to images with decorative blast tier (weight 0.25)',
    'Violation density must equal 2/300 (0.0067) with low violation pressure (<0.10)',
  ],
  simulatedContext: {
    url: 'https://example.com/catalog',
    origin: 'https://example.com',
    hostname: 'example.com',
  },
  loadHtml: createHtmlLoader('03-decorative-alt-fail.html'),
};

export const architecturalPatternCase: CalibrationCase = {
  id: '04-architectural-pattern',
  caseNumber: 4,
  name: 'Architectural Pattern Corroboration',
  fixtureFile: '04-architectural-pattern.html',
  fixturePath: 'tests/fixtures/calibration/04-architectural-pattern.html',
  targetUrl: 'https://example.com/checkout?utm_source=google&gclid=12345xyz',
  description:
    'Page integrating dynamic third-party scripts (https://js.stripe.com/v3, Google Tag Manager) and canonical tag stripping ad tracking parameters (utm_source, gclid). Demonstrates ARCHITECTURAL_PATTERN corroboration with zero score deduction.',
  archetype: 'Fintech & Marketing Integration',
  primaryRealityState: 'ARCHITECTURAL_PATTERN',
  expectedRealityStates: {
    TRUE_DEFECT: 0,
    ARCHITECTURAL_PATTERN: 2,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 0,
  },
  expectedScores: {
    overall: { min: 100, max: 100, exact: 100 },
    security: { min: 100, max: 100 },
    seo: { min: 100, max: 100 },
  },
  expectedFindings: [
    {
      ruleId: 'sec-missing-sri-scripts',
      category: 'security',
      expectedStatus: 'passed',
      expectedRealityState: 'ARCHITECTURAL_PATTERN',
      expectedMultiplier: 0.0,
      severity: 'low',
      description: 'Dynamic third-party scripts (Stripe, GTM) reclassified to ARCHITECTURAL_PATTERN',
    },
    {
      ruleId: 'seo-canonical-matches',
      category: 'seo',
      expectedStatus: 'passed',
      expectedRealityState: 'ARCHITECTURAL_PATTERN',
      expectedMultiplier: 0.0,
      severity: 'low',
      description: 'Canonical tag stripping marketing query parameters consolidated to master page',
    },
  ],
  invariants: [
    'Dynamic vendor scripts (Stripe, GTM) without SRI must corroborate to ARCHITECTURAL_PATTERN with 0.0 multiplier',
    'Canonical URL stripping tracking parameters (utm_source, gclid) must corroborate to ARCHITECTURAL_PATTERN with 0.0 multiplier',
    'Zero score deduction from architectural pattern reclassifications (overall score remains 100)',
    'Reality multiplier must equal 0.0 for all corroborated architectural patterns',
  ],
  simulatedContext: {
    url: 'https://example.com/checkout?utm_source=google&gclid=12345xyz',
    origin: 'https://example.com',
    hostname: 'example.com',
  },
  loadHtml: createHtmlLoader('04-architectural-pattern.html'),
};

export const taoOpaqueLimitCase: CalibrationCase = {
  id: '05-tao-opaque-limit',
  caseNumber: 5,
  name: 'Timing-Allow-Origin & Opaque Limit',
  fixtureFile: '05-tao-opaque-limit.html',
  fixturePath: 'tests/fixtures/calibration/05-tao-opaque-limit.html',
  targetUrl: 'https://example.com/observability-limit',
  description:
    'Cross-origin assets lacking Timing-Allow-Origin headers and opaque platform boundaries. Demonstrates OBSERVABILITY_LIMIT classification that deducts from Telemetry Coverage Index (TCI) without penalizing category scores.',
  archetype: 'Cross-Origin Third-Party Mashup',
  primaryRealityState: 'OBSERVABILITY_LIMIT',
  expectedRealityStates: {
    TRUE_DEFECT: 0,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 1,
    SYNTHETIC_NOISE: 0,
  },
  expectedScores: {
    overall: { min: 100, max: 100 },
    performance: { min: 100, max: 100 },
    telemetryCoverageIndex: { min: 50, max: 90 },
  },
  expectedFindings: [
    {
      ruleId: 'perf-opaque-resources',
      category: 'performance',
      expectedStatus: 'not-available',
      expectedRealityState: 'OBSERVABILITY_LIMIT',
      expectedMultiplier: 0.0,
      severity: 'low',
      description: 'Cross-origin resource timings masked due to absent Timing-Allow-Origin header',
    },
  ],
  invariants: [
    'Missing TAO headers and cross-origin opacity must corroborate to OBSERVABILITY_LIMIT',
    'Observability limits must have realityMultiplier 0.0 and never deduct points from category scores',
    'Observability limits MUST reduce Telemetry Coverage Index (TCI < 100%)',
    'Unobservable assets must be explicitly accounted for rather than counted as 0-byte wire transfers',
  ],
  simulatedContext: {
    url: 'https://example.com/observability-limit',
    origin: 'https://example.com',
    hostname: 'example.com',
  },
  loadHtml: createHtmlLoader('05-tao-opaque-limit.html'),
};

export const fastSyntheticCssCase: CalibrationCase = {
  id: '06-fast-synthetic-css',
  caseNumber: 6,
  name: 'Fast Synthetic Render-Blocking CSS',
  fixtureFile: '06-fast-synthetic-css.html',
  fixturePath: 'tests/fixtures/calibration/06-fast-synthetic-css.html',
  targetUrl: 'https://example.com/fast-synthetic-css',
  description:
    'Page with a synchronous render-blocking stylesheet in head, but empirical paint metrics confirm fast rendering (FCP 620ms < 1000ms, LCP 1450ms < 2500ms). Demonstrates CWV reality gate downgrading static warnings to SYNTHETIC_NOISE.',
  archetype: 'Modern Server-Rendered Layout',
  primaryRealityState: 'SYNTHETIC_NOISE',
  expectedRealityStates: {
    TRUE_DEFECT: 0,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 1,
  },
  expectedScores: {
    overall: { min: 98, max: 100 },
    performance: { min: 98, max: 100 },
  },
  expectedFindings: [
    {
      ruleId: 'perf-render-blocking-resources',
      category: 'performance',
      expectedStatus: 'warning',
      expectedRealityState: 'SYNTHETIC_NOISE',
      expectedMultiplier: 0.05,
      severity: 'medium',
      description: 'Render-blocking CSS warning downgraded to SYNTHETIC_NOISE by fast CWV metrics',
    },
  ],
  invariants: [
    'Render-blocking stylesheet warning with fast CWV (FCP < 1000ms, LCP < 2500ms) must corroborate to SYNTHETIC_NOISE',
    'Reality multiplier must be 0.05, preventing false-positive performance score drop',
    'Performance score must remain >= 98 despite static render-blocking warning',
  ],
  simulatedContext: {
    url: 'https://example.com/fast-synthetic-css',
    origin: 'https://example.com',
    hostname: 'example.com',
    performance: {
      fcpMs: 620,
      lcpMs: 1450,
      clsScore: 0.01,
      ttfbMs: 120,
    },
  },
  loadHtml: createHtmlLoader('06-fast-synthetic-css.html'),
};

export const CALIBRATION_CASES: CalibrationCase[] = [
  cleanBaselineCase,
  criticalCheckoutFailCase,
  decorativeAltFailCase,
  architecturalPatternCase,
  taoOpaqueLimitCase,
  fastSyntheticCssCase,
];

export const CALIBRATION_CASES_BY_ID: Record<string, CalibrationCase> = {
  '01-clean-baseline': cleanBaselineCase,
  '02-critical-checkout-fail': criticalCheckoutFailCase,
  '03-decorative-alt-fail': decorativeAltFailCase,
  '04-architectural-pattern': architecturalPatternCase,
  '05-tao-opaque-limit': taoOpaqueLimitCase,
  '06-fast-synthetic-css': fastSyntheticCssCase,
};

export function getAllCalibrationCases(): CalibrationCase[] {
  return CALIBRATION_CASES;
}

export function getCalibrationCaseById(id: string): CalibrationCase | undefined {
  return CALIBRATION_CASES_BY_ID[id];
}
