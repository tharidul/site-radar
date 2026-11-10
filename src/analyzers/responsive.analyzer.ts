
import type { AuditFinding, IdentityData, ResponsiveData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class ResponsiveAnalyzer implements Analyzer {
  readonly id = 'responsive-analyzer';
  readonly category = 'best-practices';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules } = context;

    const respRes = getModuleData<ResponsiveData>(modules, 'responsive');
    const idRes = getModuleData<IdentityData>(modules, 'identity');

    const hasViewport = Boolean(respRes.data?.hasViewportTag || idRes.data?.viewport);
    const viewportContent = respRes.data?.viewportContent || idRes.data?.viewport;

    if (!hasViewport) {
      findings.push(
        new FindingBuilder('resp-viewport-valid')
          .setCategory('best-practices')
          .setStatus('failed')
          .setSeverity('high')
          .setConfidence(1.0)
          .addEvidence('Viewport Meta Tag', 'Missing')
          .setExpectedBehavior('Declare <meta name="viewport" content="width=device-width, initial-scale=1">.')
          .setExplanation('Without a viewport meta tag, mobile devices render pages at desktop width, requiring zooming to read text.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('resp-viewport-valid')
          .setCategory('best-practices')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Viewport Meta Tag', viewportContent || 'Declared')
          .build(),
      );
    }

    if (respRes.data) {
      if (respRes.data.horizontalOverflowDetected) {
        findings.push(
          new FindingBuilder('resp-horizontal-overflow')
            .setCategory('best-practices')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.8)
            .addEvidence('Horizontal Layout Overflow', 'Document layout scroll width exceeds viewport client width')
            .setExpectedBehavior('Content elements must fit within the client screen viewport width.')
            .setExplanation('Horizontal overflow causes unwanted sideways scrolling on mobile devices.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('resp-horizontal-overflow')
            .setCategory('best-practices')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Horizontal Overflow', false)
            .build(),
        );
      }
    }

    return findings;
  }
}
