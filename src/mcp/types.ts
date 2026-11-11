import type { AuditFinding, CategoryScore, InspectionSummary, ResponseHeadersData, TechnologyData } from '../types/inspection';

export interface AuditToolResult {
  target: {
    url: string;
    origin: string;
    hostname: string;
    inspectedAt: string;
  };
  overallScore: number;
  scores: Record<string, CategoryScore>;
  summary: InspectionSummary;
  topIssues: AuditFinding[];
  technologies: TechnologyData['technologies'];
  markdownReport: string;
  findings: AuditFinding[];
}

export interface HeaderAuditResult {
  url: string;
  statusCode: number;
  statusText: string;
  securityScore: number;
  passedHeaders: string[];
  missingSecurityHeaders: ResponseHeadersData['missingSecurityHeaders'];
  leaks: ResponseHeadersData['leaks'];
  categorizedHeaders: ResponseHeadersData['categorizedHeaders'];
  markdownReport: string;
}

export interface SeoAuditResult {
  url: string;
  score: number;
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  headingsSummary: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
  };
  structuredDataCount: number;
  aiCrawlerStatus?: string;
  hasLlmsTxt?: boolean;
  findings: AuditFinding[];
  markdownReport: string;
}

export interface TechDetectResult {
  url: string;
  technologies: TechnologyData['technologies'];
  frameworks: string[];
  cssFrameworks: string[];
  servers: string[];
  cdns: string[];
  markdownReport: string;
}

export interface AccessibilityAuditResult {
  url: string;
  score: number;
  totalViolations: number;
  passesCount: number;
  violationsByImpact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  axeViolations: Array<{
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    nodesCount: number;
  }>;
  findings: AuditFinding[];
  markdownReport: string;
}

