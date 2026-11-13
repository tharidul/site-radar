import React from 'react';
import { Layers, Compass, Play, ExternalLink } from 'lucide-react';
import type { InspectionMode } from '@/types/inspection';
import { Button } from './Button';
import { openExtensionTab } from '../ext-api';

interface ModeSelectorProps {
  selectedMode: InspectionMode;
  onSelectMode: (mode: InspectionMode) => void;
  onStartInspection: () => void;
  disabled: boolean;
  disabledReason?: string;
  isRequestingPermission?: boolean;
  refreshPage?: boolean;
  onToggleRefreshPage?: (enabled: boolean) => void;
}

interface ModeOption {
  id: InspectionMode;
  title: string;
  scope: string;
  duration: string;
  tags: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const SinglePageVisual: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
  <svg
    viewBox="0 0 180 66"
    className="w-full h-15 select-none"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Browser frame */}
    <rect
      x="2"
      y="2"
      width="176"
      height="62"
      rx="6"
      className={
        isSelected
          ? 'stroke-[#152E40]/30 dark:stroke-[#CEFF52]/30 fill-zinc-100/60 dark:fill-zinc-950/40'
          : 'stroke-zinc-200 dark:stroke-zinc-800 fill-zinc-50/50 dark:fill-zinc-950/20'
      }
      strokeWidth="1.5"
    />
    {/* Titlebar line */}
    <line
      x1="2"
      y1="17"
      x2="178"
      y2="17"
      className={
        isSelected
          ? 'stroke-[#152E40]/20 dark:stroke-[#CEFF52]/20'
          : 'stroke-zinc-200 dark:stroke-zinc-800'
      }
      strokeWidth="1"
    />
    {/* Window dots */}
    <circle cx="10" cy="9.5" r="2" className="fill-zinc-300 dark:fill-zinc-700" />
    <circle cx="16" cy="9.5" r="2" className="fill-zinc-300 dark:fill-zinc-700" />
    <circle cx="22" cy="9.5" r="2" className="fill-zinc-300 dark:fill-zinc-700" />

    {/* Active Tab */}
    <rect
      x="32"
      y="5"
      width="54"
      height="12"
      rx="3"
      className={
        isSelected
          ? 'fill-[#152E40] dark:fill-[#CEFF52]'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="38"
      y="9"
      width="34"
      height="4"
      rx="1.5"
      className={
        isSelected
          ? 'fill-white dark:fill-[#152E40]'
          : 'fill-zinc-400 dark:fill-zinc-600'
      }
    />

    {/* 1 TAB Badge */}
    <rect
      x="132"
      y="5"
      width="42"
      height="10"
      rx="2"
      className={
        isSelected
          ? 'fill-[#152E40]/10 dark:fill-[#CEFF52]/10 stroke-[#152E40]/40 dark:stroke-[#CEFF52]/40'
          : 'fill-zinc-100 dark:fill-zinc-800 stroke-zinc-200 dark:stroke-zinc-700'
      }
      strokeWidth="0.8"
    />
    <text
      x="153"
      y="12"
      textAnchor="middle"
      fontSize="6"
      fontWeight="700"
      className={
        isSelected
          ? 'fill-[#152E40] dark:fill-[#CEFF52]'
          : 'fill-zinc-500 dark:fill-zinc-400'
      }
    >
      1 TAB
    </text>

    {/* Page elements / Analyzer tracks */}
    <rect
      x="12"
      y="24"
      width="44"
      height="5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-[#152E40]/80 dark:fill-[#CEFF52]/80'
          : 'fill-zinc-300 dark:fill-zinc-700'
      }
    />
    <rect
      x="12"
      y="34"
      width="106"
      height="5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-[#152E40]/40 dark:fill-[#CEFF52]/50'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="124"
      y="34"
      width="44"
      height="5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-[#152E40]/25 dark:fill-[#CEFF52]/30'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="12"
      y="44"
      width="82"
      height="5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-[#152E40]/30 dark:fill-[#CEFF52]/40'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="100"
      y="44"
      width="68"
      height="5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-[#152E40]/20 dark:fill-[#CEFF52]/25'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="12"
      y="54"
      width="130"
      height="4"
      rx="1"
      className={
        isSelected
          ? 'fill-[#152E40]/20 dark:fill-[#CEFF52]/20'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
  </svg>
);

const DeepInspectionVisual: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
  <svg
    viewBox="0 0 180 66"
    className="w-full h-15 select-none"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Topology Branches */}
    <path
      d="M90 14 V24 H34 V38 M90 24 V38 M90 24 H146 V38"
      className={
        isSelected
          ? 'stroke-[#152E40] dark:stroke-[#CEFF52]'
          : 'stroke-zinc-300 dark:stroke-zinc-700'
      }
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Root Node */}
    <rect
      x="62"
      y="3"
      width="56"
      height="13"
      rx="3.5"
      className={
        isSelected
          ? 'fill-[#152E40] dark:fill-[#CEFF52]'
          : 'fill-zinc-200 dark:fill-zinc-800'
      }
    />
    <rect
      x="70"
      y="7"
      width="40"
      height="4.5"
      rx="1.5"
      className={
        isSelected
          ? 'fill-white dark:fill-[#152E40]'
          : 'fill-zinc-400 dark:fill-zinc-600'
      }
    />

    {/* SPIDER+DNS Badge */}
    <rect
      x="128"
      y="3"
      width="46"
      height="10"
      rx="2"
      className={
        isSelected
          ? 'fill-[#152E40]/10 dark:fill-[#CEFF52]/10 stroke-[#152E40]/40 dark:stroke-[#CEFF52]/40'
          : 'fill-zinc-100 dark:fill-zinc-800 stroke-zinc-200 dark:stroke-zinc-700'
      }
      strokeWidth="0.8"
    />
    <text
      x="151"
      y="10"
      textAnchor="middle"
      fontSize="5.5"
      fontWeight="700"
      className={
        isSelected
          ? 'fill-[#152E40] dark:fill-[#CEFF52]'
          : 'fill-zinc-500 dark:fill-zinc-400'
      }
    >
      SPIDER+DNS
    </text>

    {/* Node 1: Crawler */}
    <g transform="translate(10, 38)">
      <rect
        x="0"
        y="0"
        width="48"
        height="24"
        rx="4"
        className={
          isSelected
            ? 'fill-[#152E40]/10 dark:fill-[#CEFF52]/10 stroke-[#152E40]/40 dark:stroke-[#CEFF52]/40'
            : 'fill-zinc-100/70 dark:fill-zinc-900 stroke-zinc-200 dark:stroke-zinc-800'
        }
        strokeWidth="1"
      />
      <text
        x="24"
        y="10"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        className={
          isSelected
            ? 'fill-[#152E40] dark:fill-[#CEFF52]'
            : 'fill-zinc-700 dark:fill-zinc-300'
        }
      >
        CRAWLER
      </text>
      <text
        x="24"
        y="18"
        textAnchor="middle"
        fontSize="5"
        className="fill-zinc-500 dark:fill-zinc-400"
      >
        Linked Pages
      </text>
    </g>

    {/* Node 2: Sitemaps */}
    <g transform="translate(66, 38)">
      <rect
        x="0"
        y="0"
        width="48"
        height="24"
        rx="4"
        className={
          isSelected
            ? 'fill-[#152E40]/10 dark:fill-[#CEFF52]/10 stroke-[#152E40]/40 dark:stroke-[#CEFF52]/40'
            : 'fill-zinc-100/70 dark:fill-zinc-900 stroke-zinc-200 dark:stroke-zinc-800'
        }
        strokeWidth="1"
      />
      <text
        x="24"
        y="10"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        className={
          isSelected
            ? 'fill-[#152E40] dark:fill-[#CEFF52]'
            : 'fill-zinc-700 dark:fill-zinc-300'
        }
      >
        SITEMAPS
      </text>
      <text
        x="24"
        y="18"
        textAnchor="middle"
        fontSize="5"
        className="fill-zinc-500 dark:fill-zinc-400"
      >
        robots.txt
      </text>
    </g>

    {/* Node 3: Server */}
    <g transform="translate(122, 38)">
      <rect
        x="0"
        y="0"
        width="48"
        height="24"
        rx="4"
        className={
          isSelected
            ? 'fill-[#152E40]/10 dark:fill-[#CEFF52]/10 stroke-[#152E40]/40 dark:stroke-[#CEFF52]/40'
            : 'fill-zinc-100/70 dark:fill-zinc-900 stroke-zinc-200 dark:stroke-zinc-800'
        }
        strokeWidth="1"
      />
      <text
        x="24"
        y="10"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        className={
          isSelected
            ? 'fill-[#152E40] dark:fill-[#CEFF52]'
            : 'fill-zinc-700 dark:fill-zinc-300'
        }
      >
        SERVER
      </text>
      <text
        x="24"
        y="18"
        textAnchor="middle"
        fontSize="5"
        className="fill-zinc-500 dark:fill-zinc-400"
      >
        DNS &amp; TLS
      </text>
    </g>
  </svg>
);

const MODES: ModeOption[] = [
  {
    id: 'full',
    title: 'Full Page Audit',
    scope: 'Audits only the tab currently open.',
    duration: '~3-5s',
    tags: ['Page Vitals & DOM', 'Headers & Security', 'SEO & WCAG'],
    icon: Layers,
  },
  {
    id: 'deep',
    title: 'Deep Inspection',
    scope: 'Full audit plus site & server checks.',
    duration: '~10-20s',
    tags: ['Multi-Page Crawler', 'Robots & Sitemaps', 'DNS, IP/ASN & TLS'],
    icon: Compass,
  },
];

function openPrivacyPolicy() {
  openExtensionTab('privacy-policy.html');
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  onStartInspection,
  disabled,
  disabledReason,
  isRequestingPermission = false,
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
                className={`flex flex-col text-left h-full rounded-xl p-3 transition-all duration-150 ease-out active:scale-[0.99] cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-white dark:bg-zinc-900 border-[#152E40] dark:border-[#CEFF52] ring-1 ring-[#152E40] dark:ring-[#CEFF52]'
                    : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#CEFF52] text-[#152E40]'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {mode.title}
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                    {mode.duration}
                  </span>
                </div>

                <div className="my-2.5 w-full rounded-lg overflow-hidden flex items-center justify-center bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/60 p-2">
                  {mode.id === 'full' ? (
                    <SinglePageVisual isSelected={isSelected} />
                  ) : (
                    <DeepInspectionVisual isSelected={isSelected} />
                  )}
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug">
                  {mode.scope}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5 w-full">
                  {mode.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700'
                          : 'bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border border-transparent'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
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
          disabled={disabled || isRequestingPermission}
          isLoading={isRequestingPermission}
          onClick={onStartInspection}
          leftIcon={<Play className="w-4 h-4 fill-current ml-0.5" />}
          className="w-full py-2.5"
        >
          {isRequestingPermission
            ? 'Waiting for site permission…'
            : disabled
            ? disabledReason || 'Cannot start audit'
            : `Start ${selectedMode === 'full' ? 'Full Page Audit' : 'Deep Inspection'}`}
        </Button>

        {isRequestingPermission && (
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            Allow site access in the browser address-bar prompt to begin scanning.
          </p>
        )}
      </div>

      <div className="pt-2.5 flex items-center justify-center gap-3 border-t border-zinc-200/70 dark:border-zinc-800/80 text-xs select-none">
        <button
          type="button"
          onClick={() => openExtensionTab('https://tharidulakmal.com')}
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
