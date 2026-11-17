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
      badgeBg: 'bg-emerald-600',
      badgeBorder: 'border-transparent',
      badgeText: 'text-white font-bold shadow-2xs',
      grade: 'A',
      label: 'Optimal',
    };
  }

  if (s >= 80) {
    return {
      stroke: '#0284c7', // Sky blue
      textColor: 'text-sky-600 dark:text-sky-400',
      badgeBg: 'bg-sky-600',
      badgeBorder: 'border-transparent',
      badgeText: 'text-white font-bold shadow-2xs',
      grade: 'B',
      label: 'Good',
    };
  }

  if (s >= 70) {
    return {
      stroke: '#f59e0b', // Amber
      textColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-600',
      badgeBorder: 'border-transparent',
      badgeText: 'text-white font-bold shadow-2xs',
      grade: 'C',
      label: 'Fair',
    };
  }

  if (s >= 60) {
    return {
      stroke: '#f97316', // Orange
      textColor: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-600',
      badgeBorder: 'border-transparent',
      badgeText: 'text-white font-bold shadow-2xs',
      grade: 'D',
      label: 'Poor',
    };
  }

  return {
    stroke: '#ef4444', // Rose Red
    textColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-600',
    badgeBorder: 'border-transparent',
    badgeText: 'text-white font-bold shadow-2xs',
    grade: 'F',
    label: 'Critical',
  };
}

