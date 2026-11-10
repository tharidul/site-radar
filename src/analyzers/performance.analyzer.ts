
import type { AuditFinding, PerformanceData, DomSemanticData, JavaScriptData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class PerformanceAnalyzer implements Analyzer {
  readonly id = 'performance-analyzer';
  readonly category = 'performance';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules } = context;

    const perfRes = getModuleData<PerformanceData>(modules, 'performance');
    const perfData = perfRes.data;

    if (!perfData) {
      findings.push(
        new FindingBuilder('perf-lcp')
          .setStatus('not-available')
          .addEvidence('Reason', perfRes.unavailableReason || 'Performance module unavailable')
          .build(),
        new FindingBuilder('perf-cls')
          .setStatus('not-available')
          .addEvidence('Reason', perfRes.unavailableReason || 'Performance module unavailable')
          .build(),
        new FindingBuilder('perf-ttfb')
          .setStatus('not-available')
          .addEvidence('Reason', perfRes.unavailableReason || 'Performance module unavailable')
          .build(),
      );
    } else {
      const lcp = perfData.webVitals?.lcpMs;
      if (lcp !== undefined && lcp > 0) {
        if (lcp > 4000) {
          findings.push(
            new FindingBuilder('perf-lcp')
              .setStatus('failed')
              .setSeverity('high')
              .setConfidence(1.0)
              .addEvidence('LCP', `${Math.round(lcp)}ms`)
              .setExpectedBehavior('Largest Contentful Paint occurs within 2.5 seconds.')
              .setExplanation(`LCP of ${Math.round(lcp)}ms exceeds poor threshold of 4,000ms.`)
              .build(),
          );
        } else if (lcp > 2500) {
          findings.push(
            new FindingBuilder('perf-lcp')
              .setStatus('warning')
              .setSeverity('medium')
              .setConfidence(1.0)
              .addEvidence('LCP', `${Math.round(lcp)}ms`)
              .setExpectedBehavior('Largest Contentful Paint occurs within 2.5 seconds.')
              .setExplanation(`LCP of ${Math.round(lcp)}ms needs improvement (target <= 2,500ms).`)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('perf-lcp')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('LCP', `${Math.round(lcp)}ms`)
              .setExpectedBehavior('Largest Contentful Paint occurs within 2.5 seconds.')
              .setExplanation(`Good LCP observed (${Math.round(lcp)}ms <= 2,500ms).`)
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('perf-lcp')
            .setStatus('not-available')
            .setExplanation('Chrome only records Largest Contentful Paint (LCP) timestamps during initial page load. Because this page was already open or idle in memory before scanning, the paint timeline had no active LCP entry.')
            .setRecommendation('Reload this tab (Ctrl+R / Cmd+R) and click Start Inspection immediately after load to capture live Core Web Vitals.')
            .addEvidence('Observation State', 'LCP entry not recorded by browser prior to inspection')
            .addEvidence('How to measure', 'Reload this tab and re-run inspection')
            .build(),
        );
      }

      const cls = perfData.webVitals?.clsScore;
      if (cls !== undefined) {
        if (cls > 0.25) {
          findings.push(
            new FindingBuilder('perf-cls')
              .setStatus('failed')
              .setSeverity('high')
              .setConfidence(1.0)
              .addEvidence('CLS Score', cls.toFixed(3))
              .setExpectedBehavior('Cumulative Layout Shift remains <= 0.1.')
              .setExplanation(`CLS score of ${cls.toFixed(3)} exceeds poor threshold of 0.25.`)
              .build(),
          );
        } else if (cls > 0.1) {
          findings.push(
            new FindingBuilder('perf-cls')
              .setStatus('warning')
              .setSeverity('medium')
              .setConfidence(1.0)
              .addEvidence('CLS Score', cls.toFixed(3))
              .setExpectedBehavior('Cumulative Layout Shift remains <= 0.1.')
              .setExplanation(`CLS score of ${cls.toFixed(3)} needs improvement (target <= 0.1).`)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('perf-cls')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('CLS Score', cls.toFixed(3))
              .setExpectedBehavior('Cumulative Layout Shift remains <= 0.1.')
              .setExplanation(`Good visual stability observed (CLS ${cls.toFixed(3)} <= 0.1).`)
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('perf-cls')
            .setStatus('not-available')
            .setExplanation('Cumulative Layout Shift (CLS) measures unexpected layout shifts during active rendering. No shift events were recorded by the browser prior to inspection.')
            .setRecommendation('Reload this tab (Ctrl+R / Cmd+R) and click Start Inspection to capture visual stability metrics during page load.')
            .addEvidence('Observation State', 'CLS metrics not recorded by browser engine')
            .addEvidence('How to measure', 'Reload this tab and re-run inspection')
            .build(),
        );
      }

      const inp = perfData.webVitals?.inpMs;
      if (inp !== undefined && inp > 0) {
        if (inp > 500) {
          findings.push(
            new FindingBuilder('perf-inp')
              .setStatus('failed')
              .setSeverity('high')
              .setConfidence(0.9)
              .addEvidence('INP', `${Math.round(inp)}ms`)
              .setExpectedBehavior('Interaction to Next Paint remains <= 200ms.')
              .setExplanation(`Interaction latency of ${Math.round(inp)}ms exceeds poor threshold of 500ms.`)
              .build(),
          );
        } else if (inp > 200) {
          findings.push(
            new FindingBuilder('perf-inp')
              .setStatus('warning')
              .setSeverity('medium')
              .setConfidence(0.9)
              .addEvidence('INP', `${Math.round(inp)}ms`)
              .setExpectedBehavior('Interaction to Next Paint remains <= 200ms.')
              .setExplanation(`Interaction latency of ${Math.round(inp)}ms needs improvement (target <= 200ms).`)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('perf-inp')
              .setStatus('passed')
              .setConfidence(0.9)
              .addEvidence('INP', `${Math.round(inp)}ms`)
              .setExpectedBehavior('Interaction to Next Paint remains <= 200ms.')
              .build(),
          );
        }
      }

      const ttfb = perfData.navigationTiming?.ttfbMs;
      if (ttfb !== undefined && ttfb >= 0) {
        if (ttfb > 1800) {
          findings.push(
            new FindingBuilder('perf-ttfb')
              .setStatus('failed')
              .setSeverity('medium')
              .setConfidence(1.0)
              .addEvidence('TTFB', `${Math.round(ttfb)}ms`)
              .setExpectedBehavior('Server response time (TTFB) is <= 800ms.')
              .setExplanation(`High server latency (${Math.round(ttfb)}ms > 1,800ms) delays initial page delivery.`)
              .build(),
          );
        } else if (ttfb > 800) {
          findings.push(
            new FindingBuilder('perf-ttfb')
              .setStatus('warning')
              .setSeverity('low')
              .setConfidence(1.0)
              .addEvidence('TTFB', `${Math.round(ttfb)}ms`)
              .setExpectedBehavior('Server response time (TTFB) is <= 800ms.')
              .setExplanation(`Server response time of ${Math.round(ttfb)}ms exceeds recommended 800ms threshold.`)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('perf-ttfb')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('TTFB', `${Math.round(ttfb)}ms`)
              .setExpectedBehavior('Server response time (TTFB) is <= 800ms.')
              .setExplanation(`Fast server response observed (${Math.round(ttfb)}ms <= 800ms).`)
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('perf-ttfb')
            .setStatus('not-available')
            .addEvidence('Reason', 'Navigation timing responseStart unavailable')
            .build(),
        );
      }

      const fcp = perfData.paintTiming?.fcpMs;
      if (fcp !== undefined && fcp > 0) {
        const ruleKey = 'perf-slow-fcp';
        if (fcp > 3000) {
          findings.push(
            new FindingBuilder(ruleKey)
              .setStatus('failed')
              .setSeverity('medium')
              .setConfidence(1.0)
              .addEvidence('FCP', `${Math.round(fcp)}ms`)
              .setExpectedBehavior('First Contentful Paint occurs within 1.8 seconds.')
              .setExplanation(`FCP of ${Math.round(fcp)}ms exceeds poor threshold of 3,000ms.`)
              .build(),
          );
        } else if (fcp > 1800) {
          findings.push(
            new FindingBuilder(ruleKey)
              .setStatus('warning')
              .setSeverity('low')
              .setConfidence(1.0)
              .addEvidence('FCP', `${Math.round(fcp)}ms`)
              .setExpectedBehavior('First Contentful Paint occurs within 1.8 seconds.')
              .setExplanation(`FCP of ${Math.round(fcp)}ms needs improvement (target <= 1,800ms).`)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder(ruleKey)
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('FCP', `${Math.round(fcp)}ms`)
              .setExpectedBehavior('First Contentful Paint occurs within 1.8 seconds.')
              .setExplanation(`Fast first paint observed (${Math.round(fcp)}ms <= 1,800ms).`)
              .build(),
          );
        }
      }
    }

    const scriptsRes = getModuleData<JavaScriptData>(modules, 'scripts');
    if (scriptsRes.data?.scripts) {
      const renderBlocking = scriptsRes.data.scripts.filter((s) => s.isRenderBlocking);
      if (renderBlocking.length > 0) {
        findings.push(
          new FindingBuilder('perf-render-blocking-resources')
            .setStatus('warning')
            .setSeverity('medium')
            .setConfidence(0.9)
            .addEvidence('Render-blocking Scripts in Head', renderBlocking.length)
            .setExpectedBehavior('Non-critical scripts in <head> should use async or defer attributes.')
            .setExplanation('Synchronous scripts in the document head block the browser parser from rendering visual content.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('perf-render-blocking-resources')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Render-blocking Scripts', 0)
            .build(),
        );
      }
    }

    const domRes = getModuleData<DomSemanticData>(modules, 'dom');
    if (domRes.data) {
      const elementCount = domRes.data.elementCount || 0;
      const maxDepth = domRes.data.maxDomDepth || 0;
      if (elementCount > 1500 || maxDepth > 32) {
        findings.push(
          new FindingBuilder('perf-excessive-dom-depth')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(1.0)
            .addEvidence('Total Elements', elementCount)
            .addEvidence('Max Depth', maxDepth)
            .setExpectedBehavior('DOM node count <= 1,500 and tree depth <= 32.')
            .setExplanation('Excessively large DOM trees degrade layout performance and memory efficiency.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('perf-excessive-dom-depth')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Total Elements', elementCount)
            .addEvidence('Max Depth', maxDepth)
            .build(),
        );
      }
    }

    return findings;
  }
}
