import { describe, it, expect } from 'vitest';
import { calculateCategoryScore } from '../src/scoring/score-engine';
import type { AuditFinding } from '../src/types/inspection';

describe('calculateCategoryScore - axe severity weights', () => {
  it('correctly scales deduction points based on axe violation severity', () => {
    const findings: AuditFinding[] = [
      {
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-image-redundant-alt',
        title: 'axe: image-redundant-alt',
        description: 'Image alt redundant',
        severity: 'low',
        status: 'failed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        source: 'AxeCoreCollector',
        references: [],
      },
      {
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-axe-region',
        title: 'axe: region',
        description: 'Landmarks missing',
        severity: 'medium',
        status: 'failed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        source: 'AxeCoreCollector',
        references: [],
      },
      {
        id: '3',
        category: 'accessibility',
        ruleId: 'a11y-missing-alt',
        title: 'Image Accessible Name Alternatives',
        description: 'Passed',
        severity: 'high',
        status: 'passed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        source: 'MediaCollector',
        references: [],
      },
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.failed).toBe(2);
    expect(result.passed).toBe(1);

    // Verify low severity axe check deducts 3 points, not 12
    const lowDeduction = result.deductionsExplanation?.find((d) => d.includes('image-redundant-alt'));
    expect(lowDeduction).toContain('-3 pts');

    // Verify medium severity axe check deducts 8 points, not 12
    const medDeduction = result.deductionsExplanation?.find((d) => d.includes('region'));
    expect(medDeduction).toContain('-8 pts');
  });
});
