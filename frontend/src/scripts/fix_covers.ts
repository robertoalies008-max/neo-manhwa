import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  const updates = [
    {
      title: "Omniscient Reader's Viewpoint",
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/119257-RtxJMRCunHXc.jpg'
    },
    {
      title: 'Return of the Mount Hua Sect',
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx131925-P2q6kFjW4Vfg.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/131925-bTfZQh61Q1n0.jpg'
    },
    {
      title: 'Nano Machine',
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx120724-iYyPjPj3Qz2y.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/120724-csk2sW3Z97U0.jpg'
    },
    {
      title: 'S-Classes That I Raised',
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx141235-uX9K0n47r83u.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/141235-9x88L6rD4V9x.jpg'
    },
    {
      title: 'Solo Leveling: Ragnarok',
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx178652-3y7M2q1K982b.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/178652-5K3h2G1F82h.jpg'
    },
    {
      title: 'The Greatest Estate Developer',
      cover_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx137688-6x3812839912.jpg',
      banner_image_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/137688-82910398219.jpg'
    }
  ];

  for (const u of updates) {
    const { data, error } = await sb.from('manhwa').update({
      cover_image_url: u.cover_image_url,
      banner_image_url: u.banner_image_url
    }).eq('title', u.title).select();
    console.log('Updated', u.title, error ? error : (data?.length + ' rows'));
  }
}

main().catch(console.error);
