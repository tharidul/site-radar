/**
 * @file src/analyzers/privacy.analyzer.ts
 * @description Evaluates privacy policies, third-party tracker domains, and consent banners
 * under the Best Practices category with calibrated heuristic handling.
 */

import type { AuditFinding, PrivacySignalsData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class PrivacyAnalyzer implements Analyzer {
  readonly id = 'privacy-analyzer';
  readonly category = 'best-practices';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { modules } = context;

    const privRes = getModuleData<PrivacySignalsData>(modules, 'privacySignals', 'privacy');
    const privData = privRes.data;

    if (!privData) {
      findings.push(
        new FindingBuilder('privacy-policy-link')
          .setCategory('best-practices')
          .setStatus('not-available')
          .addEvidence('Reason', privRes.unavailableReason || 'Privacy module unavailable')
          .build(),
      );
      return findings;
    }

    // 1. Privacy Policy Link
    const hasPrivacyPolicy = privData.privacyPolicyLinks && privData.privacyPolicyLinks.length > 0;
    if (hasPrivacyPolicy) {
      findings.push(
        new FindingBuilder('privacy-policy-link')
          .setCategory('best-practices')
          .setStatus('passed')
          .setConfidence(0.9)
          .addEvidence('Privacy Policy Link', privData.privacyPolicyLinks[0] || 'Present in DOM')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('privacy-policy-link')
          .setCategory('best-practices')
          .setStatus('warning')
          .setSeverity('low')
          .setConfidence(0.8)
          .addEvidence('Privacy Policy Link', 'None detected in DOM link audit')
          .setExpectedBehavior('Website should provide an accessible link to its Privacy Policy in navigation or footer.')
          .setExplanation('A privacy policy informs visitors of data handling, cookies, and regulatory compliance.')
          .build(),
      );
    }

    // 2. Trackers & Consent Banner
    const trackerDomains = privData.thirdPartyTrackers || [];
    const hasConsentBanner = privData.consentBannerDetected;

    if (trackerDomains.length > 0) {
      if (!hasConsentBanner) {
        findings.push(
          new FindingBuilder('priv-missing-consent-banner')
            .setCategory('best-practices')
            .setStatus('info')
            .setSeverity('info')
            .setConfidence(0.7)
            .addEvidence('External Trackers Active', trackerDomains.length)
            .addEvidence('Consent Banner State', 'No visible banner detected in initial DOM (may be previously accepted or geo-restricted)')
            .setExpectedBehavior('Active third-party tracking cookies should be managed via a consent management mechanism where applicable.')
            .setExplanation('Third-party scripts were detected. If user consent was already stored in browser cookies or outside regulatory jurisdiction, a banner is not displayed.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('priv-missing-consent-banner')
            .setCategory('best-practices')
            .setStatus('passed')
            .setConfidence(0.85)
            .addEvidence('Consent Banner / CMP', 'Detected')
            .build(),
        );
      }

      if (trackerDomains.length > 5) {
        findings.push(
          new FindingBuilder('priv-excessive-third-party-trackers')
            .setCategory('best-practices')
            .setStatus('warning')
            .setSeverity('low')
            .setConfidence(0.8)
            .addEvidence('Tracker Domain Count', trackerDomains.length)
            .addEvidence('Domains Sample', trackerDomains.slice(0, 5).join(', '))
            .setExpectedBehavior('Consolidate third-party analytics and ad tags to limit user tracking surface.')
            .setExplanation('Loading more than 5 distinct third-party tracker domains increases page weight and user privacy exposure.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('priv-excessive-third-party-trackers')
            .setCategory('best-practices')
            .setStatus('passed')
            .setConfidence(0.9)
            .addEvidence('Tracker Domain Count', trackerDomains.length)
            .build(),
        );
      }
    } else {
      findings.push(
        new FindingBuilder('priv-excessive-third-party-trackers')
          .setCategory('best-practices')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Third-party Trackers', 0)
          .build(),
      );
    }

    return findings;
  }
}
