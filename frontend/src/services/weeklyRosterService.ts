import type { Manhwa } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { syncManhwaToDatabase } from './supabaseService';

export interface WeekInfo {
  weekNumber: number;
  year: number;
  label: string;
}

/**
 * Calculates current ISO calendar week number and year.
 */
export function getCurrentWeekInfo(): WeekInfo {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    weekNumber: weekNo,
    year: d.getUTCFullYear(),
    label: `Week ${weekNo} • ${d.getUTCFullYear()}`,
  };
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * Selects 10 rotating or newly published manhwa/manga for the current calendar week.
 * This ensures the roster automatically refreshes by 10 titles each week without requiring manual import.
 */
export function getWeeklyDrops(catalog: Manhwa[]): Manhwa[] {
  if (!catalog || catalog.length === 0) return [];

  const { weekNumber, year } = getCurrentWeekInfo();
  // Deterministic seed based on year and weekNumber to select 10 distinct titles for the week
  const weekSeed = year * 100 + weekNumber;

  // Filter ongoing or popular titles first, or take from catalog
  const candidates = [...catalog];
  
  // Pick 10 titles deterministically based on weekSeed
  const selected: Manhwa[] = [];
  const candidateCount = candidates.length;

  for (let i = 0; i < Math.min(10, candidateCount); i++) {
    const index = (weekSeed * 17 + i * 31) % candidateCount;
    const title = candidates[index];
    if (title && !selected.some(s => s.id === title.id)) {
      selected.push(title);
    }
  }

  // If duplicates caused fewer than 10, fill from start
  let fillIdx = 0;
  while (selected.length < Math.min(10, candidateCount) && fillIdx < candidateCount) {
    const fallback = candidates[fillIdx++];
    if (!selected.some(s => s.id === fallback.id)) {
      selected.push(fallback);
    }
  }

  return selected;
}

/**
 * Applies weekly drop metadata to all manhwa in the catalog.
 * The 10 weekly drops receive 'is_new_this_week: true', along with simulated fresh chapter release days.
 */
export function enrichWithWeeklyRoster(catalog: Manhwa[]): Manhwa[] {
  const weeklyDrops = getWeeklyDrops(catalog);
  const weeklyDropIds = new Set(weeklyDrops.map(m => m.id));

  return catalog.map((manhwa, idx) => {
    const isWeeklyDrop = weeklyDropIds.has(manhwa.id);
    if (isWeeklyDrop) {
      const dropDay = WEEKDAY_NAMES[idx % WEEKDAY_NAMES.length];
      return {
        ...manhwa,
        is_new_this_week: true,
        weekly_drop_day: dropDay,
        updated_at: new Date().toISOString(),
      };
    }
    return manhwa;
  });
}

/**
 * Automatically syncs weekly additions to Supabase if configured.
 */
export async function syncWeeklyDropsToSupabase(newDrops: Manhwa[]): Promise<boolean> {
  if (!isSupabaseConfigured || !newDrops || newDrops.length === 0) return false;
  try {
    const res = await syncManhwaToDatabase(newDrops);
    return res.success;
  } catch (err) {
    console.warn('Failed to sync weekly drops to database:', err);
    return false;
  }
}
