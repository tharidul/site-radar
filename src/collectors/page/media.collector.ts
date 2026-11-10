
import type { ImagesData, ImageItem, VideoItem } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class MediaCollector implements PageCollector<ImagesData> {
  readonly id = 'media';
  readonly name = 'Images & Media Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = doc.location?.href || context.url || '';

    const imgElements = doc.querySelectorAll('img');
    const totalImages = imgElements.length;
    let missingAltCount = 0;
    let lazyLoadedCount = 0;
    const brokenImages: string[] = [];
    const formats: Record<string, number> = {};
    const images: ImageItem[] = [];

    imgElements.forEach((img) => {
      const rawSrc = img.getAttribute('src') || '';
      let sanitizedSrc = rawSrc;
      if (rawSrc) {
        try {
          const resolved = new URL(rawSrc, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          sanitizedSrc = resolved.toString();
        } catch {
          sanitizedSrc = redactSecretsFromString(rawSrc);
        }
      }

      const hasAltAttr = img.hasAttribute('alt');
      const rawAlt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      const isAriaHidden = img.getAttribute('aria-hidden') === 'true';
      const isDecorative = rawAlt === '' || role === 'presentation' || role === 'none' || isAriaHidden;
      const ariaLabel = img.getAttribute('aria-label')?.trim();
      const ariaLabelledby = img.getAttribute('aria-labelledby')?.trim();
      const hasAccessibleName = (hasAltAttr && Boolean(rawAlt && rawAlt.trim())) || Boolean(ariaLabel) || Boolean(ariaLabelledby);
      const isAccessible = isDecorative || hasAccessibleName;
      const hasAlt = hasAccessibleName && !isDecorative;

      if (!isAccessible) {
        missingAltCount++;
      }

      const alt = rawAlt ? redactSecretsFromString(rawAlt.trim()).slice(0, 100) : (ariaLabel ? redactSecretsFromString(ariaLabel).slice(0, 100) : undefined);
      const isLazy = img.getAttribute('loading') === 'lazy';
      if (isLazy) lazyLoadedCount++;

      let format = 'unknown';
      const lowerSrc = sanitizedSrc.toLowerCase();
      if (lowerSrc.startsWith('data:image/')) {
        format = 'data-uri';
      } else if (lowerSrc.includes('.webp')) {
        format = 'webp';
      } else if (lowerSrc.includes('.avif')) {
        format = 'avif';
      } else if (lowerSrc.includes('.svg')) {
        format = 'svg';
      } else if (lowerSrc.includes('.png')) {
        format = 'png';
      } else if (lowerSrc.includes('.jpg') || lowerSrc.includes('.jpeg')) {
        format = 'jpeg';
      } else if (lowerSrc.includes('.gif')) {
        format = 'gif';
      }

      formats[format] = (formats[format] || 0) + 1;

      const isBroken = Boolean(img.complete && img.naturalWidth === 0 && sanitizedSrc);
      if (isBroken && brokenImages.length < 50) {
        brokenImages.push(sanitizedSrc);
      }

      const width = img.width || parseInt(img.getAttribute('width') || '0', 10) || undefined;
      const height = img.height || parseInt(img.getAttribute('height') || '0', 10) || undefined;

      if (images.length < 100) {
        images.push({
          src: sanitizedSrc,
          alt,
          hasAlt,
          isLazy,
          format,
          width: width || undefined,
          height: height || undefined,
        });
      }
    });

    const svgCount = doc.querySelectorAll('svg').length;

    const data: ImagesData = {
      totalImages,
      missingAltCount,
      lazyLoadedCount,
      svgCount,
      brokenImages,
      formats,
      images,
    };

    return createCollectionResult<ImagesData>({
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
        'CSS background images and canvas graphics are not captured.',
        'CORS restrictions may hide natural dimensions on cross-origin images.',
      ],
      sources: ['DOM:img', 'DOM:svg'],
    });
  }
}

export const mediaCollector = new MediaCollector();
