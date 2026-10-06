import type { Comment } from '../types';

const MU_API_BASE = 'https://api.mangaupdates.com/v1';

/**
 * Searches MangaUpdates for a series by title and returns its internal ID.
 */
async function searchSeriesId(title: string): Promise<string | null> {
  try {
    const res = await fetch(`${MU_API_BASE}/series/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ search: title, perpage: 1 })
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0].record.series_id.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches reviews for a given Manhwa title from MangaUpdates if available.
 */
export async function fetchMangaUpdatesReviews(title: string, manhwaId: string): Promise<Comment[]> {
  try {
    const seriesId = await searchSeriesId(title);
    if (!seriesId) return [];

    const res = await fetch(`${MU_API_BASE}/series/${seriesId}/reviews`);
    if (!res.ok) return [];
    
    const data = await res.json();
    const reviews = data.results || [];
    
    return reviews.slice(0, 15).map((rev: any) => ({
      id: `mu-review-${rev.record?.id || Math.random().toString(36).substring(7)}`,
      manhwa_id: manhwaId,
      user_id: `mu-user-${rev.record?.author?.id || 'unknown'}`,
      username: `${rev.record?.author?.username || 'MU User'} (MangaUpdates)`,
      user_avatar: undefined,
      user_role: 'guest',
      parent_id: null,
      content: rev.record?.content || 'No content provided.',
      is_spoiler: false,
      upvotes: rev.record?.rating || 0,
      downvotes: 0,
      is_hidden: false,
      created_at: rev.record?.time_added ? new Date(rev.record.time_added * 1000).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }));
  } catch {
    return [];
  }
}

