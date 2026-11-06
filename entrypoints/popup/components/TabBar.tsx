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
  Download,
} from 'lucide-react';

export type DashboardTab = 'overview' | 'issues' | 'rules' | 'resources' | 'report';

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
  { id: 'report', label: 'Report', icon: Download },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectTab,
  issuesCount,
}) => {
  return (
    <div className="relative border-b border-zinc-200/80 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 px-4 pt-2 select-none">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {STATIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'issues' && issuesCount > 0 ? issuesCount : undefined;

          return (
            <div key={tab.id} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{tab.label}</span>
                {badge !== undefined ? (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md tabular-nums ${
                      isActive
                        ? 'bg-orange-700 text-white'
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
              {/* Active Tab Underline Indicator (rendering-conditional-render) */}
              <div
                className={`h-0.5 rounded-sm w-full mt-1.5 transition-colors ${
                  isActive ? 'bg-orange-500' : 'bg-transparent'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

