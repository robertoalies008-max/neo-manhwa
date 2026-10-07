import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sanitizeText } from '../lib/validation';
import type { Manhwa, UserLibraryEntry, Comment, Report, ContributorDraft } from '../types';

/**
 * Service layer for interacting with the Supabase PostgreSQL database.
 * Gracefully falls back if Supabase credentials are not configured yet.
 */

export async function fetchManhwaFromDatabase(): Promise<Manhwa[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('manhwa')
      .select('*')
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('rating_avg', { ascending: false });

    if (error) {
      console.error('Error fetching manhwa from Supabase:', error.message);
      return null;
    }

    return data as Manhwa[];
  } catch (err) {
    console.error('Unexpected error querying Supabase manhwa:', err);
    return null;
  }
}

/**
 * Inserts or updates Manhwa records in Supabase (e.g. imported from AniList).
 */
export async function syncManhwaToDatabase(manhwaList: Manhwa[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, count: 0, error: 'Supabase credentials not configured in .env' };
  }

  try {
    // Generate valid UUIDs or clean records for database insertion
    const payload = manhwaList.map((m) => {
      // If the ID is an AniList ID like 'anilist-12345', generate a consistent UUID or let DB assign
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id);
      const record: any = {
        title: m.title,
        alternative_titles: m.alternative_titles,
        synopsis: m.synopsis,
        authors: m.authors,
        artists: m.artists,
        cover_image_url: m.cover_image_url,
        banner_image_url: m.banner_image_url || null,
        format: m.format,
        status: m.status,
        genres: m.genres,
        tropes: m.tropes,
        release_year: m.release_year,
        total_chapters: m.total_chapters,
        official_links: m.official_links,
        is_published: m.is_published,
        rating_avg: m.rating_avg,
        rating_count: m.rating_count,
      };

      if (isUUID) {
        record.id = m.id;
      }
      return record;
    });

    const { data, error } = await supabase
      .from('manhwa')
      .upsert(payload, { onConflict: 'title' })
      .select();

    if (error) {
      console.error('Supabase sync error:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data ? data.length : payload.length };
  } catch (err: any) {
    console.error('Unexpected error syncing to Supabase:', err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Fetches user library entries from Supabase.
 */
export async function fetchUserLibrary(userId: string): Promise<UserLibraryEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('user_library')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user library:', error.message);
      return null;
    }

    return data as UserLibraryEntry[];
  } catch {
    return null;
  }
}

/**
 * Upserts a single user library entry (status, chapter progress, rating, favorite).
 */
export async function upsertUserLibraryEntry(entry: Partial<UserLibraryEntry> & { user_id: string; manhwa_id: string }) {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('user_library')
      .upsert(entry, { onConflict: 'user_id,manhwa_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating user library:', error.message);
      return null;
    }

    return data as UserLibraryEntry;
  } catch {
    return null;
  }
}

/**
 * Fetches comments for a given manhwa.
 */
export async function fetchComments(manhwaId: string): Promise<Comment[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(username, avatar_url, role)')
      .eq('manhwa_id', manhwaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error.message);
      return null;
    }

    // Map joined user details
    return (data || []).map((c: any) => ({
      ...c,
      username: c.users?.username || 'Unknown Hunter',
      user_avatar: c.users?.avatar_url || undefined,
      user_role: c.users?.role || 'user',
    })) as Comment[];
  } catch {
    return null;
  }
}

/**
 * Submits a report to Supabase with defense-in-depth sanitization.
 */
export async function submitReportToDatabase(report: Partial<Report>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload = {
      ...report,
      details: sanitizeText(report.details || ''),
      target_preview: sanitizeText(report.target_preview || ''),
    };
    const { error } = await supabase.from('reports').insert(payload);
    if (error) {
      console.error('Error submitting report to Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Submits a contributor draft to Supabase with defense-in-depth sanitization.
 */
export async function submitDraftToDatabase(draft: Partial<ContributorDraft>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload = {
      ...draft,
      title: sanitizeText(draft.title || ''),
      hangul: sanitizeText(draft.hangul || ''),
      synopsis: sanitizeText(draft.synopsis || ''),
    };
    const { error } = await supabase.from('contributor_drafts').insert(payload);
    if (error) {
      console.error('Error submitting draft to Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function addCommentToDatabase(comment: Partial<Comment>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload = {
      id: comment.id,
      manhwa_id: comment.manhwa_id,
      user_id: comment.user_id,
      parent_id: comment.parent_id || null,
      content: sanitizeText(comment.content || ''),
      is_spoiler: comment.is_spoiler || false,
      upvotes: 0,
      downvotes: 0,
      is_hidden: false,
    };
    const { error } = await supabase.from('comments').insert(payload);
    if (error) {
      console.error('Error adding comment to Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
