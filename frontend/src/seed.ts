import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env');
}

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
  staff(perPage: 8) {
    edges {
      role
      node { name { full } }
    }
  }
`;

function cleanSynopsis(rawText?: string | null): string {
  if (!rawText) return 'No synopsis available.';
  return rawText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
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

  const coverImageUrl = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&q=85';
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
    release_year: media.startDate?.year || new Date().getFullYear(),
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
  if (!response.ok) throw new Error(`AniList API responded with HTTP status ${response.status}`);
  const json = await response.json();
  if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message || 'AniList GraphQL Error');
  return json.data;
}

async function seed() {
  console.log('Fetching top 500 manga/manhwa/manhua from AniList...');
  const query = `
    query GetTopMedia($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, sort: [POPULARITY_DESC]) {
          ${GRAPHQL_MEDIA_FIELDS}
        }
      }
    }
  `;

  let allMedia = [];
  for (let page = 1; page <= 10; page++) {
    console.log(`Fetching page ${page}/10 (50 items per page)...`);
    const data = await queryAniList(query, { page, perPage: 50 });
    const media = data?.Page?.media || [];
    allMedia.push(...media);
  }

  console.log(`Mapping ${allMedia.length} items to database format...`);
  const payload = allMedia.map(mapAniListMediaToManhwa);

  console.log('Pushing to Supabase (upserting by title)...');
  const batchSize = 100;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    console.log(`Uploading batch ${i/batchSize + 1}/${Math.ceil(payload.length/batchSize)}...`);
    const { error } = await supabase.from('manhwa').upsert(batch, { onConflict: 'title' });
    if (error) {
      console.error('Error inserting batch:', error);
    }
  }

  console.log('Seed completed successfully!');
}

seed().catch(console.error);
