import type { AuditFinding } from '../../types/inspection';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

function isImmutableLibraryCdn(src: string): boolean {
  try {
    const url = new URL(src, 'http://localhost');
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;
    const isLibraryCdnHost =
      host === 'cdnjs.cloudflare.com' ||
      host === 'cdn.jsdelivr.net' ||
      host === 'unpkg.com';
    if (!isLibraryCdnHost) return false;

    // Must have version tag like /v?X.Y.Z/ or @X.Y.Z
    return /@\d+(\.\d+)*|(\/v?\d+\.\d+(\.\d+)*)/.test(pathname);
  } catch {
    return false;
  }
}

export class AssetMutabilityPolicy implements CorroborationPolicy {
  readonly policyId = 'asset-mutability-policy';
  readonly priority = 20;

  appliesTo(finding: AuditFinding): boolean {
    return (
      finding.ruleId === 'sec-missing-sri-scripts' ||
      finding.ruleId === 'sec-missing-sri-links'
    );
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    const targetOrigin = context.target?.origin || '';
    const targetHost = context.target?.hostname || '';

    interface AssetRef {
      src: string;
      hasSri?: boolean;
    }

    const missingSriAssets: AssetRef[] = [];

    // Collect from scripts module
    const scriptsData = (context.modules.scripts?.data ??
      context.modules.javascript?.data) as Record<string, unknown> | undefined;

    if (scriptsData && Array.isArray(scriptsData.scripts)) {
      for (const s of scriptsData.scripts as Array<{
        src?: string;
        isInline?: boolean;
        hasSri?: boolean;
        hasIntegrity?: boolean;
      }>) {
        if (s.src && !s.isInline && !s.hasSri && !s.hasIntegrity) {
          missingSriAssets.push({ src: s.src, hasSri: false });
        }
      }
    }

    // Collect from styles module for sec-missing-sri-links
    if (finding.ruleId === 'sec-missing-sri-links') {
      const stylesData = context.modules.styles?.data as
        | Record<string, unknown>
        | undefined;
      if (stylesData && Array.isArray(stylesData.stylesheets)) {
        for (const s of stylesData.stylesheets as Array<{
          href?: string;
          hasSri?: boolean;
          hasIntegrity?: boolean;
        }>) {
          if (s.href && !s.hasSri && !s.hasIntegrity) {
            missingSriAssets.push({ src: s.href, hasSri: false });
          }
        }
      }
    }

    // Collect from finding evidence if any URLs or script mentions are listed
    if (Array.isArray(finding.evidence)) {
      for (const ev of finding.evidence) {
        if (typeof ev.value === 'string') {
          if (
            ev.value.startsWith('http://') ||
            ev.value.startsWith('https://') ||
            ev.value.startsWith('//')
          ) {
            missingSriAssets.push({ src: ev.value, hasSri: false });
          } else if (
            /gtm\.js|analytics\.js|fbevents\.js|stripe\.js|google-analytics|tagmanager|dynamic|vendor/i.test(
              ev.value
            )
          ) {
            missingSriAssets.push({
              src: `https://vendor-tag.example.com/${ev.value}`,
              hasSri: false,
            });
          }
        } else if (Array.isArray(ev.value)) {
          for (const item of ev.value) {
            if (
              typeof item === 'string' &&
              (item.startsWith('http://') ||
                item.startsWith('https://') ||
                item.startsWith('//'))
            ) {
              missingSriAssets.push({ src: item, hasSri: false });
            } else if (item && typeof item === 'object' && 'src' in item) {
              const obj = item as { src?: string; hasSri?: boolean };
              if (obj.src && !obj.hasSri) {
                missingSriAssets.push({ src: obj.src, hasSri: false });
              }
            }
          }
        }
      }
    }

    // Filter to external assets
    const externalMissingSri = missingSriAssets.filter((a) => {
      try {
        const url = new URL(a.src, context.target?.url || 'http://localhost');
        if (targetOrigin && url.origin === targetOrigin) return false;
        if (
          targetHost &&
          (url.hostname === targetHost || url.hostname.endsWith(`.${targetHost}`))
        ) {
          return false;
        }
      } catch {
        // If unparseable relative, assume internal
        return false;
      }
      return true;
    });

    // Check if any missing SRI asset is an immutable CDN library
    const hasImmutableCdn = externalMissingSri.some((a) =>
      isImmutableLibraryCdn(a.src)
    );

    // If we have external missing SRI assets and NONE of them are immutable CDNs,
    // or if the finding explicitly represents dynamic vendor scripts
    const allDynamicOrVendor =
      externalMissingSri.length > 0 && !hasImmutableCdn;

    if (allDynamicOrVendor) {
      const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
      const nextState: RealityState = 'ARCHITECTURAL_PATTERN';
      const explanation =
        'External scripts are dynamic vendor/tag scripts where SRI is architecturally infeasible; recommend CSP allowlisting.';

      return {
        ...finding,
        realityState: nextState,
        realityMultiplier: 0.0,
        status: 'passed',
        explanation,
        corroborationTraces: [
          ...(finding.corroborationTraces ?? []),
          {
            policyId: this.policyId,
            previousState,
            nextState,
            multiplierApplied: 0.0,
            reason: explanation,
          },
        ],
      };
    }

    return finding;
  }
}

export const assetMutabilityPolicy = new AssetMutabilityPolicy();
