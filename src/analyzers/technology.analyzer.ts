
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

    const techRes = getModuleData<TechnologyData>(modules, 'technology');
    const technologies = techRes.data?.technologies || [];

    const generatorTech = technologies.find((t) => t.evidence.toLowerCase().includes('generator'));
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

    if (technologies.length > 0) {
      const ecosystems = new Set<string>();
      for (const t of technologies) {
        const name = t.name.toLowerCase();
        if (['react', 'next.js', 'remix', 'gatsby', 'preact'].includes(name)) {
          ecosystems.add('react');
        } else if (['vue.js', 'nuxt.js'].includes(name)) {
          ecosystems.add('vue');
        } else if (['angular'].includes(name)) {
          ecosystems.add('angular');
        } else if (['svelte'].includes(name)) {
          ecosystems.add('svelte');
        } else if (['solid.js'].includes(name)) {
          ecosystems.add('solid');
        } else if (['ember.js'].includes(name)) {
          ecosystems.add('ember');
        }
      }

      if (ecosystems.size > 1) {
        const competing = technologies
          .filter((t) => ['JavaScript Framework', 'Web Framework'].includes(t.category))
          .map((t) => t.name)
          .join(', ');

        findings.push(
          new FindingBuilder('tech-multiple-frameworks')
            .setCategory('best-practices')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.85)
            .addEvidence('Competing Frameworks', competing)
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
            .addEvidence('Framework Ecosystems', ecosystems.size)
            .build(),
        );
      }

      const stackSummary = technologies
        .map((t) => (t.version ? `${t.name} (v${t.version})` : t.name))
        .join(', ');

      const stackFinding = new FindingBuilder('tech-stack-detected')
        .setCategory('best-practices')
        .setStatus('passed')
        .setSeverity('info')
        .setConfidence(1.0)
        .addEvidence('Detected Stack', stackSummary);

      for (const t of technologies) {
        stackFinding.addEvidence(t.name, `${t.category} — ${t.evidence}`);
      }

      findings.push(stackFinding.build());
    }

    return findings;
  }
}
