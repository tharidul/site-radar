
import type { CollectionResult } from '../../types/inspection';
import type { CollectorContext, PageCollector } from './types';

import { identityCollector } from './identity.collector';
import { domCollector } from './dom.collector';
import { metadataCollector } from './metadata.collector';
import { structuredDataCollector } from './structured-data.collector';
import { linksCollector } from './links.collector';
import { mediaCollector } from './media.collector';
import { stylesCollector } from './styles.collector';
import { scriptsCollector } from './scripts.collector';
import { formsCollector } from './forms.collector';
import { performanceCollector } from './performance.collector';
import { securitySignalsCollector } from './security-signals.collector';
import { privacySignalsCollector } from './privacy-signals.collector';
import { technologyCollector } from './technology.collector';
import { responsiveCollector } from './responsive.collector';
import { accessibilityCollector } from './accessibility.collector';

export * from './types';
export * from './identity.collector';
export * from './dom.collector';
export * from './metadata.collector';
export * from './structured-data.collector';
export * from './links.collector';
export * from './media.collector';
export * from './styles.collector';
export * from './scripts.collector';
export * from './forms.collector';
export * from './performance.collector';
export * from './security-signals.collector';
export * from './privacy-signals.collector';
export * from './technology.collector';
export * from './responsive.collector';
export * from './accessibility.collector';

export const PAGE_COLLECTORS: Record<string, PageCollector> = {
  identity: identityCollector,
  dom: domCollector,
  metadata: metadataCollector,
  structuredData: structuredDataCollector,
  links: linksCollector,
  media: mediaCollector,
  styles: stylesCollector,
  scripts: scriptsCollector,
  forms: formsCollector,
  performance: performanceCollector,
  securitySignals: securitySignalsCollector,
  security: securitySignalsCollector,
  privacySignals: privacySignalsCollector,
  privacy: privacySignalsCollector,
  technology: technologyCollector,
  responsive: responsiveCollector,
  accessibility: accessibilityCollector,
};

export async function runPageCollector(
  moduleId: string,
  context: CollectorContext,
): Promise<CollectionResult<unknown>> {
  const collector = PAGE_COLLECTORS[moduleId];
  if (!collector) {
    return {
      module: moduleId,
      status: 'unsupported',
      collectedAt: Date.now(),
      data: null,
      coverage: {
        expected: 1,
        collected: 0,
        unavailable: 1,
        supported: false,
        message: `Collector for module '${moduleId}' is not registered.`,
      },
      limitations: [`Module '${moduleId}' not supported in active context.`],
      errors: [`Unknown collector module '${moduleId}'`],
      sources: [],
    };
  }

  try {
    return await collector.collect(context);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      module: moduleId,
      status: 'failed',
      collectedAt: Date.now(),
      data: null,
      coverage: {
        expected: 1,
        collected: 0,
        unavailable: 1,
        supported: true,
        message: `Collector failed with runtime error: ${errorMsg}`,
      },
      limitations: [`Execution failed unexpectedly.`],
      errors: [errorMsg],
      sources: [],
    };
  }
}
