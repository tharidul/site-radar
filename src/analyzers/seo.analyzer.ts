
import type { AuditFinding, SeoData, DomSemanticData, StructuredDataInfo } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';
import { isLocalDevelopmentHost } from '../security/private-network.guard';

export class SeoAnalyzer implements Analyzer {
  readonly id = 'seo-analyzer';
  readonly category = 'seo';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { target, modules } = context;
    const isLocalDev = Boolean(target.isLocalDevelopment ?? isLocalDevelopmentHost(target.hostname));

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
        } else if (isLocalDev && (canonical.startsWith('https://') || canonical.startsWith('http://'))) {
          findings.push(
            new FindingBuilder('seo-canonical-matches')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Development Target', target.url)
              .addEvidence('Production Canonical URL', canonical)
              .setExpectedBehavior('Canonical URL matches the preferred master representation of this page.')
              .setExplanation('Canonical URL correctly points to the authoritative production domain from local development environment.')
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

    const domRes = getModuleData<DomSemanticData>(modules, 'dom');
    if (domRes.data?.headingHierarchy) {
      const h1Count = domRes.data.headingHierarchy.filter((h) => h.level === 1).length;
      if (h1Count === 0) {
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

    const schemas = sdRes.data?.schemas || [];
    const faqOrQASchemas = schemas.filter((s) => {
      const t = (s.schemaType || '').toLowerCase();
      return t.includes('faqpage') || t.includes('qapage') || t.includes('howto');
    });

    if (faqOrQASchemas.length > 0) {
      findings.push(
        new FindingBuilder('aeo-faq-schema')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Schema Types', faqOrQASchemas.map((s) => s.schemaType || s.type).join(', '))
          .addEvidence('Valid Schemas', faqOrQASchemas.filter((s) => s.valid).length)
          .build(),
      );
    } else if (schemas.length > 0) {
      findings.push(
        new FindingBuilder('aeo-faq-schema')
          .setStatus('info')
          .setSeverity('low')
          .setConfidence(0.9)
          .addEvidence('Existing Schemas', schemas.map((s) => s.schemaType || s.type).join(', '))
          .setExpectedBehavior('Add FAQPage or QAPage schema markup alongside existing schemas.')
          .setExplanation('While general structured data exists, explicit FAQPage/QAPage schemas provide direct question-answer pairs for AI engine citation.')
          .setRecommendation('Add Schema.org FAQPage JSON-LD markup to provide direct answers for AI citations.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('aeo-faq-schema')
          .setStatus('info')
          .setSeverity('low')
          .setConfidence(0.85)
          .addEvidence('Q&A Schemas', 'None declared')
          .setExpectedBehavior('Include FAQPage or HowTo JSON-LD schema for LLM direct-answer citation where relevant.')
          .setExplanation('AI search engines (Perplexity, ChatGPT, Gemini) prioritize pages declaring structured FAQ/Q&A data for rich answer cards.')
          .setRecommendation('Add Schema.org FAQPage markup with top user questions and concise answers if the page provides instructional or FAQ content.')
          .build(),
      );
    }

    const hasLlms = Boolean(seoData?.hasLlmsTxtLink);
    if (hasLlms) {
      findings.push(
        new FindingBuilder('aeo-llms-txt')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('LLMs.txt Declared', true)
          .addEvidence('Target Link', seoData?.llmsTxtUrl || '/llms.txt')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('aeo-llms-txt')
          .setStatus('info')
          .setSeverity('info')
          .setConfidence(0.85)
          .addEvidence('Standard', '/llms.txt standard manifest not declared in document head')
          .setExpectedBehavior('Provide an /llms.txt markdown standard file at domain root or link rel="llms-txt".')
          .setExplanation('The /llms.txt standard helps LLM agents and AI search tools discover clean markdown representations of key site content.')
          .setRecommendation('Publish an /llms.txt file at your website root with concise summaries and links to documentation.')
          .build(),
      );
    }

    const hasNoAi = Boolean(seoData?.hasNoAiDirective);
    const robotsDirectives = seoData?.metaRobotsDirectives;
    const isNoIndex = Array.isArray(robotsDirectives)
      ? robotsDirectives.includes('noindex')
      : Boolean(robotsDirectives?.noindex);

    if (hasNoAi) {
      findings.push(
        new FindingBuilder('aeo-ai-crawlers')
          .setStatus('warning')
          .setSeverity('medium')
          .setConfidence(1.0)
          .addEvidence('AI Directive', 'noai or blocking crawler directive declared')
          .setExpectedBehavior('Page allows AI search crawlers unless content is intentionally restricted.')
          .setExplanation('The page includes a "noai" or AI-crawler blocking directive, preventing ChatGPT, Gemini, and Claude from referencing this page.')
          .setRecommendation('Remove "noai" or crawler exclusions if you want content featured in AI summaries.')
          .build(),
      );
    } else if (isNoIndex) {
      findings.push(
        new FindingBuilder('aeo-ai-crawlers')
          .setStatus('info')
          .setSeverity('low')
          .setConfidence(0.9)
          .addEvidence('Robots Directive', 'noindex')
          .setExplanation('Page declares noindex, which implicitly blocks search retrieval and AI citation engines.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('aeo-ai-crawlers')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('AI Crawlers Allowed', true)
          .addEvidence('Retrieval Status', 'Open to LLM indexers (GPTBot, ClaudeBot, Google-Extended)')
          .build(),
      );
    }

    if (domRes.data?.headingHierarchy) {
      const headings = domRes.data.headingHierarchy;
      const questionRegex = /^(what|how|why|who|where|when|can|is|does|are|which|top|best|should)\b/i;
      const questionHeadings = headings.filter(
        (h) => questionRegex.test(h.text.trim()) || h.text.trim().endsWith('?')
      );

      if (questionHeadings.length >= 2) {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Question Headings Count', questionHeadings.length)
            .addEvidence('Sample Queries', questionHeadings.slice(0, 3).map((h) => `H${h.level}: ${h.text}`).join(' • '))
            .build(),
        );
      } else if (questionHeadings.length === 1 && questionHeadings[0]) {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setStatus('passed')
            .setConfidence(0.9)
            .addEvidence('Question Headings Count', 1)
            .addEvidence('Heading', questionHeadings[0].text)
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setStatus('info')
            .setSeverity('low')
            .setConfidence(0.85)
            .addEvidence('Question Headings Found', 0)
            .setExpectedBehavior('Include 1–2 natural query headings (e.g. "What is...", "How to...") to target AI conversational search.')
            .setExplanation('Natural question-formatted headings help AI Overviews and answer engines pinpoint direct extractable snippets.')
            .setRecommendation('Format relevant subheadings as conversational questions matching common user search queries.')
            .build(),
        );
      }
    }

    return findings;
  }
}
