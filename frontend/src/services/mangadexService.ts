import type { Manhwa, ManhwaFormat, ManhwaStatus } from '../types';

const MANGADEX_BASE_URL = 'https://api.mangadex.org';
const FALLBACK_COVER = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';

interface MangaDexTag {
  id: string;
  type: string;
  attributes: {
    name: Record<string, string>;
    group: string;
  };
}

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: {
    name?: string;
    fileName?: string;
    [key: string]: any;
  };
}

interface MangaDexManga {
  id: string;
  type: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Array<Record<string, string>>;
    description: Record<string, string>;
    originalLanguage: string;
    status: string;
    year?: number | null;
    lastChapter?: string | null;
    tags: MangaDexTag[];
    links?: Record<string, string> | null;
    createdAt: string;
    updatedAt: string;
  };
  relationships: MangaDexRelationship[];
}

/**
 * Strips markdown links, bolding, and HTML tags from descriptions.
 */
function cleanDescription(raw?: string): string {
  if (!raw) return 'No description provided.';
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/[*_~`#]/g, '')                // Markdown styling marks
    .replace(/<[^>]*>/g, '')                 // Raw HTML tags
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Maps MangaDex API response into NeoManhwa's internal Manhwa model.
 */
export function mapMangaDexToManhwa(manga: MangaDexManga): Manhwa {
  const attrs = manga.attributes;
  const relationships = manga.relationships || [];

  // Extract Titles
  let primaryTitle = attrs.title?.en || '';
  let hangulTitle: string | undefined = attrs.title?.ko;
  const englishAltTitles: string[] = [];

  if (attrs.altTitles && Array.isArray(attrs.altTitles)) {
    for (const alt of attrs.altTitles) {
      if (alt.ko && !hangulTitle) {
        hangulTitle = alt.ko;
      }
      if (alt.en) {
        englishAltTitles.push(alt.en);
        if (!primaryTitle) {
          primaryTitle = alt.en;
        }
      }
    }
  }

  if (!primaryTitle) {
    primaryTitle =
      attrs.title['ko-ro'] ||
      attrs.title['ja-ro'] ||
      Object.values(attrs.title || {})[0] ||
      'Untitled Series';
  }

  // Format mapping based on originalLanguage
  let format: ManhwaFormat = 'manhwa';
  const lang = (attrs.originalLanguage || '').toLowerCase();
  if (lang === 'zh' || lang === 'zh-hk') {
    format = 'manhua';
  } else if (lang === 'ja') {
    format = 'manga';
  } else {
    format = 'manhwa';
  }

  // Status mapping
  let status: ManhwaStatus = 'ongoing';
  if (attrs.status === 'completed') status = 'completed';
  else if (attrs.status === 'hiatus' || attrs.status === 'cancelled') status = 'hiatus';

  // Extract Authors and Artists from relationships
  const authors: string[] = [];
  const artists: string[] = [];

  for (const rel of relationships) {
    if (rel.type === 'author' && rel.attributes?.name) {
      if (!authors.includes(rel.attributes.name)) {
        authors.push(rel.attributes.name);
      }
    } else if (rel.type === 'artist' && rel.attributes?.name) {
      if (!artists.includes(rel.attributes.name)) {
        artists.push(rel.attributes.name);
      }
    }
  }

  // Extract Cover Image
  const coverRel = relationships.find((r) => r.type === 'cover_art');
  const coverFileName = coverRel?.attributes?.fileName;
  const coverImageUrl = coverFileName
    ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg`
    : FALLBACK_COVER;

  // Extract Genres and Themes/Tropes
  const genres: string[] = [];
  const tropes: string[] = [];

  if (attrs.tags && Array.isArray(attrs.tags)) {
    for (const tag of attrs.tags) {
      const tagName = tag.attributes?.name?.en;
      if (!tagName) continue;

      if (tag.attributes.group === 'genre') {
        genres.push(tagName);
      } else if (tag.attributes.group === 'theme') {
        tropes.push(tagName);
      }
    }
  }

  // Chapter count
  const parsedChapters = attrs.lastChapter ? parseInt(attrs.lastChapter, 10) : 0;
  const totalChapters = !isNaN(parsedChapters) && parsedChapters > 0 ? parsedChapters : 1;

  // Description
  const rawDesc =
    attrs.description?.en ||
    Object.values(attrs.description || {})[0] ||
    '';
  const synopsis = cleanDescription(rawDesc);

  // Year
  const releaseYear = attrs.year || (attrs.createdAt ? new Date(attrs.createdAt).getFullYear() : 2024);

  // Official & MangaDex Links
  const officialLinks: Array<{ platform: string; url: string }> = [
    { platform: 'MangaDex', url: `https://mangadex.org/title/${manga.id}` },
  ];
  if (attrs.links?.raw) {
    officialLinks.push({ platform: 'Raw / Official', url: attrs.links.raw });
  }
  if (attrs.links?.engtl) {
    officialLinks.push({ platform: 'English Official', url: attrs.links.engtl });
  }

  return {
    id: `mangadex-${manga.id}`,
    title: primaryTitle,
    alternative_titles: {
      hangul: hangulTitle,
      english: englishAltTitles.length > 0 ? englishAltTitles : undefined,
    },
    synopsis: synopsis.length > 3000 ? synopsis.slice(0, 2990) + '...' : synopsis,
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    artists: artists.length > 0 ? artists : ['Unknown Studio'],
    cover_image_url: coverImageUrl,
    format,
    status,
    genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
    tropes: tropes.length > 0 ? tropes : ['System', 'Reincarnation'],
    release_year: releaseYear,
    total_chapters: totalChapters,
    official_links: officialLinks,
    is_published: true,
    rating_avg: 4.8,
    rating_count: 85,
    created_at: attrs.createdAt || new Date().toISOString(),
    updated_at: attrs.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
}

/**
 * Searches MangaDex API by title query.
 */
export async function searchMangaDexManhwa(
  query: string,
  limit: number = 20
): Promise<Manhwa[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return fetchMangaDexPopularManhwa(limit);
  }

  const url = new URL(`${MANGADEX_BASE_URL}/manga`);
  url.searchParams.append('title', trimmed);
  url.searchParams.append('limit', String(Math.min(limit, 40)));
  url.searchParams.append('includes[]', 'cover_art');
  url.searchParams.append('includes[]', 'author');
  url.searchParams.append('includes[]', 'artist');
  url.searchParams.append('contentRating[]', 'safe');
  url.searchParams.append('contentRating[]', 'suggestive');
  url.searchParams.append('order[relevance]', 'desc');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`MangaDex API responded with status ${response.status}`);
  }

  const json = await response.json();
  const mangaList: MangaDexManga[] = json.data || [];
  return mangaList.map(mapMangaDexToManhwa);
}

/**
 * Fetches popular trending Manhwa from MangaDex.
 */
export async function fetchMangaDexPopularManhwa(limit: number = 20): Promise<Manhwa[]> {
  const url = new URL(`${MANGADEX_BASE_URL}/manga`);
  url.searchParams.append('limit', String(Math.min(limit, 40)));
  // Prioritize Korean manhwa
  url.searchParams.append('originalLanguage[]', 'ko');
  url.searchParams.append('includes[]', 'cover_art');
  url.searchParams.append('includes[]', 'author');
  url.searchParams.append('includes[]', 'artist');
  url.searchParams.append('contentRating[]', 'safe');
  url.searchParams.append('contentRating[]', 'suggestive');
  url.searchParams.append('order[followedCount]', 'desc');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`MangaDex API responded with status ${response.status}`);
  }

  const json = await response.json();
  const mangaList: MangaDexManga[] = json.data || [];
  return mangaList.map(mapMangaDexToManhwa);
}
