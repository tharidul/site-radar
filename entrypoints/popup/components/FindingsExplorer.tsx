/**
 * @file entrypoints/popup/components/FindingsExplorer.tsx
 * @description Multi-facet findings explorer with text search, severity, category,
 * and status filtering (Feature 45).
 * Styled to seamlessly harmonize with the Website Intelligence redesign.
 */

import React, { useState, useMemo } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import type { AuditFinding, Severity, FindingStatus } from '@/types/inspection';

interface FindingsExplorerProps {
  findings: AuditFinding[];
  activeSeverityFilter: Severity | 'all';
  activeCategoryFilter?: string;
  onSelectSeverityFilter: (severity: Severity | 'all') => void;
  onSelectCategoryFilter?: (category: string) => void;
  onSelectFinding: (finding: AuditFinding) => void;
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  activeSeverityFilter,
  activeCategoryFilter = 'all',
  onSelectSeverityFilter,
  onSelectCategoryFilter,
  onSelectFinding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(activeCategoryFilter);
  const [statusFilter, setStatusFilter] = useState<FindingStatus | 'all'>('all');

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

  // Filter findings based on active criteria
  const filteredFindings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return findings.filter((f) => {
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
        return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-900';
      case 'low':
        return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      case 'info':
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';
    }
  };

  return (
    <div className="p-4 space-y-3 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Issues &amp; Findings
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {filteredFindings.length} of {findings.length}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by rule ID, title, or keyword..."
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-8 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none transition-colors shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Multi-Facet Filter Controls */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              if (onSelectCategoryFilter) onSelectCategoryFilter(e.target.value);
            }}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 text-xs focus:border-orange-500 focus:outline-none shadow-2xs"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 text-xs focus:border-orange-500 focus:outline-none shadow-2xs"
          >
            <option value="all">All Statuses</option>
            <option value="failed">Failed</option>
            <option value="warning">Warning</option>
            <option value="passed">Passed</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Active filters applied
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Findings List */}
      <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
        {filteredFindings.length === 0 ? (
          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-zinc-500 dark:text-zinc-400 text-xs shadow-xs">
            <p>No findings match the current search or filters.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-semibold underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          filteredFindings.map((finding) => (
            <div
              key={finding.id}
              onClick={() => onSelectFinding(finding)}
              className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-orange-400 dark:hover:border-zinc-700 transition-all cursor-pointer select-none shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span
                    className={`text-[10px] uppercase font-bold border rounded-md px-2 py-0.5 shrink-0 ${getSeverityBadgeClass(
                      finding.severity,
                    )}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                    {finding.ruleId}
                  </span>
                  {finding.category && (
                    <span className="text-[10px] capitalize text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-0.5 shrink-0 font-medium">
                      {finding.category}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              </div>

              <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1.5 line-clamp-1">
                {finding.title}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                {finding.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
