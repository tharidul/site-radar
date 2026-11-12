import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutGrid,
  AlertTriangle,
  Layers,
  FileText,
  Cookie,
  Info,
  Terminal,
  Share2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useHorizontalScroll, type HorizontalScrollState } from '@/utils/useHorizontalScroll';

export type DashboardTab =
  | 'overview'
  | 'issues'
  | 'headers'
  | 'social'
  | 'resources'
  | 'cookies'
  | 'rules'
  | 'about';

interface TabBarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  issuesCount: number;
}

const STATIC_TABS: Array<{
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'issues', label: 'Issues', icon: AlertTriangle },
  { id: 'headers', label: 'Headers', icon: Terminal },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'resources', label: 'Resources', icon: FileText },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
  { id: 'rules', label: 'Rules', icon: Layers },
  { id: 'about', label: 'About', icon: Info },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectTab,
  issuesCount,
}) => {
  const [scrollState, setScrollState] = useState<HorizontalScrollState>({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
    isDragging: false,
  });

  const handleScrollStateChange = useCallback((next: HorizontalScrollState) => {
    setScrollState((prev) =>
      prev.hasOverflow === next.hasOverflow &&
      prev.canScrollLeft === next.canScrollLeft &&
      prev.canScrollRight === next.canScrollRight &&
      prev.isDragging === next.isDragging
        ? prev
        : next,
    );
  }, []);

  const scrollRef = useHorizontalScroll<HTMLDivElement>({
    onScrollStateChange: handleScrollStateChange,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  const scrollByStep = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(120, Math.round(el.clientWidth * 0.45));
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({ left: direction * step, behavior: 'smooth' });
    } else {
      el.scrollLeft += direction * step;
    }
  };

  return (
    <div className="relative flex items-center border-b border-zinc-200/80 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 px-2 select-none">
      {scrollState.canScrollLeft ? (
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          aria-label="Scroll tabs left"
          title="Scroll tabs left"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[#f8f8fa]/95 dark:bg-zinc-950/95 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/80 dark:hover:bg-zinc-800 shadow-xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Audit views"
        className={`flex-1 min-w-0 flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar horizontal-scroll-fade pt-1 pb-0 ${
          scrollState.isDragging ? 'cursor-grabbing' : scrollState.hasOverflow ? 'cursor-grab' : ''
        }`}
      >
        {STATIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'issues' && issuesCount > 0 ? issuesCount : undefined;

          return (
            <div
              key={tab.id}
              data-active={isActive ? 'true' : 'false'}
              className="relative flex items-center pb-1 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 ease-out active:scale-[0.97] cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#152E40] dark:text-[#CEFF52]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-800/60 rounded-md'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{tab.label}</span>
                {badge !== undefined ? (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 text-2xs font-bold rounded-md tabular-nums leading-none ${
                      isActive
                        ? 'bg-[#CEFF52] text-[#152E40] border border-[#CEFF52]'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
              <div
                className={`absolute bottom-0 left-0.5 right-0.5 h-0.5 rounded-full transition-all duration-200 ease-out pointer-events-none ${
                  isActive ? 'bg-[#152E40] dark:bg-[#CEFF52] opacity-100 scale-x-100' : 'bg-transparent opacity-0 scale-x-75'
                }`}
              />
            </div>
          );
        })}
      </div>

      {scrollState.canScrollRight ? (
        <button
          type="button"
          onClick={() => scrollByStep(1)}
          aria-label="Scroll tabs right"
          title="More tabs (drag or scroll)"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[#f8f8fa]/95 dark:bg-zinc-950/95 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/80 dark:hover:bg-zinc-800 shadow-xs transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
};
