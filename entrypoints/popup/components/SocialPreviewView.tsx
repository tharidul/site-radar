import React, { useState, useMemo, useEffect } from 'react';
import {
  Share2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Search as SearchIcon,
  Code2,
  Info,
} from 'lucide-react';
import type { WebsiteInspection, SeoData, IdentityData } from '@/types/inspection';

interface SocialPreviewViewProps {
  inspection: WebsiteInspection;
}

type PlatformTab = 'twitter' | 'facebook' | 'google';

export const SocialPreviewView: React.FC<SocialPreviewViewProps> = ({ inspection }) => {
  const [platform, setPlatform] = useState<PlatformTab>('twitter');
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const seoData = useMemo(() => {
    return (
      (inspection.modules?.metadata?.data as SeoData | undefined) ||
      (inspection.modules?.seo?.data as SeoData | undefined) ||
      null
    );
  }, [inspection]);

  const identityData = useMemo(() => {
    return (inspection.modules?.identity?.data as IdentityData | undefined) || null;
  }, [inspection]);

  const targetUrl = inspection.target.url || '';
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {}

  const hostname = parsedUrl?.hostname || inspection.target.hostname || 'example.com';
  const siteName =
    seoData?.openGraph?.['og:site_name'] ||
    seoData?.openGraph?.['site_name'] ||
    hostname.replace(/^www\./, '');

  const title =
    seoData?.openGraph?.['og:title'] ||
    seoData?.twitterCards?.['twitter:title'] ||
    seoData?.title ||
    identityData?.title ||
    'Page Title Not Provided';

  const description =
    seoData?.openGraph?.['og:description'] ||
    seoData?.twitterCards?.['twitter:description'] ||
    seoData?.description ||
    'No meta description detected on this page.';

  const imageUrl =
    seoData?.openGraph?.['og:image'] ||
    seoData?.openGraph?.['og:image:url'] ||
    seoData?.twitterCards?.['twitter:image'] ||
    seoData?.twitterCards?.['twitter:image:src'] ||
    null;

  const twitterCardType =
    seoData?.twitterCards?.['twitter:card'] ||
    (imageUrl ? 'summary_large_image' : 'summary');

  const faviconUrl = identityData?.faviconUrl || null;

  useEffect(() => {
    setFaviconError(false);
  }, [faviconUrl]);

  // Validation Checks
  const audit = useMemo(() => {
    const checks: Array<{
      tag: string;
      value: string | null;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      chars?: number;
      idealRange?: string;
    }> = [];

    // Title check
    const rawTitle = seoData?.openGraph?.['og:title'] || seoData?.title || '';
    if (!rawTitle) {
      checks.push({
        tag: 'og:title',
        value: null,
        status: 'fail',
        message: 'Missing og:title tag. Platforms will fall back to <title> or URL.',
      });
    } else if (rawTitle.length < 20) {
      checks.push({
        tag: 'og:title',
        value: rawTitle,
        status: 'warn',
        chars: rawTitle.length,
        idealRange: '40–60 chars',
        message: 'Title is brief. Aim for 40–60 characters for optimal click-through.',
      });
    } else if (rawTitle.length > 60) {
      checks.push({
        tag: 'og:title',
        value: rawTitle,
        status: 'warn',
        chars: rawTitle.length,
        idealRange: '40–60 chars',
        message: 'Title exceeds 60 characters and may be truncated in social feeds.',
      });
    } else {
      checks.push({
        tag: 'og:title',
        value: rawTitle,
        status: 'pass',
        chars: rawTitle.length,
        idealRange: '40–60 chars',
        message: 'Optimal title length for social and search platforms.',
      });
    }

    // Description check
    const rawDesc = seoData?.openGraph?.['og:description'] || seoData?.description || '';
    if (!rawDesc) {
      checks.push({
        tag: 'og:description',
        value: null,
        status: 'fail',
        message: 'Missing og:description. Social platforms will display blank snippets or random text.',
      });
    } else if (rawDesc.length < 50) {
      checks.push({
        tag: 'og:description',
        value: rawDesc,
        status: 'warn',
        chars: rawDesc.length,
        idealRange: '50–160 chars',
        message: 'Description is short. Aim for 50–160 characters for compelling context.',
      });
    } else if (rawDesc.length > 160) {
      checks.push({
        tag: 'og:description',
        value: rawDesc,
        status: 'warn',
        chars: rawDesc.length,
        idealRange: '50–160 chars',
        message: 'Description exceeds 160 characters and will be cut off with an ellipsis.',
      });
    } else {
      checks.push({
        tag: 'og:description',
        value: rawDesc,
        status: 'pass',
        chars: rawDesc.length,
        idealRange: '50–160 chars',
        message: 'Optimal description length.',
      });
    }

    // Image check
    if (!imageUrl) {
      checks.push({
        tag: 'og:image',
        value: null,
        status: 'fail',
        message: 'No og:image detected. Shared links will appear plain without visual preview.',
      });
    } else if (imageUrl.startsWith('http://') && targetUrl.startsWith('https://')) {
      checks.push({
        tag: 'og:image',
        value: imageUrl,
        status: 'fail',
        message: 'Insecure HTTP image on an HTTPS website. Blocked by most social networks.',
      });
    } else {
      checks.push({
        tag: 'og:image',
        value: imageUrl,
        status: 'pass',
        message: 'Image tag present and properly formatted.',
      });
    }

    // Twitter card check
    if (seoData?.twitterCards?.['twitter:card']) {
      checks.push({
        tag: 'twitter:card',
        value: seoData.twitterCards['twitter:card'],
        status: 'pass',
        message: `Twitter Card type defined: ${seoData.twitterCards['twitter:card']}.`,
      });
    } else {
      checks.push({
        tag: 'twitter:card',
        value: null,
        status: 'warn',
        message: 'Missing twitter:card. Defaults to summary card without banner.',
      });
    }

    return checks;
  }, [seoData, imageUrl, targetUrl]);

  // Generated Meta Tags for Copying
  const generatedMetaTags = useMemo(() => {
    const lines: string[] = [
      '<!-- Open Graph / Facebook / LinkedIn -->',
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${targetUrl}" />`,
      `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`,
      `<meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />`,
    ];

    if (imageUrl) {
      lines.push(`<meta property="og:image" content="${imageUrl}" />`);
    } else {
      lines.push(`<!-- <meta property="og:image" content="https://${hostname}/og-image.png" /> -->`);
    }

    lines.push('');
    lines.push('<!-- Twitter / X -->');
    lines.push(`<meta name="twitter:card" content="${twitterCardType}" />`);
    lines.push(`<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />`);
    lines.push(`<meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />`);
    if (imageUrl) {
      lines.push(`<meta name="twitter:image" content="${imageUrl}" />`);
    }

    return lines.join('\n');
  }, [targetUrl, title, description, imageUrl, twitterCardType, hostname]);

  const copyTags = async () => {
    try {
      await navigator.clipboard.writeText(generatedMetaTags);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const passCount = audit.filter((c) => c.status === 'pass').length;
  const warnCount = audit.filter((c) => c.status === 'warn').length;
  const failCount = audit.filter((c) => c.status === 'fail').length;

  return (
    <div className="p-4 space-y-4 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
        {/* Top Header & Platform Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
              <span>Social &amp; Search Preview</span>
            </span>
          </div>

          {/* Platform Tab Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80 text-2xs font-semibold">
            <button
              type="button"
              onClick={() => setPlatform('twitter')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors duration-100 cursor-pointer ${
                platform === 'twitter'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>𝕏 Twitter</span>
            </button>

            <button
              type="button"
              onClick={() => setPlatform('facebook')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors duration-100 cursor-pointer ${
                platform === 'facebook'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>Facebook / LinkedIn</span>
            </button>

            <button
              type="button"
              onClick={() => setPlatform('google')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors duration-100 cursor-pointer ${
                platform === 'google'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <SearchIcon className="w-3 h-3" />
              <span>Google SERP</span>
            </button>
          </div>
        </div>

        {/* Live Visual Simulation Card */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {platform === 'twitter'
                ? '𝕏 (Twitter) Large Image Card Preview'
                : platform === 'facebook'
                ? 'Facebook / LinkedIn Feed Card Preview'
                : 'Google Search Result Snippet Preview'}
            </span>
            <span className="text-3xs text-zinc-400 font-mono">Live Simulation</span>
          </div>

          {/* Twitter / X Simulation */}
          {platform === 'twitter' && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700/80 overflow-hidden bg-black text-white max-w-sm sm:max-w-md mx-auto shadow-md">
              <div className="relative aspect-[1.91/1] w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                {imageUrl && !imgError ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-1">
                    <ImageIcon className="w-8 h-8 stroke-1 text-zinc-600" />
                    <span className="text-xs font-medium">No Image Specified (og:image)</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-3xs font-mono text-zinc-200 font-medium tracking-wide">
                  {hostname}
                </div>
              </div>

              <div className="p-3 bg-zinc-950/90 space-y-1">
                <div className="text-2xs text-zinc-400 uppercase tracking-wide font-medium">{hostname}</div>
                <div className="font-bold text-xs sm:text-sm text-zinc-100 line-clamp-2 leading-snug">
                  {title}
                </div>
                <div className="text-2xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {description}
                </div>
              </div>
            </div>
          )}

          {/* Facebook / LinkedIn Simulation */}
          {platform === 'facebook' && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/80 overflow-hidden bg-white dark:bg-zinc-900 max-w-sm sm:max-w-md mx-auto shadow-md">
              <div className="relative aspect-[1.91/1] w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                {imageUrl && !imgError ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400 dark:text-zinc-500 space-y-1">
                    <ImageIcon className="w-8 h-8 stroke-1" />
                    <span className="text-xs">No Open Graph Image Found</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-zinc-800/80 space-y-1 border-t border-zinc-200 dark:border-zinc-700/50">
                <div className="text-3xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold truncate">
                  {siteName.toUpperCase()}
                </div>
                <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                  {title}
                </div>
                <div className="text-2xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {description}
                </div>
              </div>
            </div>
          )}

          {/* Google SERP Simulation */}
          {platform === 'google' && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 max-w-sm sm:max-w-md mx-auto space-y-2 shadow-sm font-sans">
              <div className="flex items-center gap-2">
                {faviconUrl && !faviconError ? (
                  <img
                    src={faviconUrl}
                    alt="favicon"
                    className="w-4 h-4 rounded-full bg-zinc-100 shrink-0 object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <span
                    className="w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Globe className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-400" />
                  </span>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-2xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {siteName}
                  </span>
                  <span className="text-3xs text-zinc-500 dark:text-zinc-400 truncate font-mono">
                    {targetUrl}
                  </span>
                </div>
              </div>

              <div>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-sm sm:text-base font-semibold text-blue-700 dark:text-blue-400 hover:underline line-clamp-2 leading-snug cursor-pointer"
                >
                  {title}
                </a>
              </div>

              <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                {description}
              </div>
            </div>
          )}
        </div>

        {/* Validation Matrix Checklist */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Open Graph &amp; Twitter Meta Audit
            </span>
            <div className="flex items-center gap-2 text-2xs font-bold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">{passCount} passed</span>
              {warnCount > 0 && <span className="text-amber-600 dark:text-amber-400">{warnCount} warnings</span>}
              {failCount > 0 && <span className="text-rose-600 dark:text-rose-400">{failCount} missing</span>}
            </div>
          </div>

          <div className="space-y-2">
            {audit.map((check) => {
              const isPass = check.status === 'pass';
              const isWarn = check.status === 'warn';
              const isFail = check.status === 'fail';

              return (
                <div
                  key={check.tag}
                  className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                    isPass
                      ? 'border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/10'
                      : isWarn
                      ? 'border-amber-200/70 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20'
                      : 'border-rose-200/70 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isPass && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {isWarn && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {isFail && <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{check.tag}</span>
                    </div>

                    {check.chars !== undefined && (
                      <span className="text-3xs font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {check.chars} chars {check.idealRange ? `(${check.idealRange})` : ''}
                      </span>
                    )}
                  </div>

                  <p className="text-2xs text-zinc-600 dark:text-zinc-400 leading-snug pl-5">
                    {check.message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copy Ready Meta Tags Card */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Code2 className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
              <span>Ready-to-Paste Meta Tags</span>
            </span>

            <button
              type="button"
              onClick={copyTags}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-2xs font-bold bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] hover:opacity-90 transition-colors duration-100 cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied All Tags!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Meta Tags</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 font-mono text-3xs text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800 select-all">
            {generatedMetaTags}
          </div>
        </div>
    </div>
  );
};
