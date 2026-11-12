
import React from 'react';
import { Layers, Compass, Play, ExternalLink, Check } from 'lucide-react';
import type { InspectionMode } from '@/types/inspection';
import { Button } from './Button';

interface ModeSelectorProps {
  selectedMode: InspectionMode;
  onSelectMode: (mode: InspectionMode) => void;
  onStartInspection: () => void;
  disabled: boolean;
  disabledReason?: string;
  refreshPage?: boolean;
  onToggleRefreshPage?: (enabled: boolean) => void;
}

interface ModeOption {
  id: InspectionMode;
  title: string;
  scope: string;
  duration: string;
  highlights: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const MODES: ModeOption[] = [
  {
    id: 'full',
    title: 'Full Page Audit',
    scope: 'Audits only the tab currently open.',
    duration: '~3-5s',
    highlights: [
      'Speed, scripts & media weight',
      'Security headers, HTTPS & forms',
      'SEO tags, links & Schema data',
      'WCAG accessibility & trackers',
    ],
    icon: Layers,
  },
  {
    id: 'deep',
    title: 'Deep Inspection',
    scope: 'Full audit plus site & server checks.',
    duration: '~10-20s',
    highlights: [
      'Everything in Full Page Audit',
      'Crawls linked same-site pages',
      'Reads robots.txt & XML sitemaps',
      'DNS, IP/ASN & TLS cert lookups',
    ],
    icon: Compass,
  },
];

function openPrivacyPolicy() {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html'), active: true });
    } else {
      window.open('privacy-policy.html', '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open('privacy-policy.html', '_blank', 'noopener,noreferrer');
  }
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  onStartInspection,
  disabled,
  disabledReason,
  refreshPage = true,
  onToggleRefreshPage,
}) => {
  return (
    <div className="min-h-full p-4 flex flex-col justify-between gap-4 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="space-y-3.5">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Choose Audit Depth
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Scan just this page, or run a full site crawl with DNS and SSL lookups.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Audit depth"
          className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-3"
        >
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectMode(mode.id)}
                className={`flex flex-col text-left h-full rounded-xl p-3.5 transition-all duration-150 ease-out active:scale-[0.99] cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-white dark:bg-zinc-900 border-[#152E40] dark:border-[#CEFF52] ring-1 ring-[#152E40] dark:ring-[#CEFF52]'
                    : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#CEFF52] text-[#152E40]'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {mode.title}
                    </span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                    {mode.duration}
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 leading-snug">
                  {mode.scope}
                </p>

                <ul className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 w-full">
                  {mode.highlights.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-snug"
                    >
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          isSelected
                            ? 'text-[#152E40] dark:text-[#CEFF52]'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 px-0.5 py-0.5">
          <input
            type="checkbox"
            checked={refreshPage}
            onChange={(e) => onToggleRefreshPage?.(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-[#152E40] dark:text-[#CEFF52] accent-[#152E40] dark:accent-[#CEFF52] cursor-pointer"
          />
          <span>Hard refresh (clear cache) before scan</span>
        </label>

        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={disabled}
          onClick={onStartInspection}
          leftIcon={<Play className="w-4 h-4 fill-current ml-0.5" />}
          className="w-full py-2.5"
        >
          {disabled
            ? disabledReason || 'Cannot start audit'
            : `Start ${selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
        </Button>
      </div>

      <div className="pt-2.5 flex items-center justify-center gap-3 border-t border-zinc-200/70 dark:border-zinc-800/80 text-xs select-none">
        <button
          type="button"
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: 'https://tharidulakmal.com' });
            } else {
              window.open('https://tharidulakmal.com', '_blank');
            }
          }}
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-[#152E40] dark:text-zinc-400 dark:hover:text-[#CEFF52] transition-colors cursor-pointer"
        >
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">LKML</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        <button
          type="button"
          onClick={openPrivacyPolicy}
          className="text-zinc-500 hover:text-[#152E40] dark:text-zinc-400 dark:hover:text-[#CEFF52] transition-colors cursor-pointer hover:underline"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
};
