/**
 * @file entrypoints/popup/components/FindingsExplorer.tsx
 * @description Clean, editorial findings explorer with unified list layout,
 * inline accordion inspection, compact filter controls, and category context banners.
 * Eliminates "too much card" visual clutter (Feature 45).
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
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

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  activeSeverityFilter,
  activeCategoryFilter = 'all',
  onSelectSeverityFilter,
  onSelectCategoryFilter,
  onSelectFinding,
  initialExpandedFindingId,
  scores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(activeCategoryFilter);
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

  // Sync internal category filter when prop changes
  React.useEffect(() => {
    if (activeCategoryFilter) {
      setCategoryFilter(activeCategoryFilter);
    }
  }, [activeCategoryFilter]);

  // Filter and sort findings: Issues (critical, high, medium, low) on TOP, passed on BOTTOM
  const filteredFindings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const matches = findings.filter((f) => {
      // Severity filter
      if (activeSeverityFilter !== 'all' && f.severity !== activeSeverityFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && f.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
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
  }, [findings, activeSeverityFilter, categoryFilter, statusFilter, searchQuery]);

  // Count actual issues (failed + warning)
  const actualIssuesInFiltered = useMemo(
    () => filteredFindings.filter((f) => f.status === 'failed' || f.status === 'warning'),
    [filteredFindings],
  );

  const hasActiveFilters =
    activeSeverityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    if (onSelectCategoryFilter) onSelectCategoryFilter('all');
    setStatusFilter('all');
    onSelectSeverityFilter('all');
  };

  const getSeverityBadgeClass = (severity: Severity, status: FindingStatus) => {
    // If the check passed or is not-applicable or not-available, do not color-code with alert red/orange!
    if (status === 'passed' || status === 'not-applicable' || status === 'not-available') {
      return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';
    }
    switch (severity) {
      case 'critical':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80';
      case 'high':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80';
      case 'medium':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80';
      case 'low':
        return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800';
      case 'info':
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900';
    }
  };

  const getStatusBadgeClass = (status: FindingStatus) => {
    switch (status) {
      case 'passed':
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 font-bold';
      case 'failed':
        return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 font-bold';
      case 'warning':
        return 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/80 font-bold';
      case 'info':
        return 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 font-semibold';
      case 'not-applicable':
      case 'not-available':
      default:
        return 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 font-medium';
    }
  };

  // Category and Status Dropdown Options
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

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Statuses' },
      { value: 'failed', label: 'Failed' },
      { value: 'warning', label: 'Warning' },
      { value: 'info', label: 'Info' },
      { value: 'not-available', label: 'Not Available' },
      { value: 'passed', label: 'Passed' },
    ],
    [],
  );

  // Category Score Data for Banner
  const currentCategoryScore =
    categoryFilter !== 'all' && scores ? scores[categoryFilter.toLowerCase()] : undefined;
  const CategoryIcon =
    (categoryFilter !== 'all' && CATEGORY_ICONS[categoryFilter.toLowerCase()]) || Layers;

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
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Custom Category Dropdown */}
        <CustomSelect
          value={categoryFilter}
          options={categoryOptions}
          onChange={(val) => {
            setCategoryFilter(val);
            if (onSelectCategoryFilter) onSelectCategoryFilter(val);
          }}
          className="min-w-[125px]"
        />

        {/* Custom Status Dropdown */}
        <CustomSelect
          value={statusFilter}
          options={statusOptions}
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
                  {categoryFilter} Audit
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
              <span className="text-[11px] font-semibold text-zinc-400">/100</span>
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
      <div className="rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-200/60 dark:border-zinc-800">
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
                <div className="transition-colors">
                  {/* Unified Row Item */}
                  <div
                    onClick={() => {
                      toggleFinding(finding.id);
                      if (onSelectFinding) onSelectFinding(finding);
                    }}
                    className="p-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors duration-150 cursor-pointer select-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span
                          className={`text-[10px] uppercase font-bold rounded-md px-1.5 py-0.5 shrink-0 ${getSeverityBadgeClass(
                            finding.severity,
                            finding.status,
                          )}`}
                        >
                          {finding.severity}
                        </span>
                        <span
                          className={`text-[10px] uppercase rounded-md px-1.5 py-0.5 shrink-0 ${getStatusBadgeClass(
                            finding.status,
                          )}`}
                        >
                          {finding.status}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          {finding.category ? `${finding.category} · ` : ''}{finding.ruleId}
                        </span>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 line-clamp-1">
                      {finding.title}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1 leading-relaxed">
                      {finding.description}
                    </p>
                  </div>

                  {/* Inline Clean Expanded Detail Panel (No sub-cards) */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-950/50">
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
      </div>
    </div>
  );
};
