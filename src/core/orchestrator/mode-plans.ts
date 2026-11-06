/**
 * @file src/core/orchestrator/mode-plans.ts
 * @description Execution plans defining enabled collection modules, priorities,
 * timeouts, and coverage expectations for Quick Scan and Full Page Audit.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 4, 8.
 */

import type { InspectionMode } from '../../types/inspection';

export interface ModulePlanItem {
  /** Unique module identifier */
  id: string;
  /** Human-readable module name */
  name: string;
  /** Primary category grouping */
  category: 'identity' | 'seo' | 'security' | 'performance' | 'accessibility' | 'technology' | 'privacy' | 'content' | 'resources';
  /** Module execution timeout in milliseconds */
  timeoutMs: number;
  /** Allowed retry count on unexpected failure */
  retryCount: number;
  /** Execution priority (lower executes first: 1 = high priority, 10 = low priority) */
  priority: number;
  /** Whether this module performs heavy DOM/CPU operations (e.g. axe-core) */
  heavy?: boolean;
  /** Expected number of distinct checks/evaluations executed by this module */
  expectedChecks: number;
  /** Stated operational limitations */
  limitations: string[];
}

export interface ModePlan {
  mode: InspectionMode;
  name: string;
  description: string;
  modules: ModulePlanItem[];
  defaultTimeoutMs: number;
  maxConcurrency: number;
}

/** 8 Core Modules for Quick Scan */
export const QUICK_SCAN_MODULES: readonly ModulePlanItem[] = [
  {
    id: 'identity',
    name: 'Website Identity',
    category: 'identity',
    timeoutMs: 3000,
    retryCount: 0,
    priority: 1,
    expectedChecks: 8,
    limitations: ['Some metadata tags may be omitted by author'],
  },
  {
    id: 'dom',
    name: 'DOM & Semantic Structure',
    category: 'content',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 2,
    expectedChecks: 6,
    limitations: ['Closed shadow roots are inaccessible'],
  },
  {
    id: 'metadata',
    name: 'SEO Essentials',
    category: 'seo',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 3,
    expectedChecks: 8,
    limitations: ['Search ranking performance cannot be inferred'],
  },
  {
    id: 'links',
    name: 'Links Inventory',
    category: 'resources',
    timeoutMs: 5000,
    retryCount: 0,
    priority: 4,
    expectedChecks: 5,
    limitations: ['Link presence does not verify destination server reachability'],
  },
  {
    id: 'media',
    name: 'Images & Media Summary',
    category: 'resources',
    timeoutMs: 5000,
    retryCount: 0,
    priority: 5,
    expectedChecks: 6,
    limitations: ['Cross-origin image natural dimensions may be restricted by CORS'],
  },
  {
    id: 'styles',
    name: 'CSS & Style Analysis',
    category: 'resources',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 5,
    expectedChecks: 6,
    limitations: ['Cross-origin stylesheets without CORS headers cannot be inspected via CSSOM'],
  },
  {
    id: 'scripts',
    name: 'JavaScript Resources',
    category: 'resources',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 5,
    expectedChecks: 7,
    limitations: ['Dynamic eval or code-split bundles loaded after inspection are not detected'],
  },
  {
    id: 'technology',
    name: 'Technology Fingerprinting',
    category: 'technology',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 6,
    expectedChecks: 5,
    limitations: ['Technology detection is heuristic based on observable DOM/script signatures'],
  },
  {
    id: 'performance',
    name: 'Performance Metrics',
    category: 'performance',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 7,
    expectedChecks: 6,
    limitations: ['Navigation Timing reflects browser rendering context at time of inspection'],
  },
  {
    id: 'security',
    name: 'Security Indicators',
    category: 'security',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 8,
    expectedChecks: 8,
    limitations: ['HTTP response headers might not be observable in content script context'],
  },
] as const;

/** Additional In-Depth Modules for Full Page Audit */
export const FULL_AUDIT_ADDITIONAL_MODULES: readonly ModulePlanItem[] = [
  {
    id: 'structuredData',
    name: 'Structured Data (Schema.org)',
    category: 'seo',
    timeoutMs: 5000,
    retryCount: 0,
    priority: 4,
    expectedChecks: 5,
    limitations: ['Syntax validity does not guarantee Google Rich Result eligibility'],
  },
  {
    id: 'forms',
    name: 'Forms & Inputs Security',
    category: 'security',
    timeoutMs: 4000,
    retryCount: 0,
    priority: 6,
    expectedChecks: 6,
    limitations: ['User input values and passwords are never collected or observed'],
  },
  {
    id: 'privacy',
    name: 'Privacy & Tracker Signals',
    category: 'privacy',
    timeoutMs: 5000,
    retryCount: 0,
    priority: 7,
    expectedChecks: 5,
    limitations: ['Backend data handling and tracker network behavior cannot be confirmed from page alone'],
  },
  {
    id: 'responsive',
    name: 'Responsive & Layout Ergonomics',
    category: 'content',
    timeoutMs: 5000,
    retryCount: 0,
    priority: 8,
    expectedChecks: 6,
    limitations: ['Touch target analysis reflects active viewport dimensions at inspection time'],
  },
  {
    id: 'accessibility',
    name: 'axe-core Accessibility Audit',
    category: 'accessibility',
    timeoutMs: 12000,
    retryCount: 0,
    priority: 10,
    heavy: true,
    expectedChecks: 15,
    limitations: ['Automated axe-core rules cover 30–50% of WCAG criteria; human review is required for full conformance.'],
  },
] as const;

export function getModePlan(mode: InspectionMode): ModePlan {
  switch (mode) {
    case 'quick':
      return {
        mode: 'quick',
        name: 'Quick Scan',
        description: 'Fast, passive inspection across 8 core modules for active website overview',
        modules: [...QUICK_SCAN_MODULES],
        defaultTimeoutMs: 5000,
        maxConcurrency: 3,
      };

    case 'full':
      return {
        mode: 'full',
        name: 'Full Page Audit',
        description: 'Comprehensive active-tab audit including structured data, CSS/JS resources, and axe-core accessibility evaluations',
        modules: [...QUICK_SCAN_MODULES, ...FULL_AUDIT_ADDITIONAL_MODULES].sort((a, b) => a.priority - b.priority),
        defaultTimeoutMs: 5000,
        maxConcurrency: 3,
      };

    case 'deep':
      return {
        mode: 'deep',
        name: 'Website Deep Inspection',
        description: 'Full page audit combined with bounded same-origin crawler and external intelligence',
        modules: [...QUICK_SCAN_MODULES, ...FULL_AUDIT_ADDITIONAL_MODULES].sort((a, b) => a.priority - b.priority),
        defaultTimeoutMs: 15000,
        maxConcurrency: 2,
      };

    default:
      throw new Error(`Unsupported inspection mode: ${mode}`);
  }
}
