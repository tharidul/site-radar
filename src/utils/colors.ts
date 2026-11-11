export interface ScoreColorDefinition {
  stroke: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
}

/**
 * Universal semantic color theory for scores (0-100) and grades (A-F)
 * - 90-100 (Grade A): Emerald Green (Optimal / Passing)
 * - 80-89  (Grade B): Sky Blue (Good / Minor Improvements)
 * - 70-79  (Grade C): Amber / Yellow (Fair / Needs Attention)
 * - 60-69  (Grade D): Orange (Poor / Meaningful Deficiencies)
 * - <60    (Grade F): Rose / Red (Critical / Failing)
 */
export function getScoreColor(score: number): ScoreColorDefinition {
  const s = Math.min(100, Math.max(0, Math.round(score)));

  if (s >= 90) {
    return {
      stroke: '#10b981', // Emerald green
      textColor: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      badgeBorder: 'border-emerald-500/30 dark:border-emerald-700/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      grade: 'A',
      label: 'Optimal',
    };
  }

  if (s >= 80) {
    return {
      stroke: '#0284c7', // Sky blue
      textColor: 'text-sky-600 dark:text-sky-400',
      badgeBg: 'bg-sky-500/10 dark:bg-sky-950/40',
      badgeBorder: 'border-sky-500/30 dark:border-sky-700/60',
      badgeText: 'text-sky-700 dark:text-sky-300',
      grade: 'B',
      label: 'Good',
    };
  }

  if (s >= 70) {
    return {
      stroke: '#f59e0b', // Amber
      textColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-950/40',
      badgeBorder: 'border-amber-500/30 dark:border-amber-700/60',
      badgeText: 'text-amber-700 dark:text-amber-300',
      grade: 'C',
      label: 'Fair',
    };
  }

  if (s >= 60) {
    return {
      stroke: '#f97316', // Orange
      textColor: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-500/10 dark:bg-orange-950/40',
      badgeBorder: 'border-orange-500/30 dark:border-orange-700/60',
      badgeText: 'text-orange-700 dark:text-orange-300',
      grade: 'D',
      label: 'Poor',
    };
  }

  return {
    stroke: '#ef4444', // Rose Red
    textColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-950/40',
    badgeBorder: 'border-rose-500/30 dark:border-rose-700/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    grade: 'F',
    label: 'Critical',
  };
}

