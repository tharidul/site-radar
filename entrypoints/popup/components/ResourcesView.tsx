/**
 * @file entrypoints/popup/components/ResourcesView.tsx
 * @description Resources tab displaying scripts, stylesheets, media assets, and third-party origins.
 */

import React from 'react';
import { FileCode, FileSpreadsheet, Image as ImageIcon, Globe, Database, Cpu } from 'lucide-react';
import type { WebsiteInspection, TechnologyData } from '@/types/inspection';

interface ResourcesViewProps {
  inspection: WebsiteInspection;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({ inspection }) => {
  const resModule = inspection.modules?.resources?.data as any;
  const techModule = inspection.modules?.technology?.data as TechnologyData | undefined;
  const technologies = techModule?.technologies || [];
  const scripts = resModule?.scripts || [];
  const stylesheets = resModule?.stylesheets || [];
  const images = resModule?.images || [];
  const origins = resModule?.thirdPartyOrigins || [];

  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Resources &amp; Assets Inventory
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Passive inspection of loaded DOM scripts, stylesheets, and third-party dependencies.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <FileCode className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {scripts.length}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Scripts</div>
        </div>

        <div className="rounded-lg bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <FileSpreadsheet className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {stylesheets.length}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Stylesheets</div>
        </div>

        <div className="rounded-lg bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <ImageIcon className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {images.length}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Images</div>
        </div>

        <div className="rounded-lg bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <Globe className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {origins.length}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Origins</div>
        </div>
      </div>

      {/* Detected Technologies Card */}
      {technologies.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-2">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-orange-500" />
            <span>Detected Frontend Frameworks &amp; Technologies ({technologies.length})</span>
          </h4>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {technologies.map((tech, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                title={`${tech.category}: ${tech.evidence}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{tech.name}</span>
                {tech.version && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">v{tech.version}</span>
                )}
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                  ({tech.category})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Origin Domains Card */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-2">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-orange-500" />
          <span>Connected Third-Party Origins ({origins.length})</span>
        </h4>
        {origins.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
            No external third-party origins detected on this document.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {origins.map((origin: string, idx: number) => (
              <span
                key={idx}
                className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                {origin}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

