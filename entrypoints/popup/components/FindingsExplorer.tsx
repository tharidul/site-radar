/**
 * @file entrypoints/popup/components/FindingsExplorer.tsx
 * @description Clean, editorial findings explorer with unified list layout,
 * inline accordion inspection, compact filter controls, and category context banners.
 * Eliminates "too much card" visual clutter (Feature 45).
 */

import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import {
  Search,
  X,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Minus,
  AlertTriangle,
  Shield,
  Zap,
  UserCheck,
  Layers,
  Info,
  HelpCircle,
  Copy,
} from 'lucide-react';
import type { AuditFinding, Severity, FindingStatus, CategoryScore } from '@/types/inspection';
import { FindingDetailInspector } from './FindingDetailInspector';
import { CustomSelect } from './CustomSelect';
import { Card } from './Card';
import { sortFindingsByPriority } from '../../../src/analyzers';
import { copyFindingJson } from '../../../src/export/download';

interface FindingsExplorerProps {
  findings: AuditFinding[];
  activeSeverityFilter: Severity | 'all';
  activeCategoryFilter?: string;
  onSelectSeverityFilter: (severity: Severity | 'all') => void;
  onSelectCategoryFilter?: (category: string) => void;
  onSelectFinding?: (finding: AuditFinding) => void;
  initialExpandedFindingId?: string | null;
  initialSelectedFindingId?: string | null;
  scores?: Record<string, CategoryScore>;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  performance: Zap,
  seo: Search,
  accessibility: UserCheck,
  'best-practices': Layers,
};

// Static status filter options hoisted to module level (rendering-hoist-jsx)
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'failed', label: 'Failed' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'not-available', label: 'Not Available' },
  { value: 'passed', label: 'Passed' },
];

function renderFindingStatusIcon(finding: AuditFinding) {
  const { status, severity } = finding;

  if (status === 'passed') {
    return (
      <span
        data-status="passed"
        title="Check passed"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#10b981] text-white shrink-0 select-none shadow-2xs"
      >
        <Check className="w-3 h-3 stroke-[3] text-white" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        data-status="failed"
        title={`Failed${severity ? ` • ${severity.toUpperCase()}` : ''}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#ef4444] text-white shrink-0 select-none shadow-2xs"
      >
        <X className="w-3 h-3 stroke-[3] text-white" />
      </span>
    );
  }

  if (status === 'warning') {
    return (
      <span
        data-status="warning"
        title={`Warning${severity ? ` • ${severity.toUpperCase()}` : ''}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#f59e0b] text-white shrink-0 select-none shadow-2xs"
      >
        <AlertTriangle className="w-3 h-3 stroke-[2.5] text-white" />
      </span>
    );
  }

  if (status === 'info') {
    return (
      <span
        data-status="info"
        title="Info"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0ea5e9] text-white shrink-0 select-none shadow-2xs"
      >
        <Info className="w-3 h-3 stroke-[2.5] text-white" />
      </span>
    );
  }

  // not-applicable / not-available
  return (
    <span
      data-status="not-available"
      title={status === 'not-available' ? 'Not Available' : 'Not Applicable'}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-400 dark:bg-zinc-600 text-white shrink-0 select-none shadow-2xs"
    >
      <Minus className="w-2.5 h-2.5 stroke-[3] text-white" />
    </span>
  );
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  activeSeverityFilter = 'all',
  activeCategoryFilter = 'all',
  onSelectSeverityFilter,
  onSelectCategoryFilter,
  onSelectFinding,
  initialExpandedFindingId,
  initialSelectedFindingId,
  scores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<FindingStatus | 'all'>('all');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    initialSelectedFindingId || null,
  );
  const [copiedFindingId, setCopiedFindingId] = useState<string | null>(null);

  // Return to list when Escape key is pressed
  useEffect(() => {
    if (!selectedFindingId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFindingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFindingId]);

  // Lookup active finding for dedicated view
  const selectedFinding = useMemo(() => {
    if (!selectedFindingId) return null;
    return findings.find((f) => f.id === selectedFindingId) || null;
  }, [findings, selectedFindingId]);

  const handleCopyFinding = async (finding: AuditFinding, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const success = await copyFindingJson(finding);
    if (success) {
      setCopiedFindingId(finding.id);
      setTimeout(() => {
        setCopiedFindingId((prev) => (prev === finding.id ? null : prev));
      }, 2000);
    }
  };

  // Discover distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.category) set.add(f.category);
    }
    return Array.from(set).sort();
  }, [findings]);

  // Filter and sort findings: Issues on TOP, passed on BOTTOM.
  // Uses deferredQuery for responsive 60 FPS input typing (rerender-use-deferred-value)
  const filteredFindings = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();

    const matches = findings.filter((f) => {
      // Severity filter
      if (activeSeverityFilter !== 'all' && f.severity !== activeSeverityFilter) {
        return false;
      }

      // Category filter (derived from activeCategoryFilter prop: rerender-derived-state-no-effect)
      if (activeCategoryFilter !== 'all' && f.category?.toLowerCase() !== activeCategoryFilter.toLowerCase()) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && f.status !== statusFilter) {
        return false;
      }

      // Search text query
      if (q) {
        const titleMatch = f.title?.toLowerCase().includes(q);
        const descMatch = f.description?.toLowerCase().includes(q);
        const ruleMatch = f.ruleId?.toLowerCase().includes(q);
        const catMatch = f.category?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !ruleMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });

    return sortFindingsByPriority(matches);
  }, [findings, activeSeverityFilter, activeCategoryFilter, statusFilter, deferredQuery]);

  // Count actual issues (failed + warning)
  const actualIssuesInFiltered = useMemo(
    () => filteredFindings.filter((f) => f.status === 'failed' || f.status === 'warning'),
    [filteredFindings],
  );

  const hasActiveFilters =
    activeSeverityFilter !== 'all' ||
    activeCategoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSearchQuery('');
    if (onSelectCategoryFilter) onSelectCategoryFilter('all');
    setStatusFilter('all');
    onSelectSeverityFilter('all');
  };

  // Category Dropdown Options
  const categoryOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...categories.map((cat) => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        icon: CATEGORY_ICONS[cat.toLowerCase()] || Layers,
      })),
    ];
  }, [categories]);

  // Category Score Data for Banner (derived during render: rerender-derived-state-no-effect)
  const currentCategoryScore =
    activeCategoryFilter !== 'all' && scores ? scores[activeCategoryFilter.toLowerCase()] : undefined;
  const CategoryIcon =
    (activeCategoryFilter !== 'all' && CATEGORY_ICONS[activeCategoryFilter.toLowerCase()]) || Layers;

  // First non-issue index to render clean section header
  const firstNonIssueIndex = useMemo(() => {
    if (actualIssuesInFiltered.length === 0) return -1;
    return filteredFindings.findIndex((f) => f.status !== 'failed' && f.status !== 'warning');
  }, [filteredFindings, actualIssuesInFiltered]);

  // Dedicated Finding Detail View: Transitions cleanly without inline accordion repaints
  if (selectedFinding) {
    const FindingCategoryIcon =
      (selectedFinding.category && CATEGORY_ICONS[selectedFinding.category.toLowerCase()]) || Layers;

    return (
      <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none animate-in fade-in-0 duration-150">
        {/* Top Navigation Bar: Back button + Badges */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedFindingId(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-[#CEFF52] transition-colors shadow-2xs cursor-pointer"
            title="Return to issues list (Escape)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Issues</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {/* Category Pill */}
            {selectedFinding.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                <FindingCategoryIcon className="w-3 h-3" />
                <span>{selectedFinding.category}</span>
              </span>
            )}

            {/* Severity Pill */}
            {selectedFinding.status !== 'passed' &&
              selectedFinding.status !== 'not-available' &&
              selectedFinding.status !== 'not-applicable' &&
              selectedFinding.severity && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider ${
                    selectedFinding.severity === 'critical'
                      ? 'bg-rose-500/15 text-[#dc2626] dark:text-[#f87171] border border-rose-500/30'
                      : selectedFinding.severity === 'high'
                      ? 'bg-orange-500/15 text-[#ea580c] dark:text-[#fb923c] border border-orange-500/30'
                      : selectedFinding.severity === 'medium'
                      ? 'bg-amber-500/15 text-[#d97706] dark:text-[#fbbf24] border border-amber-500/30'
                      : selectedFinding.severity === 'info'
                      ? 'bg-sky-500/15 text-[#0284c7] dark:text-[#38bdf8] border border-sky-500/30'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {selectedFinding.severity}
                </span>
              )}
          </div>
        </div>

        {/* Dedicated Finding Card Container */}
        <Card padding="md" className="space-y-4 shadow-xs">
          {/* Finding Header */}
          <div className="space-y-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-3.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {renderFindingStatusIcon(selectedFinding)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {selectedFinding.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80">
                    rule: {selectedFinding.ruleId}
                  </span>
                  {selectedFinding.source && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      source: {selectedFinding.source}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1">
              {selectedFinding.description}
            </p>
          </div>

          {/* Full Inspector Body */}
          <FindingDetailInspector
            finding={selectedFinding}
            onBack={() => setSelectedFindingId(null)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* Streamlined Filter Toolbar (Single Row: Search + Category + Status) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search issues, rules..."
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-7 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[#CEFF52] focus:outline-none transition-colors shadow-2xs"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Custom Category Dropdown */}
        <CustomSelect
          value={activeCategoryFilter}
          options={categoryOptions}
          onChange={(val) => {
            if (onSelectCategoryFilter) onSelectCategoryFilter(val);
          }}
          className="min-w-[125px]"
        />

        {/* Custom Status Dropdown (Hoisted static options: rendering-hoist-jsx) */}
        <CustomSelect
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(val) => setStatusFilter(val as any)}
          className="min-w-[105px]"
        />
      </div>

      {/* Category Overview Card (visible when filtered to a specific category) */}
      {currentCategoryScore && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-xs space-y-2 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#CEFF52]/15 text-[#152E40] dark:text-[#CEFF52]">
                <CategoryIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  {activeCategoryFilter} Audit
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="tabular-nums">{currentCategoryScore.totalChecks}</span> checks evaluated · <span className="tabular-nums">{currentCategoryScore.coveragePercent ?? 100}</span>% coverage
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                {Math.round(currentCategoryScore.score)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">/100</span>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            {currentCategoryScore.failed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold">
                <X className="w-3 h-3" />
                <span><span className="tabular-nums">{currentCategoryScore.failed}</span> Failed</span>
              </span>
            )}

            {currentCategoryScore.warnings > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                <span><span className="tabular-nums">{currentCategoryScore.warnings}</span> Warnings</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span><span className="tabular-nums">{currentCategoryScore.passed}</span> Passed</span>
            </span>

            {(currentCategoryScore.unavailable ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                <HelpCircle className="w-3 h-3" />
                <span><span className="tabular-nums">{currentCategoryScore.unavailable}</span> Unobservable</span>
              </span>
            )}
          </div>

          {/* Context note: Shown when all evaluated checks passed cleanly */}
          {currentCategoryScore.failed === 0 && currentCategoryScore.warnings === 0 && (
            <div className="text-[11px] rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 p-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                All evaluated checks passed cleanly.{(currentCategoryScore.unavailable ?? 0) > 0 ? ' Network headers require background inspection.' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Header bar: Count & Active filter reset */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-0.5">
        <span>
          Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{filteredFindings.length}</span> checks{' '}
          <span className="text-zinc-400 dark:text-zinc-500">
            (<span className="tabular-nums">{actualIssuesInFiltered.length}</span> {actualIssuesInFiltered.length === 1 ? 'issue' : 'issues'})
          </span>
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-[#152E40] dark:text-[#CEFF52] hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Unified Findings List (Single container, zero individual floating cards) */}
      <Card padding="none" className="overflow-hidden divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs space-y-2">
            <p>No findings match the current search or filters.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[#152E40] dark:text-[#CEFF52] font-semibold underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          filteredFindings.map((finding, idx) => {
            const isFirstNonIssue = idx === firstNonIssueIndex;

            return (
              <React.Fragment key={finding.id}>
                {isFirstNonIssue && (
                  <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Passed &amp; Unobservable Checks ({filteredFindings.length - idx})
                  </div>
                )}
                <div
                  className="transition-colors"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '0 56px' }}
                >
                  {/* Unified Row Item */}
                  <div
                    onClick={() => {
                      setSelectedFindingId(finding.id);
                      if (onSelectFinding) onSelectFinding(finding);
                    }}
                    className="p-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-all duration-150 ease-out active:scale-[0.995] cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderFindingStatusIcon(finding)}

                        {finding.status !== 'passed' &&
                          finding.status !== 'not-available' &&
                          finding.status !== 'not-applicable' &&
                          finding.severity && (
                            <span
                              className={`text-[10px] font-bold font-mono uppercase tracking-wider shrink-0 ${
                                finding.severity === 'critical'
                                  ? 'text-[#dc2626] dark:text-[#f87171]'
                                  : finding.severity === 'high'
                                  ? 'text-[#ea580c] dark:text-[#fb923c]'
                                  : finding.severity === 'medium'
                                  ? 'text-[#d97706] dark:text-[#fbbf24]'
                                  : finding.severity === 'info'
                                  ? 'text-[#0284c7] dark:text-[#38bdf8]'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {finding.severity}
                            </span>
                          )}

                        <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {finding.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyFinding(finding, e)}
                          title={copiedFindingId === finding.id ? 'Copied issue JSON!' : 'Copy issue JSON'}
                          aria-label={`Copy JSON for issue ${finding.ruleId}`}
                          className={`p-1 rounded-md transition-all duration-150 cursor-pointer ${
                            copiedFindingId === finding.id
                              ? 'text-emerald-600 dark:text-[#CEFF52] bg-emerald-500/15 dark:bg-[#CEFF52]/15'
                              : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-[#CEFF52] hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {copiedFindingId === finding.id ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-[#CEFF52] shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1 leading-relaxed">
                      {finding.description}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </Card>
    </div>
  );
};
