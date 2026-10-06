import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const GRAPHQL_MEDIA_FIELDS = `
  id
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large medium color }
  bannerImage
  format
  countryOfOrigin
  status
  genres
  tags { name rank isMediaSpoiler }
  startDate { year month day }
  chapters
  averageScore
  popularity
  siteUrl
  staff(perPage: 6) {
    edges {
      role
      node { name { full } }
    }
  }
`;

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

function mapAniListMediaToManhwa(media: any) {
  const primaryTitle = media.title?.english || media.title?.romaji || media.title?.native || 'Untitled';
  let format = 'manhwa';
  if (media.countryOfOrigin === 'CN') format = 'manhua';
  else if (media.countryOfOrigin === 'JP') format = 'manga';

  let status = 'ongoing';
  if (media.status === 'FINISHED') status = 'completed';
  else if (media.status === 'HIATUS' || media.status === 'CANCELLED') status = 'hiatus';

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

  const coverImageUrl = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
  const tropes = (media.tags || []).filter((tag: any) => !tag.isMediaSpoiler && (tag.rank ?? 0) >= 50).slice(0, 8).map((tag: any) => tag.name);
  const ratingAvg = media.averageScore ? Number((media.averageScore / 20).toFixed(2)) : 4.5;

  return {
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
    release_year: media.startDate?.year || 2024,
    total_chapters: media.chapters || 0,
    official_links: media.siteUrl ? [{ platform: 'AniList', url: media.siteUrl }] : [],
    is_published: true,
    rating_avg: ratingAvg,
    rating_count: media.popularity || 100,
  };
}

async function queryAniList(query: string, variables: any = {}) {
  const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`AniList API HTTP ${response.status}`);
  const json = await response.json();
  if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);
  return json.data;
}

async function main() {
  console.log('Checking existing database entries...');
  const { data: existing, count } = await supabase.from('manhwa').select('*', { count: 'exact' });
  console.log(`Current DB count: ${count}`);

  const existingTitles = new Set((existing || []).map(m => m.title.toLowerCase()));

  // Let's fetch trending and top manhwa & manhua & manga to fill past 500
  const query = `
    query GetMedia($page: Int, $perPage: Int, $country: CountryCode) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, sort: [TRENDING_DESC, POPULARITY_DESC], countryOfOrigin: $country) {
          ${GRAPHQL_MEDIA_FIELDS}
        }
      }
    }
  `;

  const newMediaToAdd: any[] = [];
  
  // 1. Fetch 50 top Korean manhwa
  try {
    console.log('Fetching top Korean Manhwa...');
    const krData = await queryAniList(query, { page: 1, perPage: 50, country: 'KR' });
    for (const m of krData?.Page?.media || []) {
      const mapped = mapAniListMediaToManhwa(m);
      if (!existingTitles.has(mapped.title.toLowerCase())) {
        existingTitles.add(mapped.title.toLowerCase());
        newMediaToAdd.push(mapped);
      }
    }
  } catch (e: any) {
    console.warn('Error fetching KR manhwa:', e.message);
  }

  // 2. Fetch 50 top Chinese manhua
  try {
    console.log('Fetching top Chinese Manhua...');
    const cnData = await queryAniList(query, { page: 1, perPage: 50, country: 'CN' });
    for (const m of cnData?.Page?.media || []) {
      const mapped = mapAniListMediaToManhwa(m);
      if (!existingTitles.has(mapped.title.toLowerCase())) {
        existingTitles.add(mapped.title.toLowerCase());
        newMediaToAdd.push(mapped);
      }
    }
  } catch (e: any) {
    console.warn('Error fetching CN manhua:', e.message);
  }

  // 3. Fetch 50 top Japanese manga trending
  try {
    console.log('Fetching top Japanese Manga...');
    const jpData = await queryAniList(query, { page: 1, perPage: 50, country: 'JP' });
    for (const m of jpData?.Page?.media || []) {
      const mapped = mapAniListMediaToManhwa(m);
      if (!existingTitles.has(mapped.title.toLowerCase())) {
        existingTitles.add(mapped.title.toLowerCase());
        newMediaToAdd.push(mapped);
      }
    }
  } catch (e: any) {
    console.warn('Error fetching JP manga:', e.message);
  }

  console.log(`Found ${newMediaToAdd.length} fresh items to add to database.`);

  if (newMediaToAdd.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < newMediaToAdd.length; i += batchSize) {
      const batch = newMediaToAdd.slice(i, i + batchSize);
      const { error } = await supabase.from('manhwa').upsert(batch, { onConflict: 'title' });
      if (error) {
        console.error('Batch error:', error.message);
      }
    }
  }

  // Now fetch the full 500+ list from Supabase
  const { data: fullList } = await supabase
    .from('manhwa')
    .select('*')
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('rating_avg', { ascending: false });

  const total = fullList?.length || 0;
  console.log(`Total database roster is now: ${total} items!`);

  // Save the full list to frontend/src/data/manhwa_500.json
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(dataDir, 'manhwa_500.json'), JSON.stringify(fullList, null, 2));
  console.log(`Successfully wrote ${total} items to frontend/src/data/manhwa_500.json for lightning fast fallback!`);
}

main().catch(console.error);
