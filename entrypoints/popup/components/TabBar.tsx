/**
 * @file entrypoints/popup/components/TabBar.tsx
 * @description Tab navigation bar matching the Website Intelligence dashboard standard.
 * Provides instant switching between Overview, Issues, Rules, Resources, and Report.
 */

import React from 'react';
import {
  LayoutGrid,
  AlertTriangle,
  Layers,
  FileText,
  Info,
} from 'lucide-react';

export type DashboardTab = 'overview' | 'issues' | 'rules' | 'resources' | 'about';

interface TabBarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  issuesCount: number;
}

// Hoisted static tab definitions (rendering-hoist-jsx)
const STATIC_TABS: Array<{
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'issues', label: 'Issues', icon: AlertTriangle },
  { id: 'rules', label: 'Rules', icon: Layers },
  { id: 'resources', label: 'Resources', icon: FileText },
  { id: 'about', label: 'About', icon: Info },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectTab,
  issuesCount,
}) => {
  return (
    <div className="relative border-b border-zinc-200/80 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 px-4 pt-1 select-none">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {STATIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'issues' && issuesCount > 0 ? issuesCount : undefined;

          return (
            <div key={tab.id} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                  isActive
                    ? 'text-[#152E40] dark:text-[#CEFF52]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-800/60 rounded-md'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{tab.label}</span>
                {badge !== undefined ? (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md tabular-nums ${
                      isActive
                        ? 'bg-[#CEFF52] text-[#152E40] border border-[#CEFF52]'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
              {/* Active Tab Underline Indicator */}
              <div
                className={`h-0.5 -mb-px rounded-full w-full transition-all duration-200 ease-out ${
                  isActive ? 'bg-[#152E40] dark:bg-[#CEFF52] opacity-100 scale-x-100' : 'bg-transparent opacity-0 scale-x-75'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

