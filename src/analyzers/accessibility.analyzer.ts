/**
 * @file src/analyzers/accessibility.analyzer.ts
 * @description Evaluates accessibility rules, image accessible names, semantic landmarks,
 * zooming restrictions, and maps axe-core automated WCAG 2.2 AA evaluation violations.
 */

import type { AuditFinding, AccessibilityData, DomSemanticData, ImagesData, IdentityData, ResponsiveData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class AccessibilityAnalyzer implements Analyzer {
  readonly id = 'accessibility-analyzer';
  readonly category = 'accessibility';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules, mode } = context;

    // 1. Language Attribute
    const identityRes = getModuleData<IdentityData>(modules, 'identity');
    if (identityRes.data) {
      const lang = identityRes.data.language?.trim();
      if (!lang) {
        findings.push(
          new FindingBuilder('a11y-missing-lang')
            .setStatus('failed')
            .setSeverity('medium')
            .setConfidence(1.0)
            .addEvidence('HTML Lang Attribute', 'Missing')
            .setExpectedBehavior('The root <html> element declares a valid lang attribute (e.g. <html lang="en">).')
            .setExplanation('Screen readers require the document language to apply the correct pronunciation and speech synthesis dictionary (WCAG 2.2 AA SC 3.1.1).')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('a11y-missing-lang')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('HTML Lang', lang)
            .build(),
        );
      }
    }

    // 2. Semantic Landmarks
    const domRes = getModuleData<DomSemanticData>(modules, 'dom');
    if (domRes.data) {
      const hasMain = Boolean(
        domRes.data.hasMainLandmark ||
        domRes.data.landmarkElements?.some((l) => l.role === 'main' || l.tag === 'main'),
      );
      if (!hasMain) {
        findings.push(
          new FindingBuilder('a11y-missing-landmarks')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.85)
            .addEvidence('Semantic Landmarks', 'No <main> landmark region or role="main" detected')
            .setExpectedBehavior('Document structure uses semantic landmarks (<main>, <header>, <nav>, <footer>) or ARIA roles.')
            .setExplanation('Landmark regions allow assistive technology and keyboard users to navigate directly to the primary content block.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('a11y-missing-landmarks')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Landmarks Detected', domRes.data.landmarkElements?.map((l) => l.role || l.tag).join(', ') || 'Main landmark present')
            .build(),
        );
      }
    }

    // 3. Image Accessible Names (WCAG 2.2 AA SC 1.1.1)
    const mediaRes = getModuleData<ImagesData>(modules, 'media');
    if (mediaRes.data) {
      if (mediaRes.data.totalImages === 0) {
        findings.push(
          new FindingBuilder('a11y-missing-alt')
            .setStatus('not-applicable')
            .setConfidence(1.0)
            .addEvidence('Image Count', 0)
            .build(),
        );
      } else if (mediaRes.data.missingAltCount > 0) {
        findings.push(
          new FindingBuilder('a11y-missing-alt')
            .setStatus('failed')
            .setSeverity('high')
            .setConfidence(1.0)
            .addEvidence('Images Missing Alt / Accessible Name', mediaRes.data.missingAltCount)
            .addEvidence('Total Images Evaluated', mediaRes.data.totalImages)
            .setExpectedBehavior('All images provide descriptive alt text, aria-label, or are marked decorative with alt="" or role="presentation".')
            .setExplanation('Images lacking accessible names prevent visually impaired users from understanding non-text content.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('a11y-missing-alt')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Images with Accessible Names / Decorative', mediaRes.data.totalImages)
            .build(),
        );
      }
    }

    // 4. Viewport Zooming Restrictions (WCAG 2.2 AA SC 1.4.4 Resize Text)
    const respRes = getModuleData<ResponsiveData>(modules, 'responsive');
    const viewportContent = respRes.data?.viewportContent || identityRes.data?.viewport;
    if (viewportContent) {
      const disablesZoom = /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?/i.test(viewportContent);
      if (disablesZoom) {
        findings.push(
          new FindingBuilder('resp-disables-zoom')
            .setStatus('failed')
            .setSeverity('high')
            .setConfidence(1.0)
            .addEvidence('Viewport Directives', viewportContent)
            .setExpectedBehavior('Allow users to zoom up to at least 200% without user-scalable=no or maximum-scale=1.0.')
            .setExplanation('Restricting zoom prevents users with low vision from magnifying content to readable sizes.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('resp-disables-zoom')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('User Scalable Allowed', true)
            .build(),
        );
      }
    }

    // 5. axe-core Suite Evaluation
    const a11yRes = getModuleData<AccessibilityData>(modules, 'accessibility');
    if (mode === 'quick' && !a11yRes.data) {
      findings.push(
        new FindingBuilder('a11y-axe-evaluation')
          .setStatus('not-available')
          .addEvidence('Mode Context', 'Automated axe-core comprehensive suite runs in Full Page Audit mode')
          .build(),
      );
    } else if (!a11yRes.data) {
      findings.push(
        new FindingBuilder('a11y-axe-evaluation')
          .setStatus('not-available')
          .addEvidence('Reason', a11yRes.unavailableReason || 'axe-core collector did not execute')
          .build(),
      );
    } else {
      const axeData = a11yRes.data;
      const violations = axeData.violations || [];

      if (violations.length === 0) {
        findings.push(
          new FindingBuilder('a11y-axe-evaluation')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('axe-core Violations', 0)
            .addEvidence('Passes Evaluated', axeData.passesCount || 0)
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('a11y-axe-evaluation')
            .setStatus('warning')
            .setSeverity('medium')
            .setConfidence(1.0)
            .addEvidence('Total Violations', violations.length)
            .build(),
        );

        // Map individual axe-core violations with a11y-axe-${id} ruleId
        for (const v of violations.slice(0, 10)) {
          const ruleId = `a11y-axe-${v.id}`;
          const severity =
            v.impact === 'critical' ? 'critical' : v.impact === 'serious' ? 'high' : v.impact === 'moderate' ? 'medium' : 'low';
          findings.push(
            new FindingBuilder(ruleId)
              .setTitle(`axe: ${v.help || v.id}`)
              .setDescription(v.description || '')
              .setSeverity(severity)
              .setStatus('failed')
              .setConfidence(1.0)
              .addEvidence('Violation ID', v.id)
              .addEvidence('Impact', v.impact || 'unspecified')
              .addEvidence('Nodes Affected', v.nodesCount || 1)
              .setExpectedBehavior('Element markup must satisfy WCAG 2.2 AA automated conformance rules.')
              .setExplanation(v.description || `axe-core rule ${v.id} detected node failures.`)
              .setRecommendation(v.helpUrl ? `Review guidance: ${v.helpUrl}` : 'Consult WCAG 2.2 AA specifications')
              .build(),
          );
        }
      }
    }

    return findings;
  }
}
