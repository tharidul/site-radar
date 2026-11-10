
import type { JavaScriptData, ScriptItem } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class ScriptsCollector implements PageCollector<JavaScriptData> {
  readonly id = 'scripts';
  readonly name = 'JavaScript & Scripts Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = doc.location?.href || context.url || '';
    let pageOrigin = '';
    try {
      pageOrigin = new URL(pageUrl || 'http://localhost').origin;
    } catch {
      pageOrigin = '';
    }

    const scriptElements = doc.querySelectorAll('script');
    let scriptCount = 0;
    let inlineScriptCount = 0;
    let asyncCount = 0;
    let deferCount = 0;
    let moduleCount = 0;
    let renderBlockingCount = 0;
    const externalDomainsSet = new Set<string>();
    const scripts: ScriptItem[] = [];

    let totalExternal = 0;
    let withSri = 0;

    scriptElements.forEach((script) => {
      const type = (script.getAttribute('type') || '').toLowerCase();
      if (type === 'application/ld+json') return;

      scriptCount++;
      const rawSrc = script.getAttribute('src');
      const isInline = !rawSrc;
      const isAsync = script.hasAttribute('async');
      const isDefer = script.hasAttribute('defer');
      const isModule = type === 'module';
      const hasSri = script.hasAttribute('integrity') && Boolean(script.getAttribute('integrity')?.trim());

      if (isInline) {
        inlineScriptCount++;
      }
      if (isAsync) asyncCount++;
      if (isDefer) deferCount++;
      if (isModule) moduleCount++;

      let sanitizedSrc: string | undefined = undefined;
      let domain: string | undefined = undefined;

      if (rawSrc) {
        totalExternal++;
        if (hasSri) withSri++;

        try {
          const resolved = new URL(rawSrc, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          sanitizedSrc = resolved.toString();
          domain = resolved.hostname;
          if (pageOrigin && resolved.origin !== pageOrigin) {
            externalDomainsSet.add(resolved.hostname);
          }
        } catch {
          sanitizedSrc = redactSecretsFromString(rawSrc);
        }
      }

      const isInHead = script.closest('head') !== null;
      const isRenderBlocking = Boolean(!isInline && isInHead && !isAsync && !isDefer && !isModule);
      if (isRenderBlocking) renderBlockingCount++;

      if (scripts.length < 100) {
        scripts.push({
          src: sanitizedSrc,
          isInline,
          isAsync,
          isDefer,
          isModule,
          isRenderBlocking,
          hasSri,
          domain,
        });
      }
    });

    const data: JavaScriptData = {
      scriptCount,
      inlineScriptCount,
      asyncCount,
      deferCount,
      moduleCount,
      renderBlockingCount,
      externalDomains: Array.from(externalDomainsSet),
      scripts,
      sriCoverage: {
        totalExternal,
        withSri,
      },
    };

    return createCollectionResult<JavaScriptData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 6,
        collected: 6,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Dynamically evaluated scripts (eval, Function, web workers) cannot be statically inspected.',
        'Script source bodies are strictly zero-collected to prevent secret and payload leakage.',
      ],
      sources: ['DOM:script'],
    });
  }
}

export const scriptsCollector = new ScriptsCollector();
