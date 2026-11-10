
export type InspectionMode = 'quick' | 'full' | 'deep';

export type CollectionStatus =
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'blocked'
  | 'unsupported'
  | 'failed';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'info'
  | 'not-applicable'
  | 'not-available'
  | 'error';

export interface Evidence {
  label: string;
  value?: unknown;
  source: string;
  location?: string;
  observedAt: number;
}

export interface CollectionCoverage {
  expected: number;
  collected: number;
  unavailable: number;
  supported?: boolean;
  message?: string;
}

export interface CollectionResult<T = unknown> {
  module: string;
  status: CollectionStatus;
  collectedAt: number;
  data: T | null;
  coverage: CollectionCoverage;
  limitations: string[];
  errors: string[];
  sources: string[];
}

export interface AuditFinding {
  id: string;
  category: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  status: FindingStatus;
  confidence?: number;
  evidence: Evidence[];
  expectedBehavior?: string;
  explanation?: string;
  recommendation?: string;
  source: string;
  references?: string[];
}

export interface WebsiteTarget {
  url: string;
  origin: string;
  hostname: string;
  inspectedAt: number;
}

export interface BrowserContextInfo {
  name: 'chrome' | 'firefox';
  version?: string;
}

export interface InspectionSummary {
  completedModules: number;
  partialModules: number;
  failedModules: number;
  totalFindings: number;
  passedFindings?: number;
  warningFindings?: number;
  failedFindings?: number;
  infoFindings?: number;
  notApplicableFindings?: number;
  errorFindings?: number;
}

export interface CategoryScore {
  category: string;
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  totalChecks: number;
  weight: number;
  isHeuristic?: boolean;
  unavailable?: number;
  notApplicableCount?: number;
  coveragePercent?: number;
  hasCriticalFailure?: boolean;
  deductionsExplanation?: string[];
  scoringFormula?: string;
}

export interface WebsiteInspection {
  id: string;
  mode: InspectionMode;
  target: WebsiteTarget;
  browser: BrowserContextInfo;
  modules: Record<string, CollectionResult<unknown>>;
  findings: AuditFinding[];
  summary: InspectionSummary;
  scores?: Record<string, CategoryScore>;
  startedAt: number;
  completedAt?: number;
}

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
  tablesCount?: number;
  listsCount?: number;
  definitionListsCount?: number;
  nonSemanticClickableCount?: number;
  nativeButtonsCount?: number;
  nonSemanticClickableSamples?: string[];
}

export interface SeoData {
  title: string;
  titleLength: number;
  description?: string;
  descriptionLength: number;
  keywords?: string;
  keywordsList?: string[];
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
  author?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  hasNoAiDirective?: boolean;
  hasLlmsTxtLink?: boolean;
  llmsTxtUrl?: string;
}

export interface StructuredDataSchemaItem {
  type: 'json-ld' | 'microdata' | 'rdfa';
  context?: string;
  schemaType?: string;
  rawSnippet?: string;
  valid: boolean;
  errors?: string[];
  topLevelProperties?: string[];
}

export interface StructuredDataInfo {
  schemas: StructuredDataSchemaItem[];
  totalFound: number;
  jsonLdCount?: number;
  microdataCount?: number;
  rdfaCount?: number;
  syntaxErrors?: string[];
}

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

export interface VideoItem {
  src?: string;
  hasCaptions: boolean;
  autoplay: boolean;
  loop?: boolean;
  muted?: boolean;
  hasControls?: boolean;
}

export interface ImagesData {
  totalImages: number;
  missingAltCount: number;
  lazyLoadedCount: number;
  svgCount: number;
  brokenImages: string[];
  formats: Record<string, number>;
  images?: ImageItem[];
}

export interface MediaData {
  audioCount: number;
  videoCount: number;
  missingCaptionsCount: number;
  autoplayCount: number;
  videos?: VideoItem[];
}

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

export interface FormsData {
  formCount: number;
  forms: FormDetails[];
  containsUnencryptedSubmissions: boolean;
  hasPasswordForms?: boolean;
  totalInputCount?: number;
  unlabeledInputCount?: number;
  autocompleteInputCount?: number;
  unlabeledInputSamples?: string[];
}

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
  decodedSizeApprox?: number;
  resourceTypes?: Record<string, number>;
  scrolledTransferSizeApprox?: number;
  scrolledResourceCount?: number;
  scrolledDecodedSizeApprox?: number;
  isInfiniteScrollDetected?: boolean;
}

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

export interface DetectedTechnology {
  name: string;
  category: string;
  version?: string;
  confidence: number;
  evidence: string;
}

export interface TechnologyData {
  technologies: DetectedTechnology[];
  categoriesFound?: string[];
}

export interface TapTargetMetrics {
  total: number;
  undersized: number;
  undersizedSamples?: Array<{ tag: string; selector?: string; width: number; height: number }>;
}

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

export interface A11yViolationNode {
  target: string[];
  html?: string;
  failureSummary?: string;
}

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
