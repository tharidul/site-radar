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
  X,
} from 'lucide-react';
import type {
  WebsiteInspection,
  ResponseHeadersData,
  HeaderItem,
  MissingSecurityHeader,
} from '@/types/inspection';
import { HeadersService } from '@/services/headers.service';
import { useHorizontalScroll } from '@/utils/useHorizontalScroll';
import { Badge } from './Badge';

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
    const totalCount = headersData.categorizedHeaders.length;
    const securityCount = headersData.categorizedHeaders.filter((h) => h.category === 'security').length;
    const missingCount = headersData.missingSecurityHeaders.length;
    const cachingCount = headersData.categorizedHeaders.filter((h) => h.category === 'caching').length;
    const serverCount = headersData.categorizedHeaders.filter(
      (h) => h.category === 'server' || h.category === 'network',
    ).length;
    const leakCount = headersData.categorizedHeaders.filter((h) => h.status === 'leak').length;

    return { totalCount, securityCount, missingCount, cachingCount, serverCount, leakCount };
  }, [headersData]);

  const filteredHeaders = useMemo(() => {
    if (activeFilter === 'missing') {
      return [];
    }

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
    if (activeFilter !== 'all' && activeFilter !== 'missing') {
      return [];
    }
    if (!searchQuery.trim()) return headersData.missingSecurityHeaders;
    const q = searchQuery.toLowerCase();
    return headersData.missingSecurityHeaders.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.recommendation.toLowerCase().includes(q),
    );
  }, [headersData.missingSecurityHeaders, activeFilter, searchQuery]);

  const cleanStatusText = useMemo(() => {
    const raw = headersData.statusText || '';
    if (!raw || raw.startsWith('HTTP/')) {
      if (headersData.statusCode === 200) return 'OK';
      if (headersData.statusCode === 201) return 'Created';
      if (headersData.statusCode === 204) return 'No Content';
      if (headersData.statusCode === 301) return 'Moved';
      if (headersData.statusCode === 302) return 'Found';
      if (headersData.statusCode === 304) return 'Not Modified';
      if (headersData.statusCode === 400) return 'Bad Request';
      if (headersData.statusCode === 401) return 'Unauthorized';
      if (headersData.statusCode === 403) return 'Forbidden';
      if (headersData.statusCode === 404) return 'Not Found';
      if (headersData.statusCode === 500) return 'Server Error';
      return 'OK';
    }
    return raw;
  }, [headersData.statusCode, headersData.statusText]);

  const statusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'bg-emerald-600 text-white font-bold shadow-2xs';
    if (code >= 300 && code < 400) return 'bg-sky-600 text-white font-bold shadow-2xs';
    if (code >= 400 && code < 500) return 'bg-amber-600 text-white font-bold shadow-2xs';
    return 'bg-rose-600 text-white font-bold shadow-2xs';
  };

  return (
    <div className="p-4 space-y-3 bg-app-bg dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* Top Search & Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search headers or directives..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Compact Status & Quick Export Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-bold leading-none ${statusColor(headersData.statusCode)}`}
            title={`Status: ${headersData.statusCode} ${cleanStatusText} (${headersData.method})`}
          >
            <span>{headersData.statusCode}</span>
            <span>{cleanStatusText}</span>
          </span>

          <button
            type="button"
            onClick={() => copyToClipboard(headersData.curlCommand, 'curl')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer shadow-2xs"
            title="Copy request as cURL command"
          >
            {copiedKey === 'curl' ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span className="text-accent font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Terminal className="w-3 h-3 text-zinc-400" />
                <span>cURL</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(headersData.rawHeadersText, 'raw')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer shadow-2xs"
            title="Copy raw response headers"
          >
            {copiedKey === 'raw' ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span className="text-accent font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-400" />
                <span>Raw</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div ref={filterScrollRef} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {[
          { id: 'all', label: 'All', count: stats.totalCount },
          { id: 'security', label: 'Security', count: stats.securityCount },
          { id: 'missing', label: 'Missing', count: stats.missingCount },
          { id: 'caching', label: 'Caching', count: stats.cachingCount },
          { id: 'server', label: 'Server/CDN', count: stats.serverCount },
          { id: 'leaks', label: 'Leaks', count: stats.leakCount },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as HeaderFilterTab)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs rounded-md transition-colors duration-100 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-3xs font-mono font-medium leading-none ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 font-bold'
                    : 'bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Missing Recommended Security Headers Empty / Search States */}
      {activeFilter === 'missing' && headersData.missingSecurityHeaders.length === 0 && (
        <div className="p-8 text-center rounded-lg bg-white dark:bg-zinc-900 border border-emerald-500/30 text-xs space-y-1.5 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-4 h-4" />
          </div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">All Recommended Security Headers Detected</p>
          <p className="text-2xs text-zinc-500 dark:text-zinc-400">
            This server configures essential baseline protections (HSTS, CSP, X-Content-Type-Options, Frame protection, Referrer Policy).
          </p>
        </div>
      )}

      {activeFilter === 'missing' && searchQuery.trim() && filteredMissing.length === 0 && headersData.missingSecurityHeaders.length > 0 && (
        <div className="p-8 text-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 shadow-2xs">
          No missing security headers matched &ldquo;{searchQuery}&rdquo;.
        </div>
      )}

      {/* Recommended Security Headers Callouts */}
      {filteredMissing.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended Security Headers</span>
              <span className="px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-amber-600 text-white shadow-2xs">
                {filteredMissing.length}
              </span>
            </span>
            <span className="text-3xs font-medium text-zinc-400">Missing from HTTP response</span>
          </div>

          <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredMissing.map((missing) => {
              const snippetText = missing.exampleValue
                ? `${missing.name}: ${missing.exampleValue}`
                : missing.recommendation;
              const isCopied = copiedKey === `missing_${missing.name}`;

              return (
                <div key={missing.name} className="p-3.5 space-y-2 text-xs">
                  {/* Header Row: Title & Severity */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {missing.name}
                    </span>
                    <Badge variant="severity" severity={missing.severity} />
                  </div>

                  {/* Clean Human Description */}
                  <p className="text-2xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {missing.description}
                  </p>

                  {/* Dedicated Code Snippet Box with Copy Button */}
                  <div className="group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 text-2xs font-mono">
                    <div className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200 font-mono" title={snippetText}>
                      <span className="text-zinc-400 dark:text-zinc-500 select-none">{missing.name}: </span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium select-all">
                        {missing.exampleValue || missing.recommendation.replace(/^Add\s+|^Set\s+/i, '')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(snippetText, `missing_${missing.name}`)}
                      aria-label={`Copy snippet for ${missing.name}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium transition-colors duration-150 cursor-pointer shrink-0 min-h-[24px] ${
                        isCopied
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-2xs'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Observed Response Headers List (hidden on 'missing' tab) */}
      {activeFilter !== 'missing' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-0.5">
            <span>Observed Headers ({filteredHeaders.length})</span>
          </div>

          {filteredHeaders.length === 0 ? (
            searchQuery.trim() ? (
              <div className="p-8 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500">
                No headers matched &ldquo;{searchQuery}&rdquo; in this filter.
              </div>
            ) : activeFilter === 'security' ? (
              <div className="p-6 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                <Shield className="w-5 h-5 text-zinc-400 mx-auto" />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">No security headers observed in this response.</p>
                {stats.missingCount > 0 && (
                  <p className="text-2xs text-amber-600 dark:text-amber-400">
                    {stats.missingCount} recommended security headers are missing.{' '}
                    <button
                      type="button"
                      onClick={() => setActiveFilter('missing')}
                      className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer"
                    >
                      View Missing ({stats.missingCount})
                    </button>
                  </p>
                )}
              </div>
            ) : activeFilter === 'caching' ? (
              <div className="p-6 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                <Clock className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                <p>No caching headers (Cache-Control, ETag, Expires) observed.</p>
              </div>
            ) : activeFilter === 'server' ? (
              <div className="p-6 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                <Server className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                <p>No server or CDN routing headers observed.</p>
              </div>
            ) : activeFilter === 'leaks' ? (
              <div className="p-6 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">No information leaks detected.</p>
                <p className="text-2xs text-zinc-400">Server software and backend versions are properly suppressed.</p>
              </div>
            ) : (
              <div className="p-8 text-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500">
                No response headers recorded.
              </div>
            )
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Observed Response Headers"
              className="overflow-hidden rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/70"
            >
              {filteredHeaders.map((header) => {
              const isExpanded = Boolean(expandedInsights[header.name]);
              const isLeak = header.status === 'leak';
              const isSecure = header.status === 'secure';

              return (
                <div
                  key={header.name}
                  className={`deferred-list-item p-3 transition-colors duration-100 space-y-1.5 ${
                    isLeak
                      ? 'bg-rose-500/5 dark:bg-rose-500/10'
                      : isSecure
                      ? 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'
                      : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  {/* Header Top Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold text-xs text-zinc-900 dark:text-zinc-100 break-all">
                        {header.name}
                      </span>

                      <span className="px-2 py-0.5 rounded text-2xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize leading-none">
                        {header.category}
                      </span>

                      {isSecure && (
                        <Badge variant="status" status="passed">
                          <Shield className="w-3 h-3 text-white" />
                          <span>Secure</span>
                        </Badge>
                      )}

                      {isLeak && (
                        <Badge variant="status" status="failed">
                          <AlertTriangle className="w-3 h-3 text-white" />
                          <span>Info leak</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(header.value, header.name)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        title="Copy header value"
                        aria-label={`Copy value for ${header.name}`}
                      >
                        {copiedKey === header.name ? (
                          <Check className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {(header.description || header.recommendation) && (
                        <button
                          type="button"
                          onClick={() => toggleInsight(header.name)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                          title="Toggle details"
                          aria-label={`Toggle details for ${header.name}`}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Header Value */}
                  <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all select-all leading-relaxed">
                    {header.value}
                  </div>

                  {/* Expandable Insight / Recommendation */}
                  {isExpanded && (header.description || header.recommendation) && (
                    <div className="pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-2xs text-zinc-600 dark:text-zinc-400">
                      {header.description && (
                        <p className="leading-relaxed">
                          <strong className="text-zinc-800 dark:text-zinc-200">Analysis:</strong> {header.description}
                        </p>
                      )}
                      {header.recommendation && (
                        <p className="leading-relaxed font-mono text-zinc-700 dark:text-zinc-300">
                          <strong className="font-sans text-zinc-800 dark:text-zinc-200">Recommendation:</strong> {header.recommendation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

