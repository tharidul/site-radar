import type {
  AuditFinding,
  DomSemanticData,
  FormsData,
  SeoData,
  StructuredDataInfo,
} from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class AeoAnalyzer implements Analyzer {
  readonly id = 'aeo-analyzer';
  readonly category = 'aeo';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules } = context;

    // 1. Agentic Form Labels & Autocomplete Tokens
    const formsRes = getModuleData<FormsData>(modules, 'forms');
    const totalInputs = formsRes.data?.totalInputCount ?? 0;
    const unlabeledInputs = formsRes.data?.unlabeledInputCount ?? 0;
    const autocompleteInputs = formsRes.data?.autocompleteInputCount ?? 0;
    const unlabeledSamples = formsRes.data?.unlabeledInputSamples || [];

    if (totalInputs === 0) {
      findings.push(
        new FindingBuilder('ago-form-labels')
          .setCategory('aeo')
          .setStatus('not-applicable')
          .setConfidence(1.0)
          .addEvidence('Form Inputs', 0)
          .build(),
      );
    } else if (unlabeledInputs > 0) {
      findings.push(
        new FindingBuilder('ago-form-labels')
          .setCategory('aeo')
          .setStatus('warning')
          .setSeverity('medium')
          .setConfidence(1.0)
          .addEvidence('Total Editable Inputs', totalInputs)
          .addEvidence('Inputs Missing Accessible Labels', unlabeledInputs)
          .addEvidence('Unlabeled Field Samples', unlabeledSamples.join(', '))
          .setExpectedBehavior('All interactive inputs have an associated <label for="...">, aria-label, or title.')
          .setExplanation(
            'Autonomous AI agents (such as Claude Computer Use, OpenAI Operator, and agentic autofill bots) parse accessibility labels to identify and populate input fields. Missing labels cause agents to misfill or fail submissions.',
          )
          .setRecommendation('Add explicit <label for="id"> tags or aria-label attributes to all interactive form controls.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('ago-form-labels')
          .setCategory('aeo')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Total Labeled Inputs', `${totalInputs}/${totalInputs}`)
          .addEvidence('Autocomplete Configured', `${autocompleteInputs}/${totalInputs}`)
          .build(),
      );
    }

    // 2. Semantic Action Targets (Buttons vs Clickable DIVs) & DOM Complexity
    const domRes = getModuleData<DomSemanticData>(modules, 'dom');
    if (domRes.data) {
      const nonSemanticCount = domRes.data.nonSemanticClickableCount ?? 0;
      const nativeButtons = domRes.data.nativeButtonsCount ?? 0;
      const nonSemanticSamples = domRes.data.nonSemanticClickableSamples || [];

      if (nonSemanticCount > 0) {
        findings.push(
          new FindingBuilder('ago-interactive-elements')
            .setCategory('aeo')
            .setStatus('warning')
            .setSeverity('medium')
            .setConfidence(0.9)
            .addEvidence('Non-semantic Clickable Elements', nonSemanticCount)
            .addEvidence('Native Buttons / Action Links', nativeButtons)
            .addEvidence('Non-semantic Samples', nonSemanticSamples.join(', '))
            .setExpectedBehavior('Click targets should use native <button> or <a> tags or declare role="button" with tabindex="0".')
            .setExplanation(
              'Autonomous browser agents discover actionable elements through the accessibility tree. Clickable <div> or <span> elements without role="button" and tabindex="0" are invisible or unreliable to AI agent action drivers.',
            )
            .setRecommendation(
              'Replace custom clickable <div>/<span> elements with native <button> tags or apply role="button" with tabindex="0" and keyboard enter/space event handlers.',
            )
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('ago-interactive-elements')
            .setCategory('aeo')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Non-semantic Clickables Detected', 0)
            .addEvidence('Semantic Action Targets', nativeButtons)
            .build(),
        );
      }

      const maxDepth = domRes.data.maxDomDepth ?? 0;
      const elementCount = domRes.data.elementCount ?? 0;

      if (maxDepth > 32 || elementCount > 2000) {
        const bloatReasons: string[] = [];
        if (maxDepth > 32) bloatReasons.push(`deeply nested wrapper hierarchies (${maxDepth} > 32 levels)`);
        if (elementCount > 2000) bloatReasons.push(`bloated node trees (${elementCount} > 2,000 elements)`);
        findings.push(
          new FindingBuilder('ago-dom-token-bloat')
            .setCategory('aeo')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.9)
            .addEvidence('Max DOM Nesting Depth', `${maxDepth} (Threshold: <= 32)`)
            .addEvidence('Total DOM Elements', `${elementCount} (Threshold: <= 2000)`)
            .setExpectedBehavior('Keep DOM nesting depth under 32 levels and total elements under 2,000 for efficient AI agent parsing.')
            .setExplanation(
              `Excessive DOM complexity (${bloatReasons.join(' and ')}) consumes excessive token context when parsed by AI agent vision and accessibility drivers, risking prompt truncation and slower agent response times.`,
            )
            .setRecommendation(
              'Flatten wrapper <div> nesting and implement virtualized scrolling or clean component structures to keep agent DOM parsing lightweight.',
            )
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('ago-dom-token-bloat')
            .setCategory('aeo')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Max DOM Nesting Depth', `${maxDepth} (Optimal <= 32)`)
            .addEvidence('Total DOM Elements', `${elementCount} (Optimal <= 2000)`)
            .build(),
        );
      }
    }

    // 3. AEO FAQ & Q&A Schema Markup
    const sdRes = getModuleData<StructuredDataInfo>(modules, 'structuredData');
    const schemas = sdRes.data?.schemas || [];
    const faqOrQASchemas = schemas.filter((s) => {
      const t = (s.schemaType || '').toLowerCase();
      return t.includes('faqpage') || t.includes('qapage') || t.includes('howto');
    });

    if (faqOrQASchemas.length > 0) {
      findings.push(
        new FindingBuilder('aeo-faq-schema')
          .setCategory('aeo')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Schema Types', faqOrQASchemas.map((s) => s.schemaType || s.type).join(', '))
          .addEvidence('Valid Schemas', faqOrQASchemas.filter((s) => s.valid).length)
          .build(),
      );
    } else if (schemas.length > 0) {
      findings.push(
        new FindingBuilder('aeo-faq-schema')
          .setCategory('aeo')
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
          .setCategory('aeo')
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

    // 4. LLMs.txt Context Standard
    const seoRes = getModuleData<SeoData>(modules, 'metadata', 'seo');
    const hasLlms = Boolean(seoRes.data?.hasLlmsTxtLink);
    if (hasLlms) {
      findings.push(
        new FindingBuilder('aeo-llms-txt')
          .setCategory('aeo')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('LLMs.txt Declared', true)
          .addEvidence('Target Link', seoRes.data?.llmsTxtUrl || '/llms.txt')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('aeo-llms-txt')
          .setCategory('aeo')
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

    // 5. AI Crawlers & Model Permissions
    const hasNoAi = Boolean(seoRes.data?.hasNoAiDirective);
    const robotsDirectives = seoRes.data?.metaRobotsDirectives;
    const isNoIndex = Array.isArray(robotsDirectives)
      ? robotsDirectives.includes('noindex')
      : Boolean(robotsDirectives?.noindex);

    if (hasNoAi) {
      findings.push(
        new FindingBuilder('aeo-ai-crawlers')
          .setCategory('aeo')
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
          .setCategory('aeo')
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
          .setCategory('aeo')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('AI Crawlers Allowed', true)
          .addEvidence('Retrieval Status', 'Open to LLM indexers (GPTBot, ClaudeBot, Google-Extended)')
          .build(),
      );
    }

    // 6. Conversational Question Headings
    if (domRes.data?.headingHierarchy) {
      const headings = domRes.data.headingHierarchy;
      const questionRegex = /^(what|how|why|who|where|when|can|is|does|are|which|top|best|should)\b/i;
      const questionHeadings = headings.filter(
        (h) => questionRegex.test(h.text.trim()) || h.text.trim().endsWith('?'),
      );

      if (questionHeadings.length >= 2) {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setCategory('aeo')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Question Headings Count', questionHeadings.length)
            .addEvidence('Sample Queries', questionHeadings.slice(0, 3).map((h) => `H${h.level}: ${h.text}`).join(' • '))
            .build(),
        );
      } else if (questionHeadings.length === 1 && questionHeadings[0]) {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setCategory('aeo')
            .setStatus('passed')
            .setConfidence(0.9)
            .addEvidence('Question Headings Count', 1)
            .addEvidence('Heading', questionHeadings[0].text)
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('aeo-question-headings')
            .setCategory('aeo')
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
