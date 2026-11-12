
import React, { useMemo, useState } from 'react';
import { FileCode, FileSpreadsheet, Image as ImageIcon, Globe, Database, Cpu, Search, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import type {
  WebsiteInspection,
  TechnologyData,
  JavaScriptData,
  CssData,
  ImagesData,
  LinksData,
  ScriptItem,
  StylesheetItem,
  ImageItem,
} from '@/types/inspection';

interface ResourcesViewProps {
  inspection: WebsiteInspection;
}

type ResourceTab = 'scripts' | 'stylesheets' | 'images' | 'origins';

const INITIAL_PREVIEW_LIMIT = 20;

function openResourceUrl(url?: string) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) return;

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function getFilenameOrTruncated(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr, 'http://localhost');
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const filename = pathParts.pop();
    if (filename) {
      return filename.length > 45 ? `${filename.slice(0, 42)}...` : filename;
    }
    return parsed.hostname;
  } catch {
    const parts = urlStr.split('/');
    const last = parts.pop() || urlStr;
    return last.length > 45 ? `${last.slice(0, 42)}...` : last;
  }
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({ inspection }) => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('scripts');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTabs, setExpandedTabs] = useState<Record<ResourceTab, boolean>>({
    scripts: false,
    stylesheets: false,
    images: false,
    origins: false,
  });

  const resModule = inspection.modules?.resources?.data as any;
  const scriptsData = inspection.modules?.scripts?.data as JavaScriptData | undefined;
  const stylesData = inspection.modules?.styles?.data as CssData | undefined;
  const mediaData = inspection.modules?.media?.data as ImagesData | undefined;
  const linksData = inspection.modules?.links?.data as LinksData | undefined;
  const techModule = inspection.modules?.technology?.data as TechnologyData | undefined;

  const technologies = techModule?.technologies || [];

  const scripts: ScriptItem[] = resModule?.scripts || scriptsData?.scripts || [];
  const scriptCount = resModule?.scriptCount ?? scriptsData?.scriptCount ?? scripts.length;

  const stylesheets: StylesheetItem[] = resModule?.stylesheets || stylesData?.stylesheets || [];
  const stylesheetCount = resModule?.stylesheetCount ?? stylesData?.stylesheetCount ?? stylesheets.length;

  const images: ImageItem[] = resModule?.images || mediaData?.images || [];
  const imageCount = resModule?.imageCount ?? mediaData?.totalImages ?? images.length;

  const origins = useMemo(() => {
    if (resModule?.thirdPartyOrigins && Array.isArray(resModule.thirdPartyOrigins) && resModule.thirdPartyOrigins.length > 0) {
      return resModule.thirdPartyOrigins;
    }
    const originSet = new Set<string>();
    if (scriptsData?.externalDomains) {
      scriptsData.externalDomains.forEach((d) => {
        if (d && !d.includes('localhost')) originSet.add(d);
      });
    }
    if (stylesData?.stylesheets) {
      stylesData.stylesheets.forEach((s) => {
        if (s.isExternal && s.domain) originSet.add(s.domain);
      });
    }
    if (linksData?.externalLinks) {
      linksData.externalLinks.forEach((l) => {
        try {
          if (l.url) {
            const u = new URL(l.url, 'http://localhost');
            if (u.hostname && !u.hostname.includes('localhost')) {
              originSet.add(u.hostname);
            }
          }
        } catch {
        }
      });
    }
    return Array.from(originSet).sort();
  }, [resModule, scriptsData, stylesData, linksData]);

  const query = searchQuery.trim().toLowerCase();

  const filteredScripts = useMemo(() => {
    if (!query) return scripts;
    return scripts.filter(
      (s) => (s.src && s.src.toLowerCase().includes(query)) || (s.domain && s.domain.toLowerCase().includes(query)),
    );
  }, [scripts, query]);

  const filteredStylesheets = useMemo(() => {
    if (!query) return stylesheets;
    return stylesheets.filter(
      (s) => (s.href && s.href.toLowerCase().includes(query)) || (s.domain && s.domain.toLowerCase().includes(query)),
    );
  }, [stylesheets, query]);

  const filteredImages = useMemo(() => {
    if (!query) return images;
    return images.filter(
      (img) => (img.src && img.src.toLowerCase().includes(query)) || (img.alt && img.alt.toLowerCase().includes(query)),
    );
  }, [images, query]);

  const filteredOrigins = useMemo(() => {
    if (!query) return origins;
    return origins.filter((o: string) => o.toLowerCase().includes(query));
  }, [origins, query]);

  const isExpanded = expandedTabs[activeTab];
  const visibleScripts = isExpanded ? filteredScripts : filteredScripts.slice(0, INITIAL_PREVIEW_LIMIT);
  const visibleStylesheets = isExpanded ? filteredStylesheets : filteredStylesheets.slice(0, INITIAL_PREVIEW_LIMIT);
  const visibleImages = isExpanded ? filteredImages : filteredImages.slice(0, INITIAL_PREVIEW_LIMIT);
  const visibleOrigins = isExpanded ? filteredOrigins : filteredOrigins.slice(0, INITIAL_PREVIEW_LIMIT);

  const activeTotalCount =
    activeTab === 'scripts'
      ? filteredScripts.length
      : activeTab === 'stylesheets'
        ? filteredStylesheets.length
        : activeTab === 'images'
          ? filteredImages.length
          : filteredOrigins.length;

  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Page Resources
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Inspect scripts, styles, images, and third-party domains loaded by this page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab('scripts');
            setSearchQuery('');
          }}
          className={`rounded-md p-3 text-center transition-colors duration-100 cursor-pointer ${
            activeTab === 'scripts'
              ? 'bg-white dark:bg-zinc-900 ring-2 ring-[#CEFF52] border border-transparent'
              : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800'
          }`}
          title="Click to view loaded scripts"
        >
          <FileCode
            className={`w-4 h-4 mx-auto mb-1 ${activeTab === 'scripts' ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`}
          />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {scriptCount}
          </div>
          <div
            className={`text-xs font-semibold ${
              activeTab === 'scripts' ? 'text-[#152E40] dark:text-[#CEFF52] font-bold' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Scripts
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('stylesheets');
            setSearchQuery('');
          }}
          className={`rounded-md p-3 text-center transition-colors duration-100 cursor-pointer ${
            activeTab === 'stylesheets'
              ? 'bg-white dark:bg-zinc-900 ring-2 ring-[#CEFF52] border border-transparent'
              : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800'
          }`}
          title="Click to view loaded stylesheets"
        >
          <FileSpreadsheet
            className={`w-4 h-4 mx-auto mb-1 ${activeTab === 'stylesheets' ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`}
          />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {stylesheetCount}
          </div>
          <div
            className={`text-xs font-semibold ${
              activeTab === 'stylesheets'
                ? 'text-[#152E40] dark:text-[#CEFF52] font-bold'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Stylesheets
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('images');
            setSearchQuery('');
          }}
          className={`rounded-md p-3 text-center transition-colors duration-100 cursor-pointer ${
            activeTab === 'images'
              ? 'bg-white dark:bg-zinc-900 ring-2 ring-[#CEFF52] border border-transparent'
              : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800'
          }`}
          title="Click to view image assets"
        >
          <ImageIcon
            className={`w-4 h-4 mx-auto mb-1 ${activeTab === 'images' ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`}
          />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {imageCount}
          </div>
          <div
            className={`text-xs font-semibold ${
              activeTab === 'images' ? 'text-[#152E40] dark:text-[#CEFF52] font-bold' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Images
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('origins');
            setSearchQuery('');
          }}
          className={`rounded-md p-3 text-center transition-colors duration-100 cursor-pointer ${
            activeTab === 'origins'
              ? 'bg-white dark:bg-zinc-900 ring-2 ring-[#CEFF52] border border-transparent'
              : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800'
          }`}
          title="Click to view third-party origins"
        >
          <Globe
            className={`w-4 h-4 mx-auto mb-1 ${activeTab === 'origins' ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`}
          />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {origins.length}
          </div>
          <div
            className={`text-xs font-semibold ${
              activeTab === 'origins' ? 'text-[#152E40] dark:text-[#CEFF52] font-bold' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Origins
          </div>
        </button>
      </div>

      <div className="rounded-md bg-white dark:bg-zinc-900 p-3.5 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeTab === 'scripts' && <FileCode className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />}
            {activeTab === 'stylesheets' && <FileSpreadsheet className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />}
            {activeTab === 'images' && <ImageIcon className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />}
            {activeTab === 'origins' && <Globe className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />}
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {activeTab === 'scripts' && `Loaded Scripts (${filteredScripts.length})`}
              {activeTab === 'stylesheets' && `Stylesheets & CSS (${filteredStylesheets.length})`}
              {activeTab === 'images' && `Images & Media Assets (${filteredImages.length})`}
              {activeTab === 'origins' && `Connected Origins (${filteredOrigins.length})`}
            </span>
          </div>

          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeTab}...`}
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#CEFF52]"
            />
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
          {activeTab === 'scripts' &&
            (filteredScripts.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {scripts.length === 0 ? 'No scripts found on this page.' : 'No scripts matching filter.'}
              </p>
            ) : (
              visibleScripts.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => s.src && openResourceUrl(s.src)}
                  className={`deferred-list-item group py-1.5 flex flex-col gap-0.5 px-2 rounded-md transition-colors duration-100 ${
                    s.src ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer' : ''
                  }`}
                  title={s.src ? 'Click to open script in new tab' : undefined}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span
                      className={`font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5 ${
                        s.src ? 'group-hover:text-[#152E40] dark:group-hover:text-[#CEFF52] transition-colors' : ''
                      }`}
                      title={s.src || 'Inline Script'}
                    >
                      <span>{s.src ? getFilenameOrTruncated(s.src) : '<inline script>'}</span>
                      {s.src && (
                        <ExternalLink className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.isRenderBlocking && (
                        <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          blocking
                        </span>
                      )}
                      {s.isAsync && (
                        <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          async
                        </span>
                      )}
                      {s.isDefer && (
                        <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          defer
                        </span>
                      )}
                      {s.isModule && (
                        <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          module
                        </span>
                      )}
                      {s.hasSri && (
                        <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-[#CEFF52]/15 text-[#152E40] dark:text-[#CEFF52]">
                          SRI
                        </span>
                      )}
                    </div>
                  </div>
                  {s.src && (
                    <span className="text-2xs text-zinc-500 dark:text-zinc-400 truncate" title={s.src}>
                      {s.domain ? `${s.domain} • ` : ''}
                      {s.src}
                    </span>
                  )}
                </div>
              ))
            ))}

          {activeTab === 'stylesheets' &&
            (filteredStylesheets.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {stylesheets.length === 0 ? 'No stylesheets found on this page.' : 'No stylesheets matching filter.'}
              </p>
            ) : (
              visibleStylesheets.map((sheet, idx) => (
                <div
                  key={idx}
                  onClick={() => sheet.href && openResourceUrl(sheet.href)}
                  className={`deferred-list-item group py-1.5 flex flex-col gap-0.5 px-2 rounded-md transition-colors duration-100 ${
                    sheet.href ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer' : ''
                  }`}
                  title={sheet.href ? 'Click to open stylesheet in new tab' : undefined}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span
                      className={`font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5 ${
                        sheet.href ? 'group-hover:text-[#152E40] dark:group-hover:text-[#CEFF52] transition-colors' : ''
                      }`}
                      title={sheet.href || 'Inline Style'}
                    >
                      <span>{sheet.href ? getFilenameOrTruncated(sheet.href) : '<inline style>'}</span>
                      {sheet.href && (
                        <ExternalLink className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sheet.isExternal && (
                        <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          external
                        </span>
                      )}
                      {sheet.media && (
                        <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {sheet.media}
                        </span>
                      )}
                      {sheet.hasSri && (
                        <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-[#CEFF52]/15 text-[#152E40] dark:text-[#CEFF52]">
                          SRI
                        </span>
                      )}
                    </div>
                  </div>
                  {sheet.href && (
                    <span className="text-2xs text-zinc-500 dark:text-zinc-400 truncate" title={sheet.href}>
                      {sheet.domain ? `${sheet.domain} • ` : ''}
                      {sheet.href}
                    </span>
                  )}
                </div>
              ))
            ))}

          {activeTab === 'images' &&
            (filteredImages.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {images.length === 0 ? 'No images found on this page.' : 'No images matching filter.'}
              </p>
            ) : (
              visibleImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => openResourceUrl(img.src)}
                  className="deferred-list-item group py-1.5 flex items-center gap-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 rounded-md cursor-pointer transition-colors duration-100"
                  title="Click to open image in new tab"
                >
                  <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center relative">
                    <img
                      src={img.src}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <ImageIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute pointer-events-none" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span
                        className="font-mono text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-[#152E40] dark:group-hover:text-[#CEFF52] transition-colors truncate flex items-center gap-1.5"
                        title={img.src}
                      >
                        <span>{getFilenameOrTruncated(img.src)}</span>
                        <ExternalLink className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {img.format && (
                          <span className="text-2xs font-mono uppercase px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                            {img.format}
                          </span>
                        )}
                        {img.width && img.height && (
                          <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {img.width}×{img.height}
                          </span>
                        )}
                        {img.isLazy && (
                          <span className="text-2xs font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            lazy
                          </span>
                        )}
                        {!img.hasAlt ? (
                          <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            no alt
                          </span>
                        ) : (
                          <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-[#CEFF52]/15 text-[#152E40] dark:text-[#CEFF52]">
                            alt
                          </span>
                        )}
                      </div>
                    </div>
                    {img.alt && (
                      <span className="text-2xs text-zinc-500 dark:text-zinc-400 truncate">
                        "{img.alt}"
                      </span>
                    )}
                    <span className="text-2xs text-zinc-500 dark:text-zinc-400 truncate" title={img.src}>
                      {img.src}
                    </span>
                  </div>
                </div>
              ))
            ))}

          {activeTab === 'origins' &&
            (filteredOrigins.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {origins.length === 0
                  ? 'No external third-party origins detected on this document.'
                  : 'No origins matching filter.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 py-2">
                {visibleOrigins.map((origin: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => openResourceUrl(`https://${origin}`)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono hover:bg-[#CEFF52]/15 hover:text-[#152E40] dark:hover:text-[#CEFF52] hover:border-[#CEFF52]/30 transition-colors duration-100 cursor-pointer border border-transparent"
                    title={`Open https://${origin} in new tab`}
                  >
                    <span>{origin}</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            ))}
        </div>

        {activeTotalCount > INITIAL_PREVIEW_LIMIT && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setExpandedTabs((prev) => ({
                  ...prev,
                  [activeTab]: !prev[activeTab],
                }))
              }
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-100 cursor-pointer"
            >
              {isExpanded
                ? `Show fewer (first ${INITIAL_PREVIEW_LIMIT})`
                : `Show all ${activeTotalCount}`}
            </button>
          </div>
        )}
      </div>

      {technologies.length > 0 && (
        <div className="rounded-md bg-white dark:bg-zinc-900 p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
              <span>Detected Frontend Frameworks &amp; Technologies</span>
            </h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
              {technologies.length} identified
            </span>
          </div>

          <div
            className={`grid gap-2 pt-0.5 ${
              technologies.length === 1
                ? 'grid-cols-1'
                : technologies.length === 2 || technologies.length === 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
            }`}
          >
            {technologies.map((tech, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
                title={tech.evidence ? `Detected via: ${tech.evidence}` : undefined}
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    {tech.name}
                  </span>
                  {tech.version && (
                    <span className="shrink-0 text-2xs font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-300">
                      v{tech.version}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate">
                  {tech.category}
                </div>
                {tech.evidence && (
                  <div
                    className="text-2xs text-zinc-500 dark:text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-200/80 dark:border-zinc-800/60 truncate"
                    title={tech.evidence}
                  >
                    {tech.evidence}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

