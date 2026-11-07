/**
 * @file entrypoints/popup/components/FindingsExplorer.tsx
 * @description Clean, editorial findings explorer with unified list layout,
 * inline accordion inspection, compact filter controls, and category context banners.
 * Eliminates "too much card" visual clutter (Feature 45).
 */

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
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
} from 'lucide-react';
import type { AuditFinding, Severity, FindingStatus, CategoryScore } from '@/types/inspection';
import { FindingDetailInspector } from './FindingDetailInspector';
import { CustomSelect } from './CustomSelect';
import { Badge } from './Badge';
import { Card } from './Card';
import { sortFindingsByPriority } from '../../../src/analyzers';

interface FindingsExplorerProps {
  findings: AuditFinding[];
  activeSeverityFilter: Severity | 'all';
  activeCategoryFilter?: string;
  onSelectSeverityFilter: (severity: Severity | 'all') => void;
  onSelectCategoryFilter?: (category: string) => void;
  onSelectFinding?: (finding: AuditFinding) => void;
  initialExpandedFindingId?: string | null;
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

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  activeSeverityFilter = 'all',
  activeCategoryFilter = 'all',
  onSelectSeverityFilter,
  onSelectCategoryFilter,
  onSelectFinding,
  initialExpandedFindingId,
  scores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<FindingStatus | 'all'>('all');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(initialExpandedFindingId || null);

  const toggleFinding = (id: string) => {
    setExpandedFindingId((prev) => (prev === id ? null : id));
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
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-7 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none transition-colors shadow-2xs"
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
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <CategoryIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  {activeCategoryFilter} Audit
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {currentCategoryScore.totalChecks} checks evaluated · {currentCategoryScore.coveragePercent ?? 100}% coverage
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
                <span>{currentCategoryScore.failed} Failed</span>
              </span>
            )}

            {currentCategoryScore.warnings > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                <span>{currentCategoryScore.warnings} Warnings</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>{currentCategoryScore.passed} Passed</span>
            </span>

            {(currentCategoryScore.unavailable ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                <HelpCircle className="w-3 h-3" />
                <span>{currentCategoryScore.unavailable} Unobservable</span>
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
            ({actualIssuesInFiltered.length} {actualIssuesInFiltered.length === 1 ? 'issue' : 'issues'})
          </span>
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
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
                className="text-xs text-orange-600 dark:text-orange-400 font-semibold underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          filteredFindings.map((finding, idx) => {
            const isExpanded = expandedFindingId === finding.id;
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
                      toggleFinding(finding.id);
                      if (onSelectFinding) onSelectFinding(finding);
                    }}
                    className="p-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-all duration-150 ease-out active:scale-[0.995] cursor-pointer select-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {finding.status === 'passed' ? (
                          <span
                            title="Check passed"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 select-none"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        ) : finding.status === 'not-available' || finding.status === 'not-applicable' ? (
                          <span
                            data-status="not-available"
                            title={finding.status === 'not-available' ? 'Not Available' : 'Not Applicable'}
                            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0 select-none"
                          >
                            <Minus className="w-2.5 h-2.5 text-zinc-400" />
                            <span>N/A</span>
                          </span>
                        ) : (
                          <>
                            <Badge variant="severity" severity={finding.severity} status={finding.status}>
                              {finding.severity}
                            </Badge>
                            <Badge variant="status" status={finding.status}>
                              {finding.status}
                            </Badge>
                          </>
                        )}
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                          {finding.category ? `${finding.category} · ` : ''}{finding.ruleId}
                        </span>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-orange-500 shrink-0 mt-0.5 transition-transform duration-200 ease-out" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5 transition-transform duration-200 ease-out" />
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 line-clamp-1">
                      {finding.title}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1 leading-relaxed">
                      {finding.description}
                    </p>
                  </div>

                  {/* Inline Clean Expanded Detail Panel - Rule 1 (Ease-out for entrances), Rule 13 (No bounce) */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-950/50 transition-all duration-200 ease-out animate-in fade-in-0 slide-in-from-top-1">
                      <FindingDetailInspector
                        finding={finding}
                        onCollapse={() => toggleFinding(finding.id)}
                      />
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </Card>
    </div>
  );
};
