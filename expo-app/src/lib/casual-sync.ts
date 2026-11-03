import type { User } from '@supabase/supabase-js';

import type { CasualProgress } from '@/lib/casual-progress';
import { supabase } from '@/lib/supabase';

type StoredCloudProgress = { save_data: unknown; updated_at: string };

function asCasualProgress(value: unknown): CasualProgress | null {
  if (!value || typeof value !== 'object') return null;
  const progress = value as CasualProgress;
  return progress.version === 1 && Array.isArray(progress.values) && Array.isArray(progress.puzzle?.solution)
    ? progress
    : null;
}

export async function loadCloudCasualProgress(user: User) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('casual_saves')
    .select('save_data,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  const row = data as StoredCloudProgress | null;
  const progress = asCasualProgress(row?.save_data);
  if (!progress) return null;

  return {
    ...progress,
    savedAt: Number(progress.savedAt) || Date.parse(row?.updated_at ?? '') || 0,
  };
}

export async function saveCloudCasualProgress(user: User, progress: CasualProgress) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('casual_saves').upsert({
    user_id: user.id,
    save_data: progress,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
