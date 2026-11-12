import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Shield,
  AlertTriangle,
  Server,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Radio,
  Clock,
  Layers,
  FileCode,
} from 'lucide-react';
import type {
  WebsiteInspection,
  ResponseHeadersData,
  HeaderItem,
  MissingSecurityHeader,
} from '@/types/inspection';
import { HeadersService } from '@/services/headers.service';
import { useHorizontalScroll } from '@/utils/useHorizontalScroll';

interface HeadersViewProps {
  inspection: WebsiteInspection;
}

type HeaderFilterTab = 'all' | 'security' | 'missing' | 'caching' | 'server' | 'leaks';

export const HeadersView: React.FC<HeadersViewProps> = ({ inspection }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<HeaderFilterTab>('all');
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const filterScrollRef = useHorizontalScroll<HTMLDivElement>();

  // Retrieve headers data either from dedicated headers module or construct from security headers
  const headersData: ResponseHeadersData = useMemo(() => {
    const rawModuleData = inspection.modules?.headers?.data as ResponseHeadersData | undefined;
    if (rawModuleData && rawModuleData.headers && Object.keys(rawModuleData.headers).length > 0) {
      return rawModuleData;
    }

    const secData = (inspection.modules?.security?.data as any) || (inspection.modules?.securitySignals?.data as any);
    const existingMap = secData?.securityHeaders || secData?.responseHeaders?.headers || {};

    return HeadersService.processHeaders(
      existingMap,
      secData?.responseHeaders?.statusCode || (inspection.target.url.startsWith('https') ? 200 : 200),
      secData?.responseHeaders?.statusText || 'OK',
      inspection.target.url,
      'HEAD',
    );
  }, [inspection]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const toggleInsight = (name: string) => {
    setExpandedInsights((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const stats = useMemo(() => {
    const secureCount = headersData.categorizedHeaders.filter((h) => h.status === 'secure').length;
    const missingCount = headersData.missingSecurityHeaders.length;
    const leakCount = headersData.leaks.length;
    const totalCount = headersData.categorizedHeaders.length;

    return { secureCount, missingCount, leakCount, totalCount };
  }, [headersData]);

  const filteredHeaders = useMemo(() => {
    return headersData.categorizedHeaders.filter((h) => {
      // Category / Tab filter
      if (activeFilter === 'security' && h.category !== 'security') return false;
      if (activeFilter === 'caching' && h.category !== 'caching') return false;
      if (activeFilter === 'server' && h.category !== 'server' && h.category !== 'network') return false;
      if (activeFilter === 'leaks' && h.status !== 'leak') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = h.name.toLowerCase().includes(q);
        const matchVal = h.value.toLowerCase().includes(q);
        const matchDesc = h.description?.toLowerCase().includes(q) || false;
        return matchName || matchVal || matchDesc;
      }

      return true;
    });
  }, [headersData, activeFilter, searchQuery]);

  const filteredMissing = useMemo(() => {
    if (activeFilter !== 'all' && activeFilter !== 'missing' && activeFilter !== 'security') {
      return [];
    }
    if (!searchQuery.trim()) return headersData.missingSecurityHeaders;
    const q = searchQuery.toLowerCase();
    return headersData.missingSecurityHeaders.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [headersData.missingSecurityHeaders, activeFilter, searchQuery]);

  const statusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60';
    if (code >= 300 && code < 400) return 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60';
    if (code >= 400 && code < 500) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';
  };

  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
        {/* Top Status & Overview Card */}
        <div className="rounded-lg bg-white dark:bg-zinc-900 p-3.5 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusColor(headersData.statusCode)}`}>
                {headersData.statusCode} {headersData.statusText}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {headersData.method}
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[240px] sm:max-w-xs font-mono" title={headersData.url}>
                {headersData.url}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(headersData.curlCommand, 'curl')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-2xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors duration-100 cursor-pointer active:scale-95 border border-zinc-200/60 dark:border-zinc-700"
                title="Copy request as cURL command"
              >
                {copiedKey === 'curl' ? (
                  <>
                    <Check className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
                    <span className="text-[#152E40] dark:text-[#CEFF52]">Copied cURL!</span>
                  </>
                ) : (
                  <>
                    <Terminal className="w-3 h-3 text-zinc-500" />
                    <span>Copy cURL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(headersData.rawHeadersText, 'raw')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors duration-100 cursor-pointer active:scale-95 border border-zinc-200/60 dark:border-zinc-700"
                title="Copy raw response headers"
              >
                {copiedKey === 'raw' ? (
                  <>
                    <Check className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
                    <span className="text-[#152E40] dark:text-[#CEFF52]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-zinc-500" />
                    <span>Raw</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total</div>
              <div className="text-base font-black text-zinc-900 dark:text-white tabular-nums">{stats.totalCount}</div>
            </div>

            <div className="p-2 rounded bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Active Sec</div>
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.secureCount}</div>
            </div>

            <div className="p-2 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Missing</div>
              <div className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">{stats.missingCount}</div>
            </div>

            <div className="p-2 rounded bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Leaks</div>
              <div className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">{stats.leakCount}</div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headers or directives..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-[#CEFF52] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div ref={filterScrollRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar horizontal-scroll-fade py-0.5">
            {[
              { id: 'all', label: `All (${stats.totalCount})` },
              { id: 'security', label: `Security (${stats.secureCount})` },
              { id: 'missing', label: `Missing (${stats.missingCount})` },
              { id: 'caching', label: 'Caching' },
              { id: 'server', label: 'Server/CDN' },
              { id: 'leaks', label: `Leaks (${stats.leakCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as HeaderFilterTab)}
                className={`px-2 py-1 text-2xs font-semibold rounded transition-colors duration-100 cursor-pointer whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40]'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Missing Security Headers Callouts */}
        {filteredMissing.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Recommended Security Headers to Add ({filteredMissing.length})</span>
              </span>
            </div>

            <div className="space-y-2">
              {filteredMissing.map((missing) => (
                <div
                  key={missing.name}
                  className="deferred-list-item rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-amber-900 dark:text-amber-300">
                          {missing.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-2xs font-bold uppercase tracking-wide bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                          {missing.severity}
                        </span>
                      </div>
                      <p className="text-2xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-snug">
                        {missing.description}
                      </p>
                    </div>

                    {missing.exampleValue && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${missing.name}: ${missing.exampleValue}`, `missing_${missing.name}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-amber-300/60 dark:border-amber-800/60 cursor-pointer shrink-0 active:scale-95"
                        title="Copy recommended header snippet"
                      >
                        {copiedKey === `missing_${missing.name}` ? (
                          <>
                            <Check className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
                            <span className="text-[#152E40] dark:text-[#CEFF52]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-zinc-400" />
                            <span>Snippet</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="p-1.5 rounded bg-white/80 dark:bg-zinc-900/80 border border-amber-200/50 dark:border-amber-900/30 text-2xs font-mono text-zinc-700 dark:text-zinc-300 break-all select-all">
                    {missing.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observed Response Headers List */}
        <div className="space-y-2">
          {activeFilter !== 'missing' && (
            <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span>Observed Headers ({filteredHeaders.length})</span>
            </div>
          )}

          {activeFilter !== 'missing' && filteredHeaders.length === 0 ? (
            <div className="p-6 text-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              No headers matched &ldquo;{searchQuery}&rdquo; in this filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHeaders.map((header) => {
                const isExpanded = Boolean(expandedInsights[header.name]);
                const isLeak = header.status === 'leak';
                const isSecure = header.status === 'secure';

                return (
                  <div
                    key={header.name}
                    className={`deferred-list-item rounded-lg border bg-white dark:bg-zinc-900 transition-colors duration-100 ${
                      isLeak
                        ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/10'
                        : isSecure
                        ? 'border-emerald-200/60 dark:border-emerald-900/40'
                        : 'border-zinc-200/80 dark:border-zinc-800'
                    } p-3 space-y-1.5 text-xs`}
                  >
                    {/* Header Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 break-all">
                          {header.name}
                        </span>

                        <span className="px-1.5 py-0.2 rounded text-3xs font-semibold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {header.category}
                        </span>

                        {isSecure && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-3xs font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <Shield className="w-2.5 h-2.5" />
                            Secure
                          </span>
                        )}

                        {isLeak && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-3xs font-bold uppercase tracking-wide bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Info Leak
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(header.value, header.name)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                          title="Copy value"
                        >
                          {copiedKey === header.name ? (
                            <Check className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {(header.description || header.recommendation) && (
                          <button
                            type="button"
                            onClick={() => toggleInsight(header.name)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                            title="Toggle insight"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Header Value */}
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all select-all leading-relaxed">
                      {header.value}
                    </div>

                    {/* Expandable Insight / Recommendation */}
                    {isExpanded && (header.description || header.recommendation) && (
                      <div className="pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-2xs">
                        {header.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            <strong className="text-zinc-800 dark:text-zinc-200">Analysis:</strong> {header.description}
                          </p>
                        )}
                        {header.recommendation && (
                          <div className="p-1.5 rounded bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 font-mono">
                            <strong className="font-sans text-zinc-900 dark:text-white">Recommendation:</strong> {header.recommendation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );
};

