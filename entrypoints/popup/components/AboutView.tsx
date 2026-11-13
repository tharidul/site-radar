
import React from 'react';
import { ExternalLink, ShieldCheck, Bot } from 'lucide-react';
import lkmlLogo from '../../../assets/lkml.png';
import { openExtensionTab } from '../ext-api';

function openLink(url: string) {
  openExtensionTab(url);
}

function openPrivacyPolicy() {
  openExtensionTab('privacy-policy.html');
}

function openMcpGuide() {
  openExtensionTab('options.html#mcp');
}

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
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

export const AboutView: React.FC = () => {
  return (
    <div className="p-4 space-y-3 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="rounded-md p-4 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => openLink('https://tharidulakmal.com')}
            className="flex items-center gap-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300 hover:text-[#152E40] dark:hover:text-[#CEFF52] transition-colors"
            title="Visit tharidulakmal.com"
          >
            <img
              src={lkmlLogo}
              alt="LKML"
              className="h-5 w-auto object-contain invert dark:invert-0"
            />
            <span className="sr-only">LKML</span>
            <ExternalLink className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </button>

          <button
            type="button"
            onClick={() => openLink('https://github.com/tharidul')}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="rounded-md p-4 bg-white dark:bg-zinc-900 shadow-xs space-y-2 border border-emerald-500/20 dark:border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600 dark:text-[#CEFF52]" />
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>AI Assistant &amp; MCP</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-[#CEFF52] font-mono">NEW</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={openMcpGuide}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#152E40] dark:text-[#CEFF52] hover:underline cursor-pointer"
          >
            <span>Setup AI</span>
            <ExternalLink className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          SiteRadar connects directly to Claude Desktop, Cursor, and Antigravity via Model Context Protocol (MCP) to audit websites inside your AI chat.
        </p>
      </div>

      <div className="rounded-md p-4 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Privacy &amp; Security
            </h3>
          </div>
          <button
            type="button"
            onClick={openPrivacyPolicy}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#152E40] dark:text-[#CEFF52] hover:underline cursor-pointer"
          >
            <span>Read Policy</span>
            <ExternalLink className="w-3 h-3 text-[#152E40] dark:text-[#CEFF52]" />
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          SiteRadar operates 100% locally in your browser. No browsing history, cookies, or page content are ever collected, tracked, or transmitted off-device.
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500 px-1">
        <span>SiteRadar v0.2.0</span>
        <button
          type="button"
          onClick={openPrivacyPolicy}
          className="hover:text-zinc-800 dark:hover:text-zinc-300 hover:underline cursor-pointer"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
};

