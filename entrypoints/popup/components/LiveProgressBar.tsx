import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Braces,
  Code2,
  Compass,
  Cpu,
  EyeOff,
  FileCode2,
  Fingerprint,
  Globe,
  HardDrive,
  Image,
  Link2,
  Lock,
  Map,
  Palette,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import type { ScanProgressEvent } from '@/types/messaging';
import { Button } from './Button';

export interface LiveProgressBarProps {
  progress: ScanProgressEvent | null;
  onCancel: () => void;
  isCancelling?: boolean;
  targetHost?: string;
  disablePacing?: boolean;
}

interface ScanVisualState {
  label: string;
  defaultStep?: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
}

const MODULE_VISUALS: Record<string, ScanVisualState> = {
  identity: {
    label: 'Website Identity',
    defaultStep: 'Inspecting document identity & language...',
    icon: Fingerprint,
  },
  dom: {
    label: 'DOM Structure',
    defaultStep: 'Analyzing DOM depth, landmarks & headings...',
    icon: Code2,
  },
  metadata: {
    label: 'SEO Essentials',
    defaultStep: 'Auditing titles, meta tags & canonicals...',
    icon: Search,
  },
  links: {
    label: 'Links Inventory',
    defaultStep: 'Mapping internal & external links...',
    icon: Link2,
  },
  media: {
    label: 'Images & Media',
    defaultStep: 'Checking image alt text & media attributes...',
    icon: Image,
  },
  styles: {
    label: 'CSS & Styles',
    defaultStep: 'Inspecting stylesheets & layout rules...',
    icon: Palette,
  },
  scripts: {
    label: 'JavaScript',
    defaultStep: 'Evaluating script loading & SRI hashes...',
    icon: FileCode2,
  },
  technology: {
    label: 'Tech Stack',
    defaultStep: 'Fingerprinting frameworks & libraries...',
    icon: Cpu,
  },
  performance: {
    label: 'Performance',
    defaultStep: 'Measuring Core Web Vitals & paint timings...',
    icon: Zap,
  },
  security: {
    label: 'Security',
    defaultStep: 'Auditing CSP, HSTS & framing headers...',
    icon: ShieldCheck,
  },
  structuredData: {
    label: 'Structured Data',
    defaultStep: 'Parsing JSON-LD & Schema.org markup...',
    icon: Braces,
  },
  forms: {
    label: 'Forms Security',
    defaultStep: 'Checking form actions & input labels...',
    icon: Lock,
  },
  privacy: {
    label: 'Privacy & Trackers',
    defaultStep: 'Detecting third-party trackers & CMP...',
    icon: EyeOff,
  },
  responsive: {
    label: 'Responsive Layout',
    defaultStep: 'Testing mobile viewport & overflow...',
    icon: Smartphone,
  },
  accessibility: {
    label: 'Accessibility',
    defaultStep: 'Running WCAG 2.2 AA & axe-core checks...',
    icon: UserCheck,
  },
  crawler: {
    label: 'Site Crawler',
    defaultStep: 'Crawling linked pages & site structure...',
    icon: Compass,
  },
  robots: {
    label: 'Robots & Crawl',
    defaultStep: 'Evaluating robots.txt crawler directives...',
    icon: Map,
  },
  sitemap: {
    label: 'Sitemaps',
    defaultStep: 'Validating XML sitemap endpoints...',
    icon: Map,
  },
  intelligence: {
    label: 'External Intel',
    defaultStep: 'Collecting DNS, TLS & certificate intel...',
    icon: Radar,
  },
};

const SHOWCASE_MODULE_ORDER = [
  'identity',
  'dom',
  'metadata',
  'links',
  'media',
  'styles',
  'scripts',
  'technology',
  'performance',
  'security',
  'structuredData',
  'forms',
  'privacy',
  'responsive',
  'accessibility',
] as const;

interface PacedShowcaseItem {
  key: string;
  label: string;
  step: string;
  icon: ScanVisualState['icon'];
}

function resolveScanVisual(moduleName: string | undefined, step: string): ScanVisualState {
  if (moduleName && MODULE_VISUALS[moduleName]) {
    return MODULE_VISUALS[moduleName];
  }

  const normalized = step.toLowerCase();
  if (normalized.includes('refresh') || normalized.includes('cache')) {
    return { label: 'Clearing Cache', icon: RefreshCw };
  }
  if (normalized.includes('scroll') || normalized.includes('below-the-fold') || normalized.includes('data usage')) {
    return { label: 'Measuring Assets', icon: HardDrive };
  }
  if (normalized.includes('cancel')) {
    return { label: 'Cancelling', icon: XCircle };
  }
  if (normalized.includes('score') || normalized.includes('finaliz') || normalized.includes('report')) {
    return { label: 'Scoring Audit', icon: BarChart3 };
  }
  if (moduleName) {
    return { label: moduleName, icon: Radar };
  }
  return { label: 'Initializing', icon: Radar };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const RING_SIZE = 220;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 96;
const ORBIT_RADIUS = 81;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PERCENT_TICK_MS = 60;
const SHOWCASE_STEP_MS = 650;

export const LiveProgressBar: React.FC<LiveProgressBarProps> = ({
  progress,
  onCancel,
  isCancelling = false,
  targetHost,
  disablePacing = false,
}) => {
  const targetPercent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));
  const rawStep = progress?.step || 'Initializing audit pipeline...';
  const rawModule = progress?.module;
  const realCompleted = progress?.completedModules ?? 0;
  const total = progress?.totalModules ?? 10;

  const isPaced = !disablePacing && !prefersReducedMotion();

  const [visualPercent, setVisualPercent] = useState<number>(targetPercent);
  const [showcaseItem, setShowcaseItem] = useState<PacedShowcaseItem | null>(null);

  const targetPercentRef = useRef(targetPercent);
  targetPercentRef.current = targetPercent;

  const isCancellingRef = useRef(isCancelling);
  isCancellingRef.current = isCancelling;

  const latestVisualRef = useRef<PacedShowcaseItem | null>(null);
  const initialVisual = resolveScanVisual(rawModule, rawStep);
  latestVisualRef.current = {
    key: rawModule || initialVisual.label,
    label: initialVisual.label,
    step: rawStep,
    icon: initialVisual.icon,
  };

  const queueRef = useRef<PacedShowcaseItem[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const showcaseCursorRef = useRef<number>(0);
  const hasMountedInitialRef = useRef<boolean>(false);

  // Queue incoming real module/phase updates so each is shown at most once
  useEffect(() => {
    if (!isPaced) {
      queueRef.current = [];
      seenKeysRef.current.clear();
      hasMountedInitialRef.current = false;
      setShowcaseItem(null);
      return;
    }

    if (!progress) {
      queueRef.current = [];
      seenKeysRef.current.clear();
      showcaseCursorRef.current = 0;
      hasMountedInitialRef.current = false;
      setShowcaseItem(null);
      return;
    }

    const resolved = resolveScanVisual(rawModule, rawStep);
    const itemKey = rawModule || resolved.label;
    if (!seenKeysRef.current.has(itemKey)) {
      seenKeysRef.current.add(itemKey);
      // Initial item is already visible on mount; only enqueue subsequent transitions
      if (hasMountedInitialRef.current) {
        queueRef.current.push({
          key: itemKey,
          label: resolved.label,
          step: rawStep,
          icon: resolved.icon,
        });
      }
    }
    hasMountedInitialRef.current = true;
  }, [isPaced, progress, rawModule, rawStep]);

  // Smoothly interpolate percentage so rapid 3% -> 60% jumps glide cleanly instead of teleporting
  useEffect(() => {
    if (!isPaced) {
      setVisualPercent(targetPercent);
      return;
    }

    if (!progress) {
      setVisualPercent(0);
      return;
    }

    const timer = setInterval(() => {
      setVisualPercent((prev) => {
        const target = targetPercentRef.current;
        if (target <= 0) return 0;
        if (target >= 100) {
          if (prev >= 100) return 100;
          const step = Math.max(1.5, (100 - prev) * 0.25);
          return Math.min(100, prev + step);
        }

        if (prev < target) {
          const delta = target - prev;
          const step = Math.max(0.55, Math.min(1.8, delta * 0.09));
          return Math.min(target, prev + step);
        }

        // Gentle ambient creep during slower network/crawl phases so progress never looks frozen
        if (!isCancellingRef.current && prev < 94) {
          return Math.min(94, prev + 0.12);
        }

        return prev;
      });
    }, PERCENT_TICK_MS);

    return () => clearInterval(timer);
  }, [isPaced, Boolean(progress)]);

  // Pace module & phase icons inside the circle so every audit area gets showcased
  useEffect(() => {
    if (!isPaced || !progress) return;

    const timer = setInterval(() => {
      if (isCancellingRef.current) {
        setShowcaseItem({
          key: 'cancelling',
          label: 'Cancelling',
          step: 'Stopping active audit workers...',
          icon: XCircle,
        });
        return;
      }

      const queued = queueRef.current.shift();
      if (queued) {
        setShowcaseItem(queued);
        return;
      }

      let modKey: (typeof SHOWCASE_MODULE_ORDER)[number] | undefined;
      while (showcaseCursorRef.current < SHOWCASE_MODULE_ORDER.length) {
        const candidate = SHOWCASE_MODULE_ORDER[showcaseCursorRef.current]!;
        showcaseCursorRef.current += 1;
        if (!seenKeysRef.current.has(candidate)) {
          modKey = candidate;
          seenKeysRef.current.add(candidate);
          break;
        }
      }

      if (modKey) {
        const modVisual = MODULE_VISUALS[modKey]!;
        setShowcaseItem({
          key: modKey,
          label: modVisual.label,
          step: modVisual.defaultStep || `Evaluating ${modVisual.label}...`,
          icon: modVisual.icon,
        });
        return;
      }

      // All showcase modules have been shown once; hold on the live active backend phase without repeating
      if (latestVisualRef.current) {
        setShowcaseItem((prev) =>
          prev?.key === latestVisualRef.current?.key && prev?.step === latestVisualRef.current?.step
            ? prev
            : latestVisualRef.current,
        );
      }
    }, SHOWCASE_STEP_MS);

    return () => clearInterval(timer);
  }, [isPaced, Boolean(progress)]);

  const percent = isPaced ? Math.min(100, Math.max(0, Math.round(visualPercent))) : targetPercent;
  const rawVisual = resolveScanVisual(rawModule, rawStep);
  const activeVisual: PacedShowcaseItem =
    isPaced && showcaseItem
      ? showcaseItem
      : {
          key: rawModule || rawVisual.label,
          label: rawVisual.label,
          step: rawStep,
          icon: rawVisual.icon,
        };

  const completed =
    isPaced && showcaseItem
      ? Math.min(
          total,
          Math.max(
            realCompleted,
            percent >= 100 ? total : Math.min(Math.max(0, total - 1), Math.floor((percent / 100) * total)),
          ),
        )
      : realCompleted;

  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);
  const ActiveIcon = activeVisual.icon;
  const stateKey = activeVisual.key;
  const step = activeVisual.step;
  const activeLabel = activeVisual.label;

  return (
    <div className="w-full min-h-full flex flex-col items-center justify-center px-6 py-6 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {targetHost && (
        <div className="mb-4 flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 max-w-full">
          <Globe className="w-3.5 h-3.5 text-[#152E40] dark:text-[#CEFF52] shrink-0" aria-hidden="true" />
          <span className="truncate">{targetHost}</span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={targetHost ? `Audit progress for ${targetHost}` : 'Audit progress'}
        aria-valuetext={`${percent}% — ${activeLabel}: ${step}`}
        className="relative w-52 h-52 min-[400px]:w-56 min-[400px]:h-56 shrink-0 flex items-center justify-center"
      >
        {/* Outer track + determinate progress arc */}
        <svg
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="w-full h-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            className="text-zinc-200 dark:text-zinc-800"
          />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="siteradar-progress-arc text-[#059669] dark:text-[#CEFF52] transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>

        {/* Purposeful inner orbital sweep indicator */}
        <svg
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="absolute inset-0 w-full h-full siteradar-orbit-spin pointer-events-none"
          aria-hidden="true"
        >
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={ORBIT_RADIUS}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="96 414"
            className="text-[#152E40]/25 dark:text-[#CEFF52]/40"
          />
        </svg>

        {/* Center scan state: active icon, steady tabular percentage, live module/phase label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none gap-1.5">
          <div
            key={`icon-${stateKey}`}
            className="siteradar-step-enter flex items-center justify-center"
          >
            <ActiveIcon
              className="w-5 h-5 text-[#152E40] dark:text-[#CEFF52] shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
          <span className="text-4xl font-black tracking-tight leading-none text-zinc-900 dark:text-white tabular-nums">
            {percent}%
          </span>
          <span
            key={`label-${stateKey}`}
            className="siteradar-step-enter text-xs font-semibold text-zinc-700 dark:text-zinc-300 leading-tight max-w-[136px] truncate"
          >
            {activeLabel}
          </span>
        </div>
      </div>

      {/* Below-ring status: module counter + bounded step description */}
      <div className="mt-5 flex flex-col items-center gap-1.5 text-center w-full max-w-[34ch]">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {completed} / {total}
          </span>{' '}
          modules
        </div>
        <div className="min-h-9 flex items-center justify-center w-full">
          <p
            className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug line-clamp-2 text-pretty"
            aria-live="polite"
          >
            {step}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onCancel}
          disabled={isCancelling}
          leftIcon={<X className="w-3.5 h-3.5 text-current" aria-hidden="true" />}
          className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Scan'}
        </Button>
      </div>
    </div>
  );
};
