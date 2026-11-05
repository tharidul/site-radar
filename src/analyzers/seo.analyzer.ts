/**
 * @file src/analyzers/seo.analyzer.ts
 * @description Evaluates SEO metadata, title, meta description, robots directives, canonical tags,
 * heading hierarchy, and structured data schemas with context-aware calibration.
 */

import type { AuditFinding, SeoData, DomSemanticData, StructuredDataInfo } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class SeoAnalyzer implements Analyzer {
  readonly id = 'seo-analyzer';
  readonly category = 'seo';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { target, modules } = context;

    const seoRes = getModuleData<SeoData>(modules, 'metadata', 'seo');
    const seoData = seoRes.data;

    if (!seoData) {
      findings.push(
        new FindingBuilder('seo-title-present')
          .setStatus('not-available')
          .addEvidence('Reason', seoRes.unavailableReason || 'Metadata module unavailable')
          .build(),
        new FindingBuilder('seo-meta-description')
          .setStatus('not-available')
          .addEvidence('Reason', seoRes.unavailableReason || 'Metadata module unavailable')
          .build(),
        new FindingBuilder('seo-canonical-matches')
          .setStatus('not-available')
          .addEvidence('Reason', seoRes.unavailableReason || 'Metadata module unavailable')
          .build(),
      );
    } else {
      // 1. Document Title
      const title = seoData.title?.trim();
      if (!title) {
        findings.push(
          new FindingBuilder('seo-title-present')
            .setStatus('failed')
            .setSeverity('high')
            .setConfidence(1.0)
            .addEvidence('Title', 'Missing or empty')
            .setExpectedBehavior('Document contains an informative <title> tag in <head>.')
            .setExplanation('Pages lacking a title tag fail to provide search engines with a primary headline.')
            .build(),
        );
      } else if (title.length < 5) {
        findings.push(
          new FindingBuilder('seo-title-present')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.9)
            .addEvidence('Title', title)
            .addEvidence('Character Count', title.length)
            .setExpectedBehavior('Title length should ideally be between 10 and 70 characters.')
            .setExplanation('Very short titles may not provide sufficient context for search engine snippets.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('seo-title-present')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Title', title)
            .addEvidence('Character Count', title.length)
            .build(),
        );
      }

      // 2. Meta Description
      const desc = seoData.description?.trim();
      if (!desc) {
        findings.push(
          new FindingBuilder('seo-meta-description')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(1.0)
            .addEvidence('Meta Description', 'None specified')
            .setExpectedBehavior('Page provides a concise meta description summarizing content.')
            .setExplanation('When meta description is omitted, search engines automatically generate snippets from page text.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('seo-meta-description')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Description', desc)
            .addEvidence('Character Count', desc.length)
            .build(),
        );
      }

      // 3. Robots Directives (Calibrated: noindex on utility/search pages is intentional, not a failure)
      const robots = seoData.metaRobotsDirectives;
      const isNoindex = Array.isArray(robots) ? robots.includes('noindex') : Boolean(robots?.noindex);
      const isNofollow = Array.isArray(robots) ? robots.includes('nofollow') : Boolean(robots?.nofollow);

      if (isNoindex) {
        findings.push(
          new FindingBuilder('seo-meta-robots-noindex')
            .setStatus('info')
            .setSeverity('info')
            .setConfidence(1.0)
            .addEvidence('Robots Directive', 'noindex')
            .setExpectedBehavior('Robots directives reflect intended indexing policy.')
            .setExplanation('This page declares noindex, instructing search crawlers not to index it. This is standard for search results, account portals, and utility pages.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('seo-meta-robots-noindex')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Indexing Allowed', true)
            .build(),
        );
      }

      if (isNofollow) {
        findings.push(
          new FindingBuilder('seo-meta-robots-nofollow')
            .setStatus('info')
            .setSeverity('info')
            .setConfidence(1.0)
            .addEvidence('Robots Directive', 'nofollow')
            .setExpectedBehavior('Robots follow directives reflect intended crawling policy.')
            .setExplanation('Page instructs search engines not to crawl outgoing links.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('seo-meta-robots-nofollow')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Links Followable', true)
            .build(),
        );
      }

      // 4. Canonical URL
      const canonical = seoData.canonicalUrl;
      if (!canonical) {
        findings.push(
          new FindingBuilder('seo-canonical-matches')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(1.0)
            .addEvidence('Canonical URL', 'Missing')
            .setExpectedBehavior('Document declares an authoritative rel="canonical" link tag.')
            .setExplanation('Canonical URLs help search engines prevent duplicate content indexing.')
            .build(),
        );
      } else {
        const canonicalMatches = Boolean(seoData.canonicalMatches);
        if (canonicalMatches) {
          findings.push(
            new FindingBuilder('seo-canonical-matches')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Canonical Matches Target URL', true)
              .addEvidence('Canonical URL', canonical)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('seo-canonical-matches')
              .setStatus('warning')
              .setSeverity('low')
              .setConfidence(0.9)
              .addEvidence('Target URL', target.url)
              .addEvidence('Declared Canonical URL', canonical)
              .setExpectedBehavior('Canonical URL matches the preferred master representation of this page.')
              .setExplanation('Canonical tag points to an alternate URL, indicating consolidation of ranking signals.')
              .build(),
          );
        }
      }
    }

    // 5. Heading Hierarchy (Calibrated for minimalist apps & homepages)
    const domRes = getModuleData<DomSemanticData>(modules, 'dom');
    if (domRes.data?.headingHierarchy) {
      const h1Count = domRes.data.headingHierarchy.filter((h) => h.level === 1).length;
      if (h1Count === 0) {
        // Minimalist homepages or search interfaces (e.g. google.com) may lack an H1 without SEO harm
        const isMinimalOrSearch = target.hostname.includes('google.') || (domRes.data.elementCount && domRes.data.elementCount < 60);
        findings.push(
          new FindingBuilder('seo-heading-hierarchy')
            .setStatus(isMinimalOrSearch ? 'info' : 'warning')
            .setSeverity('low')
            .setConfidence(0.8)
            .addEvidence('H1 Headings Found', 0)
            .setExpectedBehavior('Document outline typically includes a primary <h1> heading.')
            .setExplanation(isMinimalOrSearch ? 'Minimalist application or search interface does not require an H1.' : 'No <h1> heading tag was detected in document outline.')
            .build(),
        );
      } else if (h1Count > 1) {
        findings.push(
          new FindingBuilder('seo-heading-hierarchy')
            .setStatus('passed')
            .setConfidence(0.9)
            .addEvidence('H1 Count', h1Count)
            .addEvidence('Outline Structure', 'Multiple section headings (valid in HTML5 outline)')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('seo-heading-hierarchy')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('H1 Count', 1)
            .build(),
        );
      }
    }

    // 6. Structured Data
    const sdRes = getModuleData<StructuredDataInfo>(modules, 'structuredData');
    if (sdRes.data?.schemas && sdRes.data.schemas.length > 0) {
      findings.push(
        new FindingBuilder('seo-structured-data-missing')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Schema Count', sdRes.data.schemas.length)
          .addEvidence('Schema Types', sdRes.data.schemas.map((s) => s.type).join(', '))
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('seo-structured-data-missing')
          .setStatus('info')
          .setSeverity('low')
          .setConfidence(0.85)
          .addEvidence('Structured Data', 'No Schema.org JSON-LD or Microdata markup detected')
          .setExpectedBehavior('Add Schema.org structured data where rich search results are beneficial.')
          .build(),
      );
    }

    return findings;
  }
}
