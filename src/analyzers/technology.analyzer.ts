/**
 * @file src/analyzers/technology.analyzer.ts
 * @description Evaluates detected technology stacks, meta generator version disclosure,
 * and multi-framework bloat under Best Practices.
 */

import type { AuditFinding, TechnologyData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class TechnologyAnalyzer implements Analyzer {
  readonly id = 'technology-analyzer';
  readonly category = 'best-practices';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules } = context;

    // 1. Meta generator version disclosure
    const techRes = getModuleData<TechnologyData>(modules, 'technology');
    const generatorTech = techRes.data?.technologies?.find((t) => t.evidence.toLowerCase().includes('generator'));
    const generator = generatorTech?.version || generatorTech?.evidence;
    if (generator) {
      const hasVersion = /\d+\.\d+/.test(generator);
      if (hasVersion) {
        findings.push(
          new FindingBuilder('tech-generator-exposed')
            .setCategory('best-practices')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.9)
            .addEvidence('Generator Meta', generator)
            .setExpectedBehavior('Suppress exact software build versions from public meta tags.')
            .setExplanation('Exposing exact software versions simplifies reconnaissance for automated exploit scanners.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('tech-generator-exposed')
            .setCategory('best-practices')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Generator Meta', generator)
            .build(),
        );
      }
    }

    // 2. Competing UI Frameworks
    if (techRes.data?.technologies) {
      const uiFrameworks = techRes.data.technologies.filter((t) =>
        ['react', 'vue', 'angular', 'svelte', 'solid'].includes(t.name.toLowerCase()),
      );
      if (uiFrameworks.length > 1) {
        findings.push(
          new FindingBuilder('tech-multiple-frameworks')
            .setCategory('best-practices')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.8)
            .addEvidence('Detected Frameworks', uiFrameworks.map((f) => f.name).join(', '))
            .setExpectedBehavior('Consolidate client application to a single primary UI framework.')
            .setExplanation('Running multiple UI frameworks simultaneously incurs redundant bundle and memory overhead.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('tech-multiple-frameworks')
            .setCategory('best-practices')
            .setStatus('passed')
            .setConfidence(0.9)
            .addEvidence('Framework Count', uiFrameworks.length)
            .build(),
        );
      }
    }

    return findings;
  }
}
