/**
 * @file entrypoints/popup/components/FindingsExplorer.tsx
 * @description Clean, editorial findings explorer with unified list layout,
 * inline accordion inspection, and compact filter controls.
 * Eliminates "too much card" visual clutter (Feature 45).
 */

import React, { useState, useMemo } from 'react';
import { Search, X, ChevronRight, ChevronDown } from 'lucide-react';
import type { AuditFinding, Severity, FindingStatus } from '@/types/inspection';
import { FindingDetailInspector } from './FindingDetailInspector';
import { sortFindingsByPriority } from '../../../src/analyzers';

interface FindingsExplorerProps {
  findings: AuditFinding[];
  activeSeverityFilter: Severity | 'all';
  activeCategoryFilter?: string;
  onSelectSeverityFilter: (severity: Severity | 'all') => void;
  onSelectCategoryFilter?: (category: string) => void;
  onSelectFinding?: (finding: AuditFinding) => void;
  initialExpandedFindingId?: string | null;
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  activeSeverityFilter,
  activeCategoryFilter = 'all',
  onSelectSeverityFilter,
  onSelectCategoryFilter,
  onSelectFinding,
  initialExpandedFindingId,
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

  const getSeverityBadgeClass = (severity: Severity) => {
    switch (severity) {
      case 'critical':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900';
      case 'high':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-900';
      case 'medium':
        return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-900';
      case 'low':
        return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      case 'info':
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';
    }
  };

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

        {/* Category Dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            if (onSelectCategoryFilter) onSelectCategoryFilter(e.target.value);
          }}
          className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:border-orange-500 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:border-orange-500 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="failed">Failed</option>
          <option value="warning">Warning</option>
          <option value="passed">Passed</option>
        </select>
      </div>

      {/* Header bar: Count & Active filter reset */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-0.5">
        <span>
          Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{filteredFindings.length}</span> of{' '}
          <span className="tabular-nums">{findings.length}</span> issues
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
      <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs divide-y divide-zinc-100 dark:divide-zinc-800/80">
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
          filteredFindings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;

            return (
              <div key={finding.id} className="transition-colors">
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
                        className={`text-[10px] uppercase font-bold border rounded-md px-1.5 py-0.5 shrink-0 ${getSeverityBadgeClass(
                          finding.severity,
                        )}`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-0.5 shrink-0">
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
            );
          })
        )}
      </div>
    </div>
  );
};
