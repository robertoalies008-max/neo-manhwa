/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiManhwaImporterModal } from './ApiManhwaImporterModal';
import * as mangadexService from '../services/mangadexService';
import * as anilistService from '../services/anilistService';

describe('ApiManhwaImporterModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentUserId: 'test-user-id',
    currentUsername: 'TestHunter',
    existingTitles: ['Solo Leveling'],
  };

  const mockMangaDexData = [
    {
      id: 'mangadex-1',
      title: 'Solo Leveling: Ragnarok',
      format: 'manhwa' as const,
      status: 'ongoing' as const,
      total_chapters: 30,
      authors: ['DAUL'],
      artists: ['REDICE Studio'],
      cover_image_url: 'https://example.com/cover.jpg',
      synopsis: 'Sung Suho awakens his latent bloodline.',
      genres: ['Action', 'Fantasy'],
      tropes: ['System Awakening'],
      release_year: 2024,
      official_links: [],
      is_published: true,
      rating_avg: 4.8,
      rating_count: 50,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    },
  ];

  const mockAniListData = [
    {
      id: 'anilist-1',
      title: 'The Beginning After The End',
      format: 'manhwa' as const,
      status: 'ongoing' as const,
      total_chapters: 175,
      authors: ['TurtleMe'],
      artists: ['Fuyuki23'],
      cover_image_url: 'https://example.com/tbate.jpg',
      synopsis: 'King Grey reincarnates in a magical world.',
      genres: ['Action', 'Adventure'],
      tropes: ['Reincarnation'],
      release_year: 2018,
      official_links: [],
      is_published: true,
      rating_avg: 4.9,
      rating_count: 200,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    },
  ];

  beforeEach(() => {
    vi.spyOn(mangadexService, 'fetchMangaDexPopularManhwa').mockResolvedValue([]);
    vi.spyOn(anilistService, 'fetchAniListTrendingManhwa').mockResolvedValue([]);
    vi.spyOn(mangadexService, 'searchMangaDexManhwa').mockResolvedValue(mockMangaDexData);
    vi.spyOn(anilistService, 'searchAniListManhwa').mockResolvedValue(mockAniListData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header and provider filters', () => {
    render(<ApiManhwaImporterModal {...defaultProps} currentRole="admin" />);

    expect(screen.getByText('MangaDex & AniList API Importer')).toBeInTheDocument();
    expect(screen.getByText('Super Admin Mode')).toBeInTheDocument();
    expect(screen.getByText('MangaDex API')).toBeInTheDocument();
    expect(screen.getByText('AniList GraphQL')).toBeInTheDocument();
  });

  it('renders contributor mode badge when currentRole is contributor', () => {
    render(<ApiManhwaImporterModal {...defaultProps} currentRole="contributor" />);

    expect(screen.getByText('Contributor Mode')).toBeInTheDocument();
  });

  it('triggers search and renders MangaDex and AniList results with proper role actions', async () => {
    const handleAddDirectly = vi.fn();
    const handleProposeDraft = vi.fn();

    render(
      <ApiManhwaImporterModal
        {...defaultProps}
        currentRole="admin"
        onAddDirectly={handleAddDirectly}
        onProposeDraft={handleProposeDraft}
      />
    );

    const input = screen.getByPlaceholderText(/Search series by title/i);
    fireEvent.change(input, { target: { value: 'Solo' } });

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Solo Leveling: Ragnarok')).toBeInTheDocument();
      expect(screen.getByText('The Beginning After The End')).toBeInTheDocument();
    });

    // Admin should see 'Publish to Catalog' button
    const publishBtn = screen.getAllByRole('button', { name: /Publish to Catalog/i })[0];
    expect(publishBtn).toBeInTheDocument();
    fireEvent.click(publishBtn);

    expect(handleAddDirectly).toHaveBeenCalled();
  });

  it('allows contributors to propose drafts from API results', async () => {
    const handleProposeDraft = vi.fn();

    render(
      <ApiManhwaImporterModal
        {...defaultProps}
        currentRole="contributor"
        onProposeDraft={handleProposeDraft}
      />
    );

    const input = screen.getByPlaceholderText(/Search series by title/i);
    fireEvent.change(input, { target: { value: 'Solo' } });

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Solo Leveling: Ragnarok')).toBeInTheDocument();
    });

    // Contributor should see 'Propose to Queue' button
    const proposeBtn = screen.getAllByRole('button', { name: /Propose to Queue/i })[0];
    expect(proposeBtn).toBeInTheDocument();
    fireEvent.click(proposeBtn);

    expect(handleProposeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The Beginning After The End',
        api_source: 'anilist',
        contributor_id: 'test-user-id',
        authors: ['TurtleMe'],
      })
    );
  });

  it('prevents spam clicking by throttling and disabling button on proposal', async () => {
    const handleProposeDraft = vi.fn();

    render(
      <ApiManhwaImporterModal
        {...defaultProps}
        currentRole="contributor"
        onProposeDraft={handleProposeDraft}
      />
    );

    const input = screen.getByPlaceholderText(/Search series by title/i);
    fireEvent.change(input, { target: { value: 'Solo' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('The Beginning After The End')).toBeInTheDocument();
    });

    const proposeBtn = screen.getAllByRole('button', { name: /Propose to Queue/i })[0];

    // Rapid spam clicks (simulate 5 fast clicks)
    fireEvent.click(proposeBtn);
    fireEvent.click(proposeBtn);
    fireEvent.click(proposeBtn);
    fireEvent.click(proposeBtn);
    fireEvent.click(proposeBtn);

    // Should only be called once
    expect(handleProposeDraft).toHaveBeenCalledTimes(1);

    // Button should now be disabled and reflect 'In Queue' state
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /In Queue/i })[0]).toBeDisabled();
    });
  });

  it('disables actions and displays In Catalog when series is already in catalog', async () => {
    render(
      <ApiManhwaImporterModal
        {...defaultProps}
        existingTitles={['The Beginning After The End']}
        currentRole="contributor"
      />
    );

    const input = screen.getByPlaceholderText(/Search series by title/i);
    fireEvent.change(input, { target: { value: 'Solo' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('The Beginning After The End')).toBeInTheDocument();
    });

    // The button for TBATE should show 'In Catalog' and be disabled
    const catalogBtn = screen.getByRole('button', { name: /In Catalog/i });
    expect(catalogBtn).toBeInTheDocument();
    expect(catalogBtn).toBeDisabled();
  });

  it('disables actions and displays In Queue when series is in pending drafts', async () => {
    render(
      <ApiManhwaImporterModal
        {...defaultProps}
        pendingDraftTitles={['The Beginning After The End']}
        currentRole="contributor"
      />
    );

    const input = screen.getByPlaceholderText(/Search series by title/i);
    fireEvent.change(input, { target: { value: 'Solo' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('The Beginning After The End')).toBeInTheDocument();
    });

    // The button for TBATE should show 'In Queue' and be disabled
    const queueBtn = screen.getByRole('button', { name: /In Queue/i });
    expect(queueBtn).toBeInTheDocument();
    expect(queueBtn).toBeDisabled();
  });
});
