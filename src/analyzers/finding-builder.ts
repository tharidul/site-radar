
import type { AuditFinding, Evidence, FindingStatus, Severity } from '../types/inspection';
import { redactSecrets } from '../security/secret-redactor';
import { getRuleDefinition } from './rule-catalog';

export class FindingBuilder {
  private finding: Partial<AuditFinding> = {
    evidence: [],
    references: [],
  };

  constructor(ruleId?: string) {
    if (ruleId) {
      this.setRuleId(ruleId);
    }
  }

  public setRuleId(ruleId: string): this {
    const rule = getRuleDefinition(ruleId);
    this.finding.ruleId = ruleId;
    if (rule) {
      this.finding.category = rule.category;
      this.finding.title = rule.title;
      this.finding.description = rule.description;
      this.finding.severity = rule.defaultSeverity;
      this.finding.recommendation = rule.recommendation;
      this.finding.expectedBehavior = rule.expectedBehavior;
      this.finding.explanation = rule.explanation;
      this.finding.source = rule.source;
      this.finding.references = [...rule.references];
      if (rule.confidence !== undefined) {
        this.finding.confidence = rule.confidence;
      } else if (rule.isHeuristic) {
        this.finding.confidence = 0.8;
      } else {
        this.finding.confidence = 1.0;
      }
    }
    return this;
  }

  public setCategory(category: string): this {
    this.finding.category = category;
    return this;
  }

  public setTitle(title: string): this {
    this.finding.title = title;
    return this;
  }

  public setDescription(description: string): this {
    this.finding.description = description;
    return this;
  }

  public setSeverity(severity: Severity): this {
    this.finding.severity = severity;
    return this;
  }

  public setStatus(status: FindingStatus): this {
    this.finding.status = status;
    return this;
  }

  public setConfidence(confidence: number): this {
    this.finding.confidence = Math.max(0, Math.min(1, confidence));
    return this;
  }

  public setSource(source: string): this {
    this.finding.source = source;
    return this;
  }

  public setRecommendation(recommendation: string): this {
    this.finding.recommendation = recommendation;
    return this;
  }

  public setExpectedBehavior(expectedBehavior: string): this {
    this.finding.expectedBehavior = expectedBehavior;
    return this;
  }

  public setExplanation(explanation: string): this {
    this.finding.explanation = explanation;
    return this;
  }

  public addEvidence(label: string, value?: unknown, source = 'inspection', location?: string): this {
    const sanitizedValue = value !== undefined ? redactSecrets(value) : undefined;
    this.finding.evidence = this.finding.evidence || [];
    this.finding.evidence.push({
      label,
      value: sanitizedValue,
      source,
      location,
      observedAt: Date.now(),
    });
    return this;
  }

  public addReference(ref: string): this {
    this.finding.references = this.finding.references || [];
    if (!this.finding.references.includes(ref)) {
      this.finding.references.push(ref);
    }
    return this;
  }

  public setId(id: string): this {
    this.finding.id = id;
    return this;
  }

  public build(): AuditFinding {
    if (!this.finding.ruleId) {
      throw new Error('FindingBuilder: ruleId is mandatory');
    }
    if (!this.finding.status) {
      throw new Error(`FindingBuilder: status is mandatory for rule ${this.finding.ruleId}`);
    }

    const rule = getRuleDefinition(this.finding.ruleId);

    const findingId =
      this.finding.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${this.finding.ruleId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

    return {
      id: findingId,
      ruleId: this.finding.ruleId,
      category: this.finding.category || rule?.category || 'general',
      title: this.finding.title || rule?.title || this.finding.ruleId,
      description: this.finding.description || rule?.description || '',
      severity: this.finding.severity || rule?.defaultSeverity || 'info',
      status: this.finding.status,
      confidence: this.finding.confidence,
      evidence: this.finding.evidence || [],
      expectedBehavior: this.finding.expectedBehavior || rule?.expectedBehavior,
      explanation: this.finding.explanation || rule?.explanation,
      recommendation: this.finding.recommendation || rule?.recommendation,
      source: this.finding.source || rule?.source || 'analyzer',
      references: this.finding.references || rule?.references || [],
    };
  }
}
