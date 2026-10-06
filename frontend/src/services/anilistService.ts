import type { Manhwa, ManhwaFormat, ManhwaStatus } from '../types';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

interface AniListStaffEdge {
  role: string;
  node: {
    name: {
      full: string;
    };
  };
}

interface AniListMedia {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  };
  bannerImage?: string | null;
  format?: string | null;
  countryOfOrigin?: string | null;
  status?: string | null;
  genres?: string[] | null;
  tags?: Array<{
    name: string;
    rank?: number;
    isMediaSpoiler?: boolean;
  }> | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  chapters?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  siteUrl?: string | null;
  staff?: {
    edges?: AniListStaffEdge[] | null;
  } | null;
}

/**
 * Strips HTML tags and unescapes common HTML entities from AniList descriptions.
 */
function cleanSynopsis(rawText?: string | null): string {
  if (!rawText) return 'No synopsis available.';
  return rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Formats AniList media entry into the application's native Manhwa data model.
 */
export function mapAniListMediaToManhwa(media: AniListMedia): Manhwa {
  // Title mapping
  const primaryTitle = media.title?.english || media.title?.romaji || media.title?.native || 'Untitled';
  
  // Format mapping: KR = manhwa, CN = manhua, JP = manga
  let format: ManhwaFormat = 'manhwa';
  if (media.countryOfOrigin === 'CN') format = 'manhua';
  else if (media.countryOfOrigin === 'JP') format = 'manga';

  // Status mapping
  let status: ManhwaStatus = 'ongoing';
  if (media.status === 'FINISHED') status = 'completed';
  else if (media.status === 'HIATUS' || media.status === 'CANCELLED') status = 'hiatus';

  // Extract staff
  const authors: string[] = [];
  const artists: string[] = [];
  if (media.staff?.edges) {
    for (const edge of media.staff.edges) {
      const role = edge.role?.toLowerCase() || '';
      const name = edge.node?.name?.full;
      if (!name) continue;

      if (role.includes('story') || role.includes('original') || role.includes('author') || role.includes('writer')) {
        if (!authors.includes(name)) authors.push(name);
      }
      if (role.includes('art') || role.includes('illustrat') || role.includes('draw')) {
        if (!artists.includes(name)) artists.push(name);
      }
    }
  }

  // Cover image fallback
  const coverImageUrl =
    media.coverImage?.extraLarge ||
    media.coverImage?.large ||
    media.coverImage?.medium ||
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';

  // Tropes from AniList tags (excluding spoilers)
  const tropes = (media.tags || [])
    .filter((tag) => !tag.isMediaSpoiler && (tag.rank ?? 0) >= 50)
    .slice(0, 8)
    .map((tag) => tag.name);

  // Convert 100-point AniList score to 5.00-star scale
  const ratingAvg = media.averageScore
    ? Number((media.averageScore / 20).toFixed(2))
    : 4.5;

  return {
    id: `anilist-${media.id}`,
    title: primaryTitle,
    alternative_titles: {
      hangul: media.title?.native || undefined,
      romanized: media.title?.romaji || undefined,
      english: media.title?.english ? [media.title.english] : [],
    },
    synopsis: cleanSynopsis(media.description),
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    artists: artists.length > 0 ? artists : ['Unknown Studio'],
    cover_image_url: coverImageUrl,
    banner_image_url: media.bannerImage || undefined,
    format,
    status,
    genres: media.genres && media.genres.length > 0 ? media.genres : ['Action', 'Fantasy'],
    tropes: tropes.length > 0 ? tropes : ['System Awakening', 'Level Up'],
    release_year: media.startDate?.year || new Date().getFullYear(),
    total_chapters: media.chapters || 0,
    official_links: media.siteUrl
      ? [{ platform: 'AniList', url: media.siteUrl }]
      : [],
    is_published: true,
    rating_avg: ratingAvg,
    rating_count: media.popularity || 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
}

const GRAPHQL_MEDIA_FIELDS = `
  id
  title {
    romaji
    english
    native
  }
  description(asHtml: false)
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  format
  countryOfOrigin
  status
  genres
  tags {
    name
    rank
    isMediaSpoiler
  }
  startDate {
    year
    month
    day
  }
  chapters
  averageScore
  popularity
  siteUrl
  staff(perPage: 8) {
    edges {
      role
      node {
        name {
          full
        }
      }
    }
  }
`;

/**
 * Execute a query against the AniList GraphQL API.
 */
async function queryAniList<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`AniList API responded with HTTP status ${response.status}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'AniList GraphQL Error');
  }

  return json.data;
}

/**
 * Fetches popular/trending Manhwa directly from AniList.
 * Defaults to countryOfOrigin: "KR" (Korean Manhwa).
 */
export async function fetchAniListTrendingManhwa(
  page: number = 1,
  perPage: number = 15,
  countryOfOrigin: string = 'KR'
): Promise<Manhwa[]> {
  const query = `
    query GetTrendingManhwa($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, sort: [POPULARITY_DESC, SCORE_DESC]) {
          ${GRAPHQL_MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList(query, { page, perPage, countryOfOrigin });
  const mediaList: AniListMedia[] = data?.Page?.media || [];
  return mediaList.map(mapAniListMediaToManhwa);
}

/**
 * Searches AniList for manhwa matching a query term.
 */
export async function searchAniListManhwa(
  searchQuery: string,
  page: number = 1,
  perPage: number = 15
): Promise<Manhwa[]> {
  if (!searchQuery.trim()) {
    return fetchAniListTrendingManhwa(page, perPage);
  }

  const query = `
    query SearchManhwa($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, search: $search, sort: SEARCH_MATCH) {
          ${GRAPHQL_MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList(query, { search: searchQuery, page, perPage });
  const mediaList: AniListMedia[] = data?.Page?.media || [];
  return mediaList.map(mapAniListMediaToManhwa);
}

/**
 * Fetches Manhwa by Genre (e.g. Action, Fantasy, Romance, Drama).
 */
export async function fetchAniListByGenre(
  genre: string,
  page: number = 1,
  perPage: number = 15
): Promise<Manhwa[]> {
  const query = `
    query GetByGenre($genre: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, genre: $genre, sort: POPULARITY_DESC) {
          ${GRAPHQL_MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList(query, { genre, page, perPage });
  const mediaList: AniListMedia[] = data?.Page?.media || [];
  return mediaList.map(mapAniListMediaToManhwa);
}

/**
 * Fetches a single Manhwa's detailed metadata by AniList ID.
 */
export async function fetchAniListDetails(id: number): Promise<Manhwa | null> {
  const query = `
    query GetManhwaDetails($id: Int) {
      Media(id: $id, type: MANGA) {
        ${GRAPHQL_MEDIA_FIELDS}
      }
    }
  `;

  const data = await queryAniList(query, { id });
  if (!data?.Media) return null;
  return mapAniListMediaToManhwa(data.Media);
}

/**
 * Searches AniList for a manga/manhwa by title and returns its AniList ID.
 */
export async function searchAniListIdByTitle(title: string): Promise<number | null> {
  const query = `
    query SearchIdByTitle($search: String) {
      Media(search: $search, type: MANGA) {
        id
      }
    }
  `;
  try {
    const data = await queryAniList(query, { search: title });
    return data?.Media?.id || null;
  } catch {
    return null;
  }
}

/**
 * Fetches reviews for a specific Manhwa by AniList ID and maps them to Comment objects.
 */
export async function fetchAniListReviews(id: number, manhwaId: string): Promise<any[]> {
  const query = `
    query GetManhwaReviews($id: Int) {
      Page(page: 1, perPage: 12) {
        reviews(mediaId: $id, sort: [RATING_DESC, ID_DESC]) {
          id
          summary
          body
          rating
          ratingAmount
          score
          createdAt
          user {
            id
            name
            avatar {
              medium
            }
          }
        }
      }
    }
  `;

  try {
    const data = await queryAniList(query, { id });
    const reviews = data?.Page?.reviews || [];
    
    return reviews.map((rev: any) => {
      const authorName = rev.user?.name || 'AniList Reviewer';
      const cleanSummary = rev.summary ? cleanSynopsis(rev.summary) : '';
      const cleanBody = rev.body ? cleanSynopsis(rev.body) : '';
      
      let formattedContent = cleanBody || cleanSummary || 'No review content provided.';
      if (cleanSummary && cleanBody && !cleanBody.startsWith(cleanSummary)) {
        formattedContent = `**${cleanSummary}**\n\n${cleanBody}`;
      }

      const upvotes = rev.rating || 0;
      const totalVotes = rev.ratingAmount || 0;
      const downvotes = Math.max(0, totalVotes - upvotes);

      return {
        id: `anilist-review-${rev.id}`,
        manhwa_id: manhwaId,
        user_id: `anilist-user-${rev.user?.id || authorName}`,
        username: `${authorName} (AniList)`,
        user_avatar: rev.user?.avatar?.medium || undefined,
        user_role: 'guest',
        parent_id: null,
        content: formattedContent,
        is_spoiler: false,
        upvotes,
        downvotes,
        is_hidden: false,
        created_at: rev.createdAt ? new Date(rev.createdAt * 1000).toISOString() : new Date().toISOString(),
        updated_at: rev.createdAt ? new Date(rev.createdAt * 1000).toISOString() : new Date().toISOString(),
        deleted_at: null,
      };
    });
  } catch (err) {
    console.error('Failed to fetch AniList reviews', err);
    return [];
  }
}

