import { describe, it, expect } from 'vitest';
import { mapMangaDexToManhwa } from './mangadexService';

describe('MangaDex API Service Mapping', () => {
  it('correctly maps MangaDex manga structure to NeoManhwa model', () => {
    const rawManga: any = {
      id: 'test-uuid-1234',
      type: 'manga',
      attributes: {
        title: { en: 'Solo Bug Player' },
        altTitles: [
          { ko: '나 혼자 버그로 꿀빠는 플레이어' },
          { en: 'Solo Glitch Hunter' },
        ],
        description: {
          en: 'He dies and awakens as Jared Mitch, a corrupt noble with [Game System](https://example.com)...',
        },
        originalLanguage: 'ko',
        status: 'ongoing',
        year: 2021,
        lastChapter: '115',
        tags: [
          {
            id: 'tag-1',
            type: 'tag',
            attributes: {
              name: { en: 'Action' },
              group: 'genre',
            },
          },
          {
            id: 'tag-2',
            type: 'tag',
            attributes: {
              name: { en: 'Fantasy' },
              group: 'genre',
            },
          },
          {
            id: 'tag-3',
            type: 'tag',
            attributes: {
              name: { en: 'Reincarnation' },
              group: 'theme',
            },
          },
        ],
        createdAt: '2021-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      relationships: [
        {
          id: 'author-1',
          type: 'author',
          attributes: { name: 'Kim Taek' },
        },
        {
          id: 'cover-1',
          type: 'cover_art',
          attributes: { fileName: 'cover-art-filename.jpg' },
        },
      ],
    };

    const manhwa = mapMangaDexToManhwa(rawManga);

    expect(manhwa.id).toBe('mangadex-test-uuid-1234');
    expect(manhwa.title).toBe('Solo Bug Player');
    expect(manhwa.alternative_titles?.hangul).toBe('나 혼자 버그로 꿀빠는 플레이어');
    expect(manhwa.format).toBe('manhwa');
    expect(manhwa.status).toBe('ongoing');
    expect(manhwa.total_chapters).toBe(115);
    expect(manhwa.authors).toContain('Kim Taek');
    expect(manhwa.genres).toContain('Action');
    expect(manhwa.genres).toContain('Fantasy');
    expect(manhwa.tropes).toContain('Reincarnation');
    expect(manhwa.cover_image_url).toBe(
      'https://uploads.mangadex.org/covers/test-uuid-1234/cover-art-filename.jpg.512.jpg'
    );
    expect(manhwa.synopsis).toContain('He dies and awakens as Jared Mitch');
    // Markdown link should be stripped cleanly
    expect(manhwa.synopsis).not.toContain('[Game System](');
    expect(manhwa.synopsis).toContain('Game System');
  });

  it('correctly maps Manhua and Manga origin languages', () => {
    const rawManhua: any = {
      id: 'manhua-1',
      attributes: {
        title: { en: 'Tales of Demons and Gods' },
        originalLanguage: 'zh',
        status: 'ongoing',
        tags: [],
        createdAt: '2020-01-01T00:00:00Z',
      },
      relationships: [],
    };
    const manhua = mapMangaDexToManhwa(rawManhua);
    expect(manhua.format).toBe('manhua');

    const rawManga: any = {
      id: 'manga-1',
      attributes: {
        title: { en: 'Berserk' },
        originalLanguage: 'ja',
        status: 'hiatus',
        tags: [],
        createdAt: '2020-01-01T00:00:00Z',
      },
      relationships: [],
    };
    const manga = mapMangaDexToManhwa(rawManga);
    expect(manga.format).toBe('manga');
    expect(manga.status).toBe('hiatus');
  });
});
