/**
 * @file src/types/inspection.ts
 * @description Core domain contracts for inspection modes, collection results,
 * audit findings, severity levels, and aggregate website inspection records.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 8.
 */

/**
 * Inspection execution modes supported by the extension.
 * - `quick`: Fast inspection of active tab across 8 core modules.
 * - `full`: Comprehensive inspection including semantic DOM, structured data, CSS/JS, and axe-core a11y.
 * - `deep`: Full-page audit plus bounded same-origin crawl and external intelligence aggregation.
 */
export type InspectionMode = 'quick' | 'full' | 'deep';

/**
 * Execution status for an individual collection module.
 * - `completed`: All expected checks succeeded.
 * - `partial`: Some checks ran but others were blocked, unavailable, or restricted.
 * - `skipped`: Module was not included in the active inspection mode.
 * - `blocked`: Module was prevented from executing (e.g. CSP restrictions, missing permissions).
 * - `unsupported`: Feature is not supported by target browser or page context.
 * - `failed`: Module threw an unhandled error or timed out.
 */
export type CollectionStatus =
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'blocked'
  | 'unsupported'
  | 'failed';

/**
 * Finding severity rating mapped to explicit impact rules.
 * - `critical`: Severe security vulnerability or complete barrier to accessibility/functionality.
 * - `high`: Significant risk or major compliance/usability problem.
 * - `medium`: Material issue that should be remediated.
 * - `low`: Minor issue or improvement opportunity.
 * - `info`: Informational observation or neutral technical detail.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Verification status of an audit rule evaluation.
 * - `passed`: The evaluated check conformed to best practices.
 * - `failed`: The check detected an issue requiring remediation.
 * - `warning`: The check detected a potential concern or heuristic anomaly.
 * - `not-applicable`: The check does not apply to this page or context.
 * - `not-available`: The check could not be evaluated due to missing evidence or environmental limitation.
 */
export type FindingStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'info'
  | 'not-applicable'
  | 'not-available'
  | 'error';

/**
 * Concrete evidence item supporting an audit finding.
 * Secrets, passwords, authentication tokens, and user inputs MUST NEVER be stored in value.
 */
export interface Evidence {
  /** Concise human-readable label explaining what this evidence represents */
  label: string;
  /** Observable value (primitive, sanitized object, or redacted string) */
  value?: unknown;
  /** Originating collector, DOM selector, header name, or API source */
  source: string;
  /** Optional code location, line number, or CSS selector */
  location?: string;
  /** Epoch timestamp in milliseconds when evidence was observed */
  observedAt: number;
}

/**
 * Coverage metrics for a collection module run.
 */
export interface CollectionCoverage {
  /** Number of individual checks planned for this module */
  expected: number;
  /** Number of checks successfully executed and collected */
  collected: number;
  /** Number of checks that were blocked, restricted, or unavailable */
  unavailable: number;
  /** Whether the active browser/environment supports this module */
  supported?: boolean;
  /** Diagnostic explanation if coverage is partial or unsupported */
  message?: string;
}

/**
 * Generic envelope returned by all collection modules.
 * Guarantees that partial, blocked, and failed checks remain fully observable.
 */
export interface CollectionResult<T = unknown> {
  /** Unique module identifier (e.g. 'identity', 'dom', 'seo', 'security') */
  module: string;
  /** Execution status of this module */
  status: CollectionStatus;
  /** Epoch timestamp in milliseconds when collection completed */
  collectedAt: number;
  /** Strongly-typed module payload, or null if collection failed or was skipped */
  data: T | null;
  /** Quantitative coverage indicators */
  coverage: CollectionCoverage;
  /** Stated operational limitations (e.g. 'Closed shadow roots inaccessible') */
  limitations: string[];
  /** Error messages encountered during execution */
  errors: string[];
  /** List of data sources consulted (e.g. 'DOM', 'PerformanceObserver', 'DoH') */
  sources: string[];
}

/**
 * Normalized audit finding produced by analysis engines.
 */
export interface AuditFinding {
  /** Unique finding instance identifier (UUID or deterministic hash) */
  id: string;
  /** Finding category (e.g. 'security', 'seo', 'accessibility', 'performance', 'privacy') */
  category: string;
  /** Stable rule identifier used for grouping, filtering, and docs (e.g. 'SEC-HTTPS-001') */
  ruleId: string;
  /** Concise finding title */
  title: string;
  /** Comprehensive explanation of the finding and its impact */
  description: string;
  /** Severity level */
  severity: Severity;
  /** Evaluation status */
  status: FindingStatus;
  /** Confidence score between 0.0 and 1.0 (used strictly for heuristic detections) */
  confidence?: number;
  /** Array of verifiable evidence items */
  evidence: Evidence[];
  /** Expected standard, baseline, or specification behavior */
  expectedBehavior?: string;
  /** Detailed technical explanation of the issue and why it matters */
  explanation?: string;
  /** Actionable remediation advice */
  recommendation?: string;
  /** Primary source module that generated this finding */
  source: string;
  /** External specification or documentation references */
  references?: string[];
}

/**
 * Active website target metadata.
 */
export interface WebsiteTarget {
  /** Full normalized URL of the target page */
  url: string;
  /** Scheme, domain, and port origin string */
  origin: string;
  /** Hostname of the target website */
  hostname: string;
  /** Epoch timestamp in milliseconds when inspection commenced */
  inspectedAt: number;
}

/**
 * Browser runtime context information.
 */
export interface BrowserContextInfo {
  /** Browser family */
  name: 'chrome' | 'firefox';
  /** Browser user agent or version string */
  version?: string;
}

/**
 * High-level counts summarizing the inspection outcome.
 */
export interface InspectionSummary {
  /** Number of collection modules that completed successfully */
  completedModules: number;
  /** Number of modules that completed with partial coverage */
  partialModules: number;
  /** Number of modules that failed or were blocked */
  failedModules: number;
  /** Total count of generated findings */
  totalFindings: number;
  /** Count of findings that passed */
  passedFindings?: number;
  /** Count of warning findings */
  warningFindings?: number;
  /** Count of failed findings */
  failedFindings?: number;
  /** Count of informational findings */
  infoFindings?: number;
  /** Count of not-applicable findings */
  notApplicableFindings?: number;
  /** Count of error or unavailable findings */
  errorFindings?: number;
}

/**
 * Category score breakdown (0–100 scale).
 */
export interface CategoryScore {
  /** Category identifier (e.g. 'security', 'performance', 'seo', 'accessibility') */
  category: string;
  /** Computed score between 0 and 100 */
  score: number;
  /** Number of passed checks evaluated in this category */
  passed: number;
  /** Number of failed checks in this category */
  failed: number;
  /** Number of warning checks in this category */
  warnings: number;
  /** Total number of checks evaluated */
  totalChecks: number;
  /** Scoring weight allocated to this category */
  weight: number;
  /** Whether the score contains heuristic detections */
  isHeuristic?: boolean;
  /** Number of unobservable or unavailable checks */
  unavailable?: number;
  /** Number of checks not applicable to target context */
  notApplicableCount?: number;
  /** Evaluation coverage percentage (0-100) */
  coveragePercent?: number;
  /** Whether a confirmed critical failure exists */
  hasCriticalFailure?: boolean;
  /** Step-by-step point deductions or ceiling cap explanations */
  deductionsExplanation?: string[];
  /** Scoring formula description */
  scoringFormula?: string;
}

/**
 * Unified aggregate website inspection entity.
 * Root data structure held in memory for the active session.
 */
export interface WebsiteInspection {
  /** Unique inspection session identifier (UUID) */
  id: string;
  /** Inspection mode executed */
  mode: InspectionMode;
  /** Target page metadata */
  target: WebsiteTarget;
  /** Host browser runtime context */
  browser: BrowserContextInfo;
  /** Map of module identifiers to their respective collection results */
  modules: Record<string, CollectionResult<unknown>>;
  /** All audit findings generated across all analyzers */
  findings: AuditFinding[];
  /** High-level module and finding summary */
  summary: InspectionSummary;
  /** Optional category scores computed by scoring engine */
  scores?: Record<string, CategoryScore>;
  /** Epoch timestamp in milliseconds when inspection started */
  startedAt: number;
  /** Epoch timestamp in milliseconds when inspection completed */
  completedAt?: number;
}

/* ========================================================================= */
/* Individual Collection Module Payloads                                     */
/* ========================================================================= */

/** Page identity collector payload */
export interface IdentityData {
  url: string;
  origin: string;
  title: string;
  language?: string;
  charset?: string;
  viewport?: string;
  canonical?: string;
  canonicalUrl?: string;
  faviconUrl?: string;
}

export interface HeadingItem {
  level: number;
  text: string;
  id?: string;
}

export interface LandmarkItem {
  tag: string;
  role?: string;
  label?: string;
}

/** DOM and semantic structure collector payload */
export interface DomSemanticData {
  elementCount: number;
  headingHierarchy: HeadingItem[];
  landmarkElements: LandmarkItem[];
  hiddenNodeCount: number;
  customElementCount?: number;
  maxDomDepth: number;
  hasMainLandmark?: boolean;
  hasMultipleH1?: boolean;
  headingOrderValid?: boolean;
  customElementTags?: string[];
}

/** SEO and metadata collector payload */
export interface SeoData {
  title: string;
  titleLength: number;
  description?: string;
  descriptionLength: number;
  generator?: string;
  metaRobots?: string;
  metaRobotsDirectives?: string[] | {
    noindex: boolean;
    nofollow: boolean;
    noarchive: boolean;
    nosnippet: boolean;
  };
  canonicalUrl?: string;
  canonicalMatches: boolean;
  hreflangTags: Array<{ lang: string; href: string }>;
  openGraph: Record<string, string>;
  twitterCards: Record<string, string>;
  structuredDataCount: number;
}

/** Structured data individual item */
export interface StructuredDataSchemaItem {
  type: 'json-ld' | 'microdata' | 'rdfa';
  context?: string;
  schemaType?: string;
  rawSnippet?: string;
  valid: boolean;
  errors?: string[];
  topLevelProperties?: string[];
}

/** Structured data collector payload */
export interface StructuredDataInfo {
  schemas: StructuredDataSchemaItem[];
  totalFound: number;
  jsonLdCount?: number;
  microdataCount?: number;
  rdfaCount?: number;
  syntaxErrors?: string[];
}

/** Individual link item */
export interface LinkItem {
  url: string;
  text?: string;
  rel?: string;
  target?: string;
  isExternal?: boolean;
  isVulnerableTabnabbing?: boolean;
  isSecureProtocol?: boolean;
  hasNoopener?: boolean;
  hasNoreferrer?: boolean;
  hasNofollow?: boolean;
}

/** Links inventory collector payload */
export interface LinksData {
  totalLinks: number;
  internalLinks: LinkItem[];
  externalLinks: LinkItem[];
  invalidProtocols: string[];
  emptyHrefs: number;
  internalCount?: number;
  externalCount?: number;
  tabnabbingVulnerableCount?: number;
  protocolCounts?: Record<string, number>;
}

/** Individual image item */
export interface ImageItem {
  src: string;
  alt?: string;
  hasAlt: boolean;
  isLazy?: boolean;
  isLazyLoaded?: boolean;
  isDecorative?: boolean;
  width?: number;
  height?: number;
  format?: string;
  isBroken?: boolean;
}

/** Individual video item */
export interface VideoItem {
  src?: string;
  hasCaptions: boolean;
  autoplay: boolean;
  loop?: boolean;
  muted?: boolean;
  hasControls?: boolean;
}

/** Images and media collector payload */
export interface ImagesData {
  totalImages: number;
  missingAltCount: number;
  lazyLoadedCount: number;
  svgCount: number;
  brokenImages: string[];
  formats: Record<string, number>;
  images?: ImageItem[];
}

/** Audio and video collector payload */
export interface MediaData {
  audioCount: number;
  videoCount: number;
  missingCaptionsCount: number;
  autoplayCount: number;
  videos?: VideoItem[];
}

/** Individual stylesheet item */
export interface StylesheetItem {
  href?: string;
  isInline: boolean;
  isExternal?: boolean;
  hasSri?: boolean;
  domain?: string;
  media?: string;
  disabled?: boolean;
  isCrossOrigin?: boolean;
}

/** CSS and stylesheets collector payload */
export interface CssData {
  stylesheetCount: number;
  inlineStyleCount: number;
  customProperties?: string[];
  fontFamilies: string[];
  darkModeSupported: boolean;
  printStylesPresent: boolean;
  stylesheets?: StylesheetItem[];
  hasInlineStyleAttributes?: boolean | number;
}

/** Individual script item */
export interface ScriptItem {
  src?: string;
  isInline: boolean;
  isAsync: boolean;
  isDefer: boolean;
  isModule: boolean;
  isRenderBlocking: boolean;
  hasSri?: boolean;
  hasIntegrity?: boolean;
  domain?: string;
}

/** JavaScript resources collector payload */
export interface JavaScriptData {
  scriptCount: number;
  inlineScriptCount: number;
  asyncCount: number;
  deferCount: number;
  moduleCount: number;
  renderBlockingCount: number;
  externalDomains: string[];
  scripts?: ScriptItem[];
  sriCoverage?: {
    totalExternal: number;
    withSri: number;
  };
}

/** Form field item details */
export interface FormDetails {
  action: string;
  method: string;
  fieldCount: number;
  fieldTypes: string[];
  hasPasswordField: boolean;
  isSecureAction: boolean;
  fields?: unknown[];
  isCrossOriginAction?: boolean;
  hasCsrfToken?: boolean;
}

/** Form and input collector payload (strictly sanitized; zero values collected) */
export interface FormsData {
  formCount: number;
  forms: FormDetails[];
  containsUnencryptedSubmissions: boolean;
  hasPasswordForms?: boolean;
}

/** Performance metrics collector payload */
export interface PerformanceData {
  navigationTiming?: {
    dnsLookupMs: number;
    tcpConnectMs: number;
    tlsHandshakeMs?: number;
    ttfbMs: number;
    domLoadMs: number;
    fullLoadMs: number;
  };
  paintTiming?: {
    fcpMs?: number;
    fpMs?: number;
  };
  webVitals?: {
    lcpMs?: number;
    clsScore?: number;
    inpMs?: number;
  };
  resourceCount: number;
  transferSizeApprox?: number;
  resourceTypes?: Record<string, number>;
}

/** Security headers and signals collector payload */
export interface SecuritySignalsData {
  isHttps: boolean;
  mixedContentDetected?: boolean;
  sriScriptCoverage?: { total: number; withSri: number };
  sriLinkCoverage?: { total: number; withSri: number };
  upgradeInsecureRequests: boolean;
  securityHeaders?: Record<string, string | null>;
  cspPresent: boolean;
  hstsPresent: boolean;
  metaReferrerPolicy?: string;
  sriCoverage?: { totalExternal?: number; total?: number; withSri: number };
  mixedContentResources?: string[];
}

/** Privacy signals collector payload */
export interface PrivacySignalsData {
  consentBannerDetected: boolean;
  detectedCmp?: string;
  privacyPolicyLinks: string[];
  thirdPartyTrackers: string[];
  dntHonored?: boolean;
  storageTypesUsed: string[];
  trackerCount?: number;
  hasCookieNotice?: boolean;
}

/** Detected individual technology signature */
export interface DetectedTechnology {
  name: string;
  category: string;
  version?: string;
  confidence: number;
  evidence: string;
}

/** Technology fingerprinting payload */
export interface TechnologyData {
  technologies: DetectedTechnology[];
  categoriesFound?: string[];
}

/** Tap target evaluation metrics */
export interface TapTargetMetrics {
  total: number;
  undersized: number;
  undersizedSamples?: Array<{ tag: string; selector?: string; width: number; height: number }>;
}

/** Responsive and layout collector payload */
export interface ResponsiveData {
  hasViewportTag: boolean;
  viewportContent?: string;
  tapTargetsEvaluation?: TapTargetMetrics;
  horizontalOverflowDetected: boolean;
  wordCount?: number;
  textToHtmlRatio?: number;
  viewportValid?: boolean;
  allowsZoom?: boolean;
  overflowDeltaPx?: number;
}

/** Individual axe-core violation node */
export interface A11yViolationNode {
  target: string[];
  html?: string;
  failureSummary?: string;
}

/** Individual accessibility violation */
export interface A11yViolation {
  id: string;
  impact?: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags?: string[];
  nodesCount: number;
  nodes?: A11yViolationNode[];
}

/** axe-core accessibility evaluations payload */
export interface AccessibilityData {
  axeCoreEvaluated: boolean;
  axeVersion?: string;
  totalViolations: number;
  violationCountsByImpact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  passesCount: number;
  incompleteCount: number;
  inapplicableCount: number;
  violations: A11yViolation[];
}
