
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
  AlertOctagon,
  AlertCircle,
  XCircle,
  MinusCircle,
  Shield,
  Zap,
  UserCheck,
  Layers,
  Info,
  HelpCircle,
  Copy,
  MessageSquareText,
  Bot,
} from 'lucide-react';
import type { AuditFinding, Severity, FindingStatus, CategoryScore } from '@/types/inspection';
import { FindingDetailInspector } from './FindingDetailInspector';
import { CustomSelect } from './CustomSelect';
import { Card } from './Card';
import { Badge } from './Badge';
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
  aeo: MessageSquareText,
  ago: Bot,
  accessibility: UserCheck,
  'best-practices': Layers,
};

export type FindingBucket = 'critical' | 'warning' | 'passed' | 'not-available';

export function getFindingBucket(finding: AuditFinding): FindingBucket {
  if (finding.status === 'passed') return 'passed';
  if (finding.status === 'not-available' || finding.status === 'not-applicable') return 'not-available';
  if (finding.status === 'failed' || finding.status === 'error' || finding.severity === 'critical') return 'critical';
  return 'warning';
}

export type FindingFilterType = 'all' | 'issues' | 'critical' | 'warnings' | 'passed';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Checks' },
  { value: 'issues', label: 'All Issues' },
  { value: 'critical', label: 'Critical' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'passed', label: 'Passed' },
];

function renderFindingStatusIcon(finding: AuditFinding) {
  const bucket = getFindingBucket(finding);

  if (bucket === 'passed') {
    return (
      <span
        data-status="passed"
        title="Check passed"
        className="inline-flex items-center justify-center shrink-0 select-none text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 className="w-4 h-4" />
      </span>
    );
  }

  if (bucket === 'critical') {
    return (
      <span
        data-status="failed"
        title="Critical"
        className="inline-flex items-center justify-center shrink-0 select-none text-rose-500 dark:text-rose-400"
      >
        <XCircle className="w-4 h-4" />
      </span>
    );
  }

  if (bucket === 'warning') {
    return (
      <span
        data-status="warning"
        title="Warning"
        className="inline-flex items-center justify-center shrink-0 select-none text-amber-500 dark:text-amber-400"
      >
        <AlertTriangle className="w-4 h-4" />
      </span>
    );
  }

  return (
    <span
      data-status="not-available"
      title={finding.status === 'not-available' ? 'Not Available' : 'Not Applicable'}
      className="inline-flex items-center justify-center shrink-0 select-none text-zinc-400 dark:text-zinc-500"
    >
      <MinusCircle className="w-4 h-4" />
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
  const [bucketFilter, setBucketFilter] = useState<FindingFilterType>('all');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    initialSelectedFindingId || null,
  );
  const [copiedFindingId, setCopiedFindingId] = useState<string | null>(null);

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.category) set.add(f.category);
    }
    return Array.from(set).sort();
  }, [findings]);

  const filteredFindings = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();

    const matches = findings.filter((f) => {
      if (activeSeverityFilter !== 'all') {
        if (activeSeverityFilter === 'critical' || activeSeverityFilter === 'high') {
          if (getFindingBucket(f) !== 'critical') return false;
        } else if (
          activeSeverityFilter === 'medium' ||
          activeSeverityFilter === 'low' ||
          activeSeverityFilter === 'info'
        ) {
          if (getFindingBucket(f) !== 'warning') return false;
        }
      }

      if (activeCategoryFilter !== 'all') {
        const cat = activeCategoryFilter.toLowerCase();
        if (cat === 'aeo') {
          if (!f.ruleId.startsWith('aeo-')) return false;
        } else if (cat === 'ago') {
          if (!f.ruleId.startsWith('ago-')) return false;
        } else if (cat === 'seo') {
          if (f.category?.toLowerCase() !== 'seo' || f.ruleId.startsWith('aeo-')) return false;
        } else if (cat === 'accessibility') {
          if (f.category?.toLowerCase() !== 'accessibility' || f.ruleId.startsWith('ago-')) return false;
        } else if (f.category?.toLowerCase() !== cat) {
          return false;
        }
      }

      if (bucketFilter !== 'all') {
        const bucket = getFindingBucket(f);
        if (bucketFilter === 'issues') {
          if (bucket !== 'critical' && bucket !== 'warning') return false;
        } else if (bucketFilter === 'critical') {
          if (bucket !== 'critical') return false;
        } else if (bucketFilter === 'warnings') {
          if (bucket !== 'warning') return false;
        } else if (bucketFilter === 'passed') {
          if (bucket !== 'passed') return false;
        }
      }

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
  }, [findings, activeSeverityFilter, activeCategoryFilter, bucketFilter, deferredQuery]);

  const actualIssuesInFiltered = useMemo(
    () =>
      filteredFindings.filter((f) => {
        const b = getFindingBucket(f);
        return b === 'critical' || b === 'warning';
      }),
    [filteredFindings],
  );

  const hasActiveFilters =
    activeSeverityFilter !== 'all' ||
    activeCategoryFilter !== 'all' ||
    bucketFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSearchQuery('');
    if (onSelectCategoryFilter) onSelectCategoryFilter('all');
    setBucketFilter('all');
    onSelectSeverityFilter('all');
  };

  const categoryOptions = useMemo(() => {
    const hasAeo = findings.some((f) => f.ruleId.startsWith('aeo-'));
    const hasAgo = findings.some((f) => f.ruleId.startsWith('ago-'));

    const baseOptions = [
      { value: 'all', label: 'All Categories' },
      ...categories.map((cat) => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        icon: CATEGORY_ICONS[cat.toLowerCase()] || Layers,
      })),
    ];

    if (hasAeo) {
      baseOptions.push({
        value: 'aeo',
        label: 'AEO (Answer Engine)',
        icon: MessageSquareText,
      });
    }

    if (hasAgo) {
      baseOptions.push({
        value: 'ago',
        label: 'AGO (Agentic Engine)',
        icon: Bot,
      });
    }

    return baseOptions;
  }, [categories, findings]);

  const currentCategoryScore = useMemo(() => {
    if (!activeCategoryFilter || activeCategoryFilter === 'all') return undefined;
    const cat = activeCategoryFilter.toLowerCase();
    if (scores && scores[cat]) return scores[cat];

    if (cat === 'aeo') {
      const aeoFindings = findings.filter((f) => f.ruleId.startsWith('aeo-'));
      if (aeoFindings.length === 0) return undefined;
      const passed = aeoFindings.filter((f) => f.status === 'passed').length;
      const failed = aeoFindings.filter((f) => f.status === 'failed').length;
      const warnings = aeoFindings.filter((f) => f.status === 'warning').length;
      const unavailable = aeoFindings.filter((f) => f.status === 'not-available' || f.status === 'not-applicable').length;
      let points = 0;
      aeoFindings.forEach((f) => {
        if (f.status === 'passed') points += 100;
        else if (f.status === 'info') points += 85;
        else if (f.status === 'warning') points += 50;
        else points += 10;
      });
      return {
        category: 'aeo',
        score: Math.round(points / aeoFindings.length),
        totalChecks: aeoFindings.length,
        passed,
        failed,
        warnings,
        unavailable,
        coveragePercent: 100,
        weight: 1,
      };
    }

    if (cat === 'ago') {
      const agoFindings = findings.filter((f) => f.ruleId.startsWith('ago-'));
      if (agoFindings.length === 0) return undefined;
      const passed = agoFindings.filter((f) => f.status === 'passed').length;
      const failed = agoFindings.filter((f) => f.status === 'failed').length;
      const warnings = agoFindings.filter((f) => f.status === 'warning').length;
      const unavailable = agoFindings.filter((f) => f.status === 'not-available' || f.status === 'not-applicable').length;
      let points = 0;
      agoFindings.forEach((f) => {
        if (f.status === 'passed') points += 100;
        else if (f.status === 'warning') points += 55;
        else points += 15;
      });
      return {
        category: 'ago',
        score: Math.round(points / agoFindings.length),
        totalChecks: agoFindings.length,
        passed,
        failed,
        warnings,
        unavailable,
        coveragePercent: 100,
        weight: 1,
      };
    }

    return undefined;
  }, [activeCategoryFilter, scores, findings]);
  const CategoryIcon =
    (activeCategoryFilter !== 'all' && CATEGORY_ICONS[activeCategoryFilter.toLowerCase()]) || Layers;

  const firstNonIssueIndex = useMemo(() => {
    if (actualIssuesInFiltered.length === 0) return -1;
    return filteredFindings.findIndex((f) => f.status !== 'failed' && f.status !== 'warning');
  }, [filteredFindings, actualIssuesInFiltered]);

  if (selectedFinding) {
    const FindingCategoryIcon =
      (selectedFinding.category && CATEGORY_ICONS[selectedFinding.category.toLowerCase()]) || Layers;

    return (
      <div className="p-4 space-y-3.5 bg-app-bg text-zinc-900 dark:text-zinc-100 select-none animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedFindingId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer py-1"
            title="Return to issues list (Escape)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Issues</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {selectedFinding.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium capitalize bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                <FindingCategoryIcon className="w-3 h-3" />
                <span>{selectedFinding.category}</span>
              </span>
            )}

            {selectedFinding.status === 'passed' ? (
              <Badge variant="status" status="passed" />
            ) : selectedFinding.status === 'not-available' || selectedFinding.status === 'not-applicable' ? (
              <Badge variant="status" status="not-available" />
            ) : (
              <Badge variant="severity" severity={selectedFinding.severity} />
            )}
          </div>
        </div>

        <Card padding="md" className="space-y-4">
          <div className="space-y-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-3.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {renderFindingStatusIcon(selectedFinding)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {selectedFinding.title.replace(/^axe:\s*/i, '')}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xs font-mono text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80">
                    {selectedFinding.ruleId}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1">
              {selectedFinding.description}
            </p>
          </div>

          <FindingDetailInspector
            finding={selectedFinding}
            onBack={() => setSelectedFindingId(null)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-app-bg text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search issues, rules..."
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-7 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-accent focus:outline-none transition-colors shadow-2xs"
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

        <CustomSelect
          value={activeCategoryFilter}
          options={categoryOptions}
          onChange={(val) => {
            if (onSelectCategoryFilter) onSelectCategoryFilter(val);
          }}
          className="min-w-[125px]"
        />

        <CustomSelect
          value={bucketFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(val) => {
            setBucketFilter(val as FindingFilterType);
            if (activeSeverityFilter !== 'all') {
              onSelectSeverityFilter('all');
            }
          }}
          className="min-w-[110px]"
        />
      </div>

      {currentCategoryScore && (
        <div className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-accent/15 text-accent">
                <CategoryIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                  {activeCategoryFilter} Audit
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="tabular-nums">{currentCategoryScore.totalChecks}</span> checks evaluated · <span className="tabular-nums">{currentCategoryScore.coveragePercent ?? 100}</span>% coverage
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                {Math.round(currentCategoryScore.score)}
              </span>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">/100</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            {currentCategoryScore.failed > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                <span><span className="tabular-nums">{currentCategoryScore.failed}</span> Critical</span>
              </span>
            )}

            {currentCategoryScore.warnings > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span><span className="tabular-nums">{currentCategoryScore.warnings}</span> Warnings</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span><span className="tabular-nums">{currentCategoryScore.passed}</span> Passed</span>
            </span>

            {(currentCategoryScore.unavailable ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 font-medium">
                <MinusCircle className="w-3.5 h-3.5" />
                <span><span className="tabular-nums">{currentCategoryScore.unavailable}</span> N/A</span>
              </span>
            )}
          </div>

          {currentCategoryScore.failed === 0 && currentCategoryScore.warnings === 0 && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                All evaluated checks passed cleanly.{(currentCategoryScore.unavailable ?? 0) > 0 ? ' Network headers require background inspection.' : ''}
              </span>
            </div>
          )}
        </div>
      )}

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
            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      <Card padding="none" className="overflow-hidden divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs space-y-2">
            <p>No findings match the current search or filters.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-accent font-semibold underline cursor-pointer"
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
                  <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 text-2xs font-medium text-zinc-500 dark:text-zinc-400">
                    Passed Checks ({filteredFindings.length - idx})
                  </div>
                )}
                <div className="deferred-list-item transition-colors duration-100">
                  <div
                    onClick={() => {
                      setSelectedFindingId(finding.id);
                      if (onSelectFinding) onSelectFinding(finding);
                    }}
                    className="p-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors duration-100 cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderFindingStatusIcon(finding)}

                        {finding.status === 'passed' ? (
                          <Badge variant="status" status="passed" />
                        ) : finding.status === 'not-available' || finding.status === 'not-applicable' ? (
                          <Badge variant="status" status="not-available" />
                        ) : (
                          <Badge variant="severity" severity={finding.severity} />
                        )}

                        <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {finding.title.replace(/^axe:\s*/i, '')}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyFinding(finding, e)}
                          title={copiedFindingId === finding.id ? 'Copied issue JSON!' : 'Copy issue JSON'}
                          aria-label={`Copy JSON for issue ${finding.ruleId}`}
                          className={`p-1 rounded-md transition-colors duration-100 cursor-pointer ${
                            copiedFindingId === finding.id
                              ? 'text-emerald-600 dark:text-accent bg-emerald-500/15 dark:bg-accent/15'
                              : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-accent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {copiedFindingId === finding.id ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-accent shrink-0 transition-colors duration-100" />
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
