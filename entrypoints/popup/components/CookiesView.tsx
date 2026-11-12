
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  Lock,
  ShieldAlert,
  X,
  RefreshCw,
  FileCode,
  Clock,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import type { InspectedCookie, SameSiteStatus } from '@/types/cookies';
import {
  cookieService,
  auditCookie,
  computeAuditSummary,
  formatCookieLifetime,
} from '@/services/cookie.service';

interface CookiesViewProps {
  targetUrl: string;
}

export const CookiesView: React.FC<CookiesViewProps> = ({ targetUrl }) => {
  const [cookies, setCookies] = useState<InspectedCookie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'flagged' | 'session' | 'persistent'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [editingCookie, setEditingCookie] = useState<Partial<InspectedCookie>>({
    name: '',
    value: '',
    domain: '',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    session: true,
  });

  const domainName = useMemo(() => {
    try {
      return new URL(targetUrl).hostname;
    } catch {
      return 'active domain';
    }
  }, [targetUrl]);

  const loadCookies = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await cookieService.getCookies(targetUrl);
      setCookies(list);
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Failed to load cookies');
    } finally {
      setIsLoading(false);
    }
  }, [targetUrl]);

  useEffect(() => {
    loadCookies();
  }, [loadCookies]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const filteredCookies = useMemo(() => {
    let result = cookies;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.value.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q),
      );
    }

    if (filterType === 'flagged') {
      result = result.filter((c) => {
        const audit = auditCookie(c);
        return audit.missingSecure || audit.missingHttpOnly || audit.sameSiteNoneInsecure;
      });
    } else if (filterType === 'session') {
      result = result.filter((c) => c.session);
    } else if (filterType === 'persistent') {
      result = result.filter((c) => !c.session);
    }

    return result;
  }, [cookies, searchQuery, filterType]);

  const summary = useMemo(() => computeAuditSummary(cookies), [cookies]);

  const toggleExpand = useCallback((cookieKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(cookieKey)) {
        next.delete(cookieKey);
      } else {
        next.add(cookieKey);
      }
      return next;
    });
  }, []);

  const areAllExpanded = useMemo(() => {
    if (filteredCookies.length === 0) return false;
    return filteredCookies.every((c) => expandedKeys.has(`${c.name}-${c.domain}-${c.path}`));
  }, [filteredCookies, expandedKeys]);

  const handleToggleExpandAll = useCallback(() => {
    if (areAllExpanded) {
      setExpandedKeys(new Set());
    } else {
      setExpandedKeys(new Set(filteredCookies.map((c) => `${c.name}-${c.domain}-${c.path}`)));
    }
  }, [areAllExpanded, filteredCookies]);

  const handleDelete = async (cookie: InspectedCookie) => {
    try {
      await cookieService.deleteCookie(targetUrl, cookie);
      setCookies((prev) => prev.filter((c) => !(c.name === cookie.name && c.domain === cookie.domain)));
      setFeedbackMessage(`Deleted "${cookie.name}"`);
      setTimeout(() => setFeedbackMessage(null), 2500);
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Delete failed');
    }
  };

  const handleClearAll = async () => {
    try {
      const count = await cookieService.clearAll(targetUrl, cookies);
      setCookies([]);
      setConfirmClearAll(false);
      setFeedbackMessage(`Cleared ${count} cookies`);
      setTimeout(() => setFeedbackMessage(null), 2500);
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Clear all failed');
    }
  };

  const handleSaveCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCookie.name?.trim()) {
      setFeedbackMessage('Cookie name is required');
      return;
    }

    try {
      await cookieService.setCookie(targetUrl, {
        ...editingCookie,
        name: editingCookie.name.trim(),
        domain: editingCookie.domain?.trim() || domainName,
        path: editingCookie.path?.trim() || '/',
      });
      setIsEditing(false);
      await loadCookies();
      setFeedbackMessage(`Saved "${editingCookie.name}"`);
      setTimeout(() => setFeedbackMessage(null), 2500);
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Failed to save cookie');
    }
  };

  const openEditModal = (cookie?: InspectedCookie) => {
    if (cookie) {
      setEditingCookie({ ...cookie });
    } else {
      setEditingCookie({
        name: '',
        value: '',
        domain: domainName,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
        session: true,
        expirationDate: Math.floor(Date.now() / 1000) + 86400 * 30,
      });
    }
    setIsEditing(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;

    try {
      const res = await cookieService.importJson(targetUrl, importJsonText);
      setIsImporting(false);
      setImportJsonText('');
      await loadCookies();
      setFeedbackMessage(`Imported ${res.success} cookies (${res.failed} failed)`);
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Import failed');
    }
  };

  const handleExportDownload = () => {
    const jsonStr = cookieService.exportJson(cookies);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookies-${domainName.replace(/[^a-zA-Z0-9.-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedbackMessage('Exported cookies to JSON');
    setTimeout(() => setFeedbackMessage(null), 2500);
  };

  return (
    <div className="space-y-2.5 pb-8">
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight shrink-0">
            Cookie Manager &amp; Inspector
          </h2>
          <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[120px]" title={domainName}>
            {domainName}
          </span>
          <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
            (Total {summary.total} · Session {summary.sessionCount})
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openEditModal()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-colors duration-100 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cookie</span>
          </button>

          <button
            type="button"
            onClick={handleExportDownload}
            title="Export cookies as JSON"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="sr-only">Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImporting(true)}
            title="Import cookies from JSON"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="sr-only">Import</span>
          </button>

          {filteredCookies.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              title={areAllExpanded ? 'Collapse all cookies' : 'Expand all cookies'}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {areAllExpanded ? <ChevronsUp className="w-3.5 h-3.5" /> : <ChevronsDown className="w-3.5 h-3.5" />}
              <span className="sr-only">{areAllExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {confirmClearAll ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="px-1 py-0.5 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              title="Clear all cookies for this origin"
              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={loadCookies}
            title="Refresh cookies"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search cookies by name or value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:border-[#152E40] dark:focus:border-[#CEFF52] transition-colors"
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

        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-md shrink-0">
          {(['all', 'flagged', 'session', 'persistent'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterType(mode)}
              className={`px-2 py-1 rounded text-xs font-semibold capitalize transition-colors duration-100 cursor-pointer ${
                filterType === mode
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {feedbackMessage && (
        <div className="text-xs font-medium text-zinc-900 dark:text-[#CEFF52] bg-zinc-100 dark:bg-zinc-800/90 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button type="button" onClick={() => setFeedbackMessage(null)} className="cursor-pointer text-zinc-400 hover:text-zinc-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-500">
          Loading domain cookies...
        </div>
      ) : filteredCookies.length === 0 ? (
        <div className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-8 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {searchQuery
              ? `No cookies match "${searchQuery}"`
              : filterType === 'flagged'
              ? 'No security warnings detected on these cookies'
              : 'No cookies found on this origin'}
          </p>
          <button
            type="button"
            onClick={() => openEditModal()}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Cookie</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCookies.map((cookie) => {
            const audit = auditCookie(cookie);
            const lifetime = formatCookieLifetime(cookie);
            const cookieKey = `${cookie.name}-${cookie.domain}-${cookie.path}`;
            const isExpanded = expandedKeys.has(cookieKey);
            const isCopied = copiedKey === cookieKey;

            return (
              <div
                key={cookieKey}
                className={`deferred-list-item rounded-md bg-white dark:bg-zinc-900 border transition-colors duration-100 ${
                  isExpanded
                    ? 'border-zinc-300 dark:border-zinc-700'
                    : 'border-zinc-200/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleExpand(cookieKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(cookieKey);
                    }
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                    isExpanded ? 'rounded-t-md border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/25' : 'rounded-md'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-0 text-[#152E40] dark:text-[#CEFF52]' : '-rotate-90'
                      }`}
                    />

                    <span
                      className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono tracking-tight truncate max-w-[210px] shrink-0"
                      title={cookie.name}
                    >
                      {cookie.name}
                    </span>

                    {cookie.httpOnly && (
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        HttpOnly
                      </span>
                    )}

                    {cookie.secure && (
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        Secure
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums shrink-0 ${
                        lifetime.isExpired
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : lifetime.isSession
                          ? 'text-zinc-500 dark:text-zinc-400'
                          : 'text-emerald-600 dark:text-[#CEFF52] font-semibold'
                      }`}
                      title={lifetime.isSession ? 'Session cookie: deleted when browser closes' : `Expires: ${lifetime.fullDate}`}
                    >
                      <Clock className="w-3 h-3 opacity-75 shrink-0" />
                      <span>{lifetime.label}</span>
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-0.5 shrink-0 ml-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopy(cookie.value, cookieKey)}
                      title="Copy cookie value"
                      className="p-1.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(cookie)}
                      title="Edit cookie"
                      className="p-1.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(cookie)}
                      title="Delete cookie"
                      className="p-1.5 rounded text-zinc-400 hover:text-rose-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-3.5 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50/80 dark:bg-zinc-950/40 p-3 rounded-md border border-zinc-200/50 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 dark:text-zinc-500 w-16 shrink-0">Domain:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold break-all">{cookie.domain}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 dark:text-zinc-500 w-16 shrink-0">Path:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{cookie.path}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <span className="text-zinc-400 dark:text-zinc-500 w-16 shrink-0">Lifetime:</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className={`font-semibold tabular-nums ${
                            lifetime.isExpired
                              ? 'text-rose-600 dark:text-rose-400'
                              : lifetime.isSession
                              ? 'text-zinc-800 dark:text-zinc-200'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}>
                            {lifetime.label}
                          </strong>
                          {!lifetime.isSession && (
                            <span className="text-zinc-500 dark:text-zinc-400">
                              ({lifetime.fullDate})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 dark:text-zinc-500 w-16 shrink-0">SameSite:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 capitalize">{cookie.sameSite || 'Lax'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500 w-16 shrink-0">Flags:</span>
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {cookie.secure ? 'Secure' : 'Insecure (HTTP)'} • {cookie.httpOnly ? 'HttpOnly' : 'Accessible by JS'}
                        </span>
                      </div>
                    </div>

                    {(audit.missingSecure || audit.missingHttpOnly || audit.sameSiteNoneInsecure) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {audit.missingSecure && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Missing Secure (Cleartext transmission risk)</span>
                          </span>
                        )}
                        {audit.missingHttpOnly && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>Script-Accessible (Vulnerable to XSS extraction)</span>
                          </span>
                        )}
                        {audit.sameSiteNoneInsecure && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Insecure SameSite=None without Secure flag</span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Cookie Value</span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono tabular-nums">
                            ({cookie.value.length} characters)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(cookie.value, cookieKey)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-[#CEFF52] transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Value</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div
                        className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all select-all leading-relaxed max-h-56 overflow-y-auto border border-zinc-200/70 dark:border-zinc-800"
                        title="Triple-click to select all"
                      >
                        {cookie.value || <span className="text-zinc-400 italic">&lt;empty value&gt;</span>}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(cookie)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 transition-colors duration-100 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Cookie</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(cookie)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(cookieKey)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                        <span>Collapse</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-md bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {editingCookie.name ? `Edit "${editingCookie.name}"` : 'Create New Cookie'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCookie} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCookie.name || ''}
                  onChange={(e) => setEditingCookie({ ...editingCookie, name: e.target.value })}
                  placeholder="e.g. session_token"
                  className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden focus:border-[#152E40] dark:focus:border-[#CEFF52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Value
                </label>
                <textarea
                  rows={3}
                  value={editingCookie.value || ''}
                  onChange={(e) => setEditingCookie({ ...editingCookie, value: e.target.value })}
                  placeholder="Cookie value payload..."
                  className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden focus:border-[#152E40] dark:focus:border-[#CEFF52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={editingCookie.domain || ''}
                    onChange={(e) => setEditingCookie({ ...editingCookie, domain: e.target.value })}
                    placeholder={domainName}
                    className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Path
                  </label>
                  <input
                    type="text"
                    value={editingCookie.path || '/'}
                    onChange={(e) => setEditingCookie({ ...editingCookie, path: e.target.value })}
                    placeholder="/"
                    className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  SameSite Policy
                </label>
                <select
                  value={editingCookie.sameSite || 'lax'}
                  onChange={(e) => setEditingCookie({ ...editingCookie, sameSite: e.target.value as SameSiteStatus })}
                  className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-hidden"
                >
                  <option value="lax">Lax (Default)</option>
                  <option value="strict">Strict (Highest security)</option>
                  <option value="no_restriction">None (Requires Secure flag)</option>
                  <option value="unspecified">Unspecified</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-5">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCookie.secure ?? false}
                    onChange={(e) => setEditingCookie({ ...editingCookie, secure: e.target.checked })}
                    className="rounded text-[#152E40] dark:text-[#CEFF52]"
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Secure</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCookie.httpOnly ?? false}
                    onChange={(e) => setEditingCookie({ ...editingCookie, httpOnly: e.target.checked })}
                    className="rounded text-[#152E40] dark:text-[#CEFF52]"
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">HttpOnly</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCookie.session ?? true}
                    onChange={(e) => {
                      const isSession = e.target.checked;
                      setEditingCookie({
                        ...editingCookie,
                        session: isSession,
                        expirationDate: isSession
                          ? undefined
                          : editingCookie.expirationDate || Math.floor(Date.now() / 1000) + 86400 * 30,
                      });
                    }}
                    className="rounded text-[#152E40] dark:text-[#CEFF52]"
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Session</span>
                </label>
              </div>

              {!editingCookie.session && (
                <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Lifetime / Expiration Date
                    </label>
                    <span className="text-xs text-zinc-500 font-mono">
                      {editingCookie.expirationDate && editingCookie.expirationDate > 0
                        ? formatCookieLifetime({ session: false, expirationDate: editingCookie.expirationDate }).label
                        : 'Select date'}
                    </span>
                  </div>

                  <input
                    type="datetime-local"
                    value={
                      editingCookie.expirationDate && editingCookie.expirationDate > 0
                        ? new Date(editingCookie.expirationDate * 1000 - new Date().getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : ''
                    }
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const epochSec = Math.floor(new Date(e.target.value).getTime() / 1000);
                      setEditingCookie({ ...editingCookie, expirationDate: epochSec });
                    }}
                    className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden"
                  />

                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-xs text-zinc-400">Presets:</span>
                    {[
                      { label: '+1h', sec: 3600 },
                      { label: '+1d', sec: 86400 },
                      { label: '+7d', sec: 86400 * 7 },
                      { label: '+30d', sec: 86400 * 30 },
                      { label: '+1y', sec: 86400 * 365 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const epochSec = Math.floor(Date.now() / 1000) + preset.sec;
                          setEditingCookie({ ...editingCookie, expirationDate: epochSec });
                        }}
                        className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3.5 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 transition-colors duration-100 cursor-pointer"
                >
                  Save Cookie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImporting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-md bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-zinc-400" />
                <span>Import Cookies from JSON</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsImporting(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-3.5 text-xs">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste an array of cookie objects formatted like Cookie-Editor JSON or standard Chrome cookie records:
              </p>

              <textarea
                rows={6}
                required
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='[{"name": "token", "value": "xyz...", "domain": ".example.com", "path": "/"}]'
                className="w-full px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs focus:outline-hidden"
              />

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="px-3.5 py-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#152E40] dark:bg-[#CEFF52] text-white dark:text-[#152E40] text-xs font-bold hover:opacity-90 transition-colors duration-100 cursor-pointer"
                >
                  Import Cookies
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

