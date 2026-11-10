import { describe, it, expect } from 'vitest';
import { SeoAnalyzer } from '../src/analyzers/seo.analyzer';
import { MetadataCollector } from '../src/collectors/page/metadata.collector';
import { DomCollector } from '../src/collectors/page/dom.collector';
import type { AnalyzerContext } from '../src/analyzers/types';

describe('SEO & AEO Rules Evaluation (Option 2)', () => {
  it('MetadataCollector extracts author, timestamps, AI crawler directives, and llms.txt link', () => {
    const collector = new MetadataCollector();
    const doc = document.implementation.createHTMLDocument();
    doc.title = 'AEO Optimization Guide';

    const authorMeta = doc.createElement('meta');
    authorMeta.name = 'author';
    authorMeta.content = 'Dr. Jane Smith';
    doc.head.appendChild(authorMeta);

    const pubMeta = doc.createElement('meta');
    pubMeta.setAttribute('property', 'article:published_time');
    pubMeta.content = '2026-01-15T08:00:00Z';
    doc.head.appendChild(pubMeta);

    const modMeta = doc.createElement('meta');
    modMeta.setAttribute('property', 'article:modified_time');
    modMeta.content = '2026-02-10T12:00:00Z';
    doc.head.appendChild(modMeta);

    const robotsMeta = doc.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'index, follow, noai';
    doc.head.appendChild(robotsMeta);

    const llmsLink = doc.createElement('link');
    llmsLink.setAttribute('rel', 'llms-txt');
    llmsLink.setAttribute('href', '/llms.txt');
    doc.head.appendChild(llmsLink);

    const result = collector.collect({ document: doc });
    expect(result.data?.author).toBe('Dr. Jane Smith');
    expect(result.data?.articlePublishedTime).toBe('2026-01-15T08:00:00Z');
    expect(result.data?.articleModifiedTime).toBe('2026-02-10T12:00:00Z');
    expect(result.data?.hasNoAiDirective).toBe(true);
    expect(result.data?.hasLlmsTxtLink).toBe(true);
    expect(result.data?.llmsTxtUrl).toBe('/llms.txt');
  });

  it('SeoAnalyzer generates passing AEO findings when FAQ schema, question headings, and llms.txt exist', () => {
    const analyzer = new SeoAnalyzer();
    const context: AnalyzerContext = {
      mode: 'quick',
      target: {
        url: 'https://example.com/docs',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      modules: {
        metadata: {
          module: 'metadata',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 8, collected: 8, unavailable: 0, supported: true },
          data: {
            title: 'Documentation and Knowledge Base',
            titleLength: 35,
            description: 'Comprehensive documentation and answers for developers.',
            descriptionLength: 55,
            canonicalUrl: 'https://example.com/docs',
            canonicalMatches: true,
            hreflangTags: [],
            openGraph: {},
            twitterCards: {},
            structuredDataCount: 1,
            author: 'Engineering Team',
            hasNoAiDirective: false,
            hasLlmsTxtLink: true,
            llmsTxtUrl: 'https://example.com/llms.txt',
          },
        },
        structuredData: {
          module: 'structuredData',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          data: {
            schemas: [
              {
                type: 'json-ld',
                schemaType: 'FAQPage',
                valid: true,
                errors: [],
                warnings: [],
              },
            ],
            totalSchemas: 1,
            validSchemas: 1,
            invalidSchemas: 0,
            hasMicrodata: false,
            hasJsonLd: true,
            hasRdfa: false,
          },
        },
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          data: {
            elementCount: 120,
            maxDomDepth: 5,
            hiddenNodeCount: 0,
            landmarkElements: [],
            headingHierarchy: [
              { level: 1, text: 'Product Overview' },
              { level: 2, text: 'How does caching work?' },
              { level: 2, text: 'What is the pricing model?' },
            ],
          },
        },
      },
    };

    const findings = analyzer.analyze(context);

    const aeoFaq = findings.find((f) => f.ruleId === 'aeo-faq-schema');
    expect(aeoFaq).toBeDefined();
    expect(aeoFaq?.category).toBe('seo');
    expect(aeoFaq?.status).toBe('passed');

    const aeoLlms = findings.find((f) => f.ruleId === 'aeo-llms-txt');
    expect(aeoLlms).toBeDefined();
    expect(aeoLlms?.category).toBe('seo');
    expect(aeoLlms?.status).toBe('passed');

    const aeoCrawlers = findings.find((f) => f.ruleId === 'aeo-ai-crawlers');
    expect(aeoCrawlers).toBeDefined();
    expect(aeoCrawlers?.category).toBe('seo');
    expect(aeoCrawlers?.status).toBe('passed');

    const aeoHeadings = findings.find((f) => f.ruleId === 'aeo-question-headings');
    expect(aeoHeadings).toBeDefined();
    expect(aeoHeadings?.category).toBe('seo');
    expect(aeoHeadings?.status).toBe('passed');
  });

  it('SeoAnalyzer flags warnings when AI crawlers are blocked or FAQ schema is absent', () => {
    const analyzer = new SeoAnalyzer();
    const context: AnalyzerContext = {
      mode: 'quick',
      target: {
        url: 'https://example.com/private-blog',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      modules: {
        metadata: {
          module: 'metadata',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 8, collected: 8, unavailable: 0, supported: true },
          data: {
            title: 'Internal Insights',
            titleLength: 17,
            canonicalMatches: true,
            hreflangTags: [],
            openGraph: {},
            twitterCards: {},
            structuredDataCount: 0,
            hasNoAiDirective: true,
            hasLlmsTxtLink: false,
          },
        },
        structuredData: {
          module: 'structuredData',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          data: {
            schemas: [],
            totalSchemas: 0,
            validSchemas: 0,
            invalidSchemas: 0,
            hasMicrodata: false,
            hasJsonLd: false,
            hasRdfa: false,
          },
        },
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          data: {
            elementCount: 80,
            maxDomDepth: 4,
            hiddenNodeCount: 0,
            landmarkElements: [],
            headingHierarchy: [
              { level: 1, text: 'Internal Insights' },
              { level: 2, text: 'Updates' },
            ],
          },
        },
      },
    };

    const findings = analyzer.analyze(context);

    const aeoCrawlers = findings.find((f) => f.ruleId === 'aeo-ai-crawlers');
    expect(aeoCrawlers?.status).toBe('warning');

    const aeoFaq = findings.find((f) => f.ruleId === 'aeo-faq-schema');
    expect(aeoFaq?.status).toBe('warning');

    const aeoLlms = findings.find((f) => f.ruleId === 'aeo-llms-txt');
    expect(aeoLlms?.status).toBe('info');

    const aeoHeadings = findings.find((f) => f.ruleId === 'aeo-question-headings');
    expect(aeoHeadings?.status).toBe('info');
  });
});
