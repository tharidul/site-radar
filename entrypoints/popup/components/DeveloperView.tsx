/**
 * @file entrypoints/popup/components/DeveloperView.tsx
 * @description Developer profile & architectural manifesto for Website Intelligence.
 * Showcases author details for Tharidu Lakmal (tharidulakmal.com).
 * Adheres strictly to anti-slop guidelines: intentional typography, balanced hierarchy,
 * clean high-contrast surfaces, and zero generic filler.
 */

import React from 'react';
import {
  Globe,
  Mail,
  ExternalLink,
  ShieldCheck,
  Code2,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from './Button';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface DeveloperViewProps {
  onBackToOverview?: () => void;
}

function openExternalLink(url: string) {
  if (!url) return;
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const DeveloperView: React.FC<DeveloperViewProps> = ({ onBackToOverview }) => {
  return (
    <div className="p-4 space-y-4 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* 1. Developer Profile Card */}
      <div className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {/* Monogram Avatar */}
            <div className="relative shrink-0">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                TL
              </div>
              <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Tharidu Lakmal
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/80">
                  Developer
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">
                Full-Stack Engineer &amp; Browser Systems Specialist
              </p>
              <button
                type="button"
                onClick={() => openExternalLink('https://tharidulakmal.com')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 mt-1 cursor-pointer transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>tharidulakmal.com</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openExternalLink('https://tharidulakmal.com')}
            className="shrink-0 text-xs border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            rightIcon={<ExternalLink className="w-3 h-3" />}
          >
            Visit Site
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
          Creator and architect of <strong className="font-semibold text-zinc-900 dark:text-white">Website Intelligence</strong>.
          Focused on crafting transparent, high-performance web auditing tools, accessible UI systems, and client-side security analyzers.
        </p>

        {/* Quick Contact & Links Strip */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => openExternalLink('https://tharidulakmal.com')}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group text-center"
          >
            <Globe className="w-4 h-4 text-orange-500 mb-1 group-hover:scale-105 transition-transform" />
            <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">Portfolio</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-full">tharidulakmal.com</span>
          </button>

          <button
            type="button"
            onClick={() => openExternalLink('https://github.com/tharidul')}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group text-center"
          >
            <GithubIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300 mb-1 group-hover:scale-105 transition-transform" />
            <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">GitHub</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-full">@tharidul</span>
          </button>

          <button
            type="button"
            onClick={() => openExternalLink('mailto:tharindulakmal5050@gmail.com')}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group text-center"
          >
            <Mail className="w-4 h-4 text-amber-500 mb-1 group-hover:scale-105 transition-transform" />
            <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">Contact</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-full">Direct Email</span>
          </button>
        </div>
      </div>

      {/* 2. Core Architecture & Values */}
      <div className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Design &amp; Privacy Principles
          </h3>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                100% Client-Side &amp; Private
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                Audits execute strictly within your local browser sandbox. Visited URLs, DOM trees, and report artifacts are never logged or transmitted to any external server.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 shrink-0 mt-0.5">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                Evidence-Based Analysis
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                Every scorecard item points to concrete evidence: actual HTML elements, exact HTTP response headers, loaded scripts, or measured Core Web Vitals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                Manifest V3 Compliant
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                Engineered to strict Chrome Web Store standards: least-privilege permission model, zero remote code execution, and explicit user consent for optional external intelligence.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Build & System Metadata */}
      <div className="rounded-xl p-3 bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800 text-xs flex items-center justify-between text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Website Intelligence v0.1.0</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>MIT License</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => openExternalLink('https://tharidulakmal.com')}
            className="font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
          >
            tharidulakmal.com
          </button>
        </div>
      </div>
    </div>
  );
};
