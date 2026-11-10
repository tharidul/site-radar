
import React from 'react';
import {
  LayoutGrid,
  AlertTriangle,
  Layers,
  FileText,
  Cookie,
  Info,
} from 'lucide-react';

export type DashboardTab = 'overview' | 'issues' | 'rules' | 'resources' | 'cookies' | 'about';

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
  { id: 'rules', label: 'Rules', icon: Layers },
  { id: 'resources', label: 'Resources', icon: FileText },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
  { id: 'about', label: 'About', icon: Info },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectTab,
  issuesCount,
}) => {
  return (
    <div className="relative border-b border-zinc-200/80 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 px-2 select-none">
      <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar pt-1 pb-0 scroll-smooth">
        {STATIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'issues' && issuesCount > 0 ? issuesCount : undefined;

          return (
            <div key={tab.id} className="relative flex items-center pb-1 shrink-0">
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#152E40] dark:text-[#CEFF52]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-800/60 rounded-md'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#152E40] dark:text-[#CEFF52]' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{tab.label}</span>
                {badge !== undefined ? (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md tabular-nums leading-none ${
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
    </div>
  );
};

