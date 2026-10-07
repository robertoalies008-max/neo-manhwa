import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Check,
  ExternalLink,
  X,
  Layers,
  Database,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import type { Manhwa, UserRole, ContributorDraft } from '../types';
import { searchAniListManhwa, fetchAniListTrendingManhwa } from '../services/anilistService';
import { searchMangaDexManhwa, fetchMangaDexPopularManhwa } from '../services/mangadexService';

interface ApiManhwaImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  currentUserId: string;
  currentUsername: string;
  existingTitles: string[];
  onAddDirectly?: (manhwa: Manhwa) => void;
  onProposeDraft?: (draft: Omit<ContributorDraft, 'id' | 'submission_date' | 'moderation_status'>) => void;
  onSelectForManualForm?: (manhwa: Manhwa) => void;
}

type ApiSource = 'all' | 'mangadex' | 'anilist';
type FormatFilter = 'all' | 'manhwa' | 'manhua' | 'manga';

export const ApiManhwaImporterModal: React.FC<ApiManhwaImporterModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  currentUserId,
  currentUsername,
  existingTitles,
  onAddDirectly,
  onProposeDraft,
  onSelectForManualForm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<ApiSource>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Manhwa[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const existingTitlesNormalized = useMemo(() => {
    return new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  }, [existingTitles]);

  // Load trending / popular series on open
  const loadFeatured = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (selectedSource === 'mangadex') {
        const mdData = await fetchMangaDexPopularManhwa(24);
        setResults(mdData);
      } else if (selectedSource === 'anilist') {
        const alData = await fetchAniListTrendingManhwa(1, 24);
        setResults(alData);
      } else {
        // Both: fetch top from both
        const [alData, mdData] = await Promise.allSettled([
          fetchAniListTrendingManhwa(1, 16),
          fetchMangaDexPopularManhwa(16),
        ]);
        const combined: Manhwa[] = [];
        const seenTitles = new Set<string>();

        const alItems = alData.status === 'fulfilled' ? alData.value : [];
        const mdItems = mdData.status === 'fulfilled' ? mdData.value : [];

        // Interleave results
        const maxLen = Math.max(alItems.length, mdItems.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < alItems.length) {
            const key = alItems[i].title.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              combined.push(alItems[i]);
            }
          }
          if (i < mdItems.length) {
            const key = mdItems[i].title.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              combined.push(mdItems[i]);
            }
          }
        }
        setResults(combined);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch series from APIs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFeatured();
    }
  }, [isOpen, selectedSource]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      loadFeatured();
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (selectedSource === 'mangadex') {
        const mdResults = await searchMangaDexManhwa(query, 24);
        setResults(mdResults);
      } else if (selectedSource === 'anilist') {
        const alResults = await searchAniListManhwa(query, 1, 24);
        setResults(alResults);
      } else {
        // Search both concurrently
        const [alData, mdData] = await Promise.allSettled([
          searchAniListManhwa(query, 1, 16),
          searchMangaDexManhwa(query, 16),
        ]);

        const combined: Manhwa[] = [];
        const seenTitles = new Set<string>();

        const alItems = alData.status === 'fulfilled' ? alData.value : [];
        const mdItems = mdData.status === 'fulfilled' ? mdData.value : [];

        const maxLen = Math.max(alItems.length, mdItems.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < alItems.length) {
            const key = alItems[i].title.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              combined.push(alItems[i]);
            }
          }
          if (i < mdItems.length) {
            const key = mdItems[i].title.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              combined.push(mdItems[i]);
            }
          }
        }
        setResults(combined);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during API search');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter((m) => {
      if (formatFilter !== 'all' && m.format !== formatFilter) return false;
      return true;
    });
  }, [results, formatFilter]);

  const handleAddDirectly = (manhwa: Manhwa) => {
    if (!onAddDirectly) return;
    onAddDirectly(manhwa);
    setImportedIds((prev) => new Set(prev).add(manhwa.id));
    setActionSuccessMessage(`Successfully added "${manhwa.title}" directly to live catalog!`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleProposeDraft = (manhwa: Manhwa) => {
    if (!onProposeDraft) return;
    onProposeDraft({
      contributor_id: currentUserId,
      contributor_name: currentUsername,
      title: manhwa.title,
      hangul: manhwa.alternative_titles?.hangul || '',
      format: manhwa.format,
      status: manhwa.status,
      total_chapters: manhwa.total_chapters || 1,
      genres: manhwa.genres,
      synopsis: manhwa.synopsis,
      cover_image_url: manhwa.cover_image_url,
      authors: manhwa.authors,
      artists: manhwa.artists,
      release_year: manhwa.release_year,
      api_source: manhwa.id.startsWith('mangadex') ? 'mangadex' : 'anilist',
      api_id: manhwa.id,
    });
    setImportedIds((prev) => new Set(prev).add(manhwa.id));
    setActionSuccessMessage(`Draft proposal for "${manhwa.title}" dispatched to Moderator Queue!`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleLoadIntoForm = (manhwa: Manhwa) => {
    if (onSelectForManualForm) {
      onSelectForManualForm(manhwa);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: '92vh',
          backgroundColor: '#0c0e17',
          border: '1px solid #1e2638',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(59, 130, 246, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #1a2233',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #121726 0%, #0c0e17 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f97316 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(249, 115, 22, 0.3)',
              }}
            >
              <Database size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  MangaDex & AniList API Importer
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: currentRole === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                    color: currentRole === 'admin' ? '#f87171' : '#c084fc',
                    border: currentRole === 'admin' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(139, 92, 246, 0.4)',
                  }}
                >
                  {currentRole === 'admin' ? 'Super Admin Mode' : 'Contributor Mode'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#828fa6', marginTop: '2px' }}>
                {currentRole === 'admin'
                  ? 'Search global databases and publish series directly to the live catalog or moderation queue.'
                  : 'Search verified series metadata from MangaDex and AniList to propose instant drafts.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#161d2d',
              border: '1px solid #243048',
              borderRadius: '8px',
              padding: '6px',
              color: '#828fa6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.backgroundColor = '#1f2a3f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#828fa6';
              e.currentTarget.style.backgroundColor = '#161d2d';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action success alert banner */}
        {actionSuccessMessage && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.85rem',
              color: '#34d399',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Controls: Source Tabs & Search Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #161d2d',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            backgroundColor: '#0f1320',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Provider Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#090b12', padding: '3px', borderRadius: '8px', border: '1px solid #1a2233' }}>
              <button
                type="button"
                onClick={() => setSelectedSource('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: selectedSource === 'all' ? 700 : 500,
                  backgroundColor: selectedSource === 'all' ? '#2563eb' : 'transparent',
                  color: selectedSource === 'all' ? '#ffffff' : '#828fa6',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Layers size={13} />
                <span>All Providers</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSource('mangadex')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: selectedSource === 'mangadex' ? 700 : 500,
                  backgroundColor: selectedSource === 'mangadex' ? '#ea580c' : 'transparent',
                  color: selectedSource === 'mangadex' ? '#ffffff' : '#828fa6',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#f97316',
                    boxShadow: '0 0 6px #f97316',
                  }}
                />
                <span>MangaDex API</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSource('anilist')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: selectedSource === 'anilist' ? 700 : 500,
                  backgroundColor: selectedSource === 'anilist' ? '#0284c7' : 'transparent',
                  color: selectedSource === 'anilist' ? '#ffffff' : '#828fa6',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#06b6d4',
                    boxShadow: '0 0 6px #06b6d4',
                  }}
                />
                <span>AniList GraphQL</span>
              </button>
            </div>

            {/* Format filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Format:</span>
              {(['all', 'manhwa', 'manhua', 'manga'] as FormatFilter[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatFilter(fmt)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: formatFilter === fmt ? 700 : 500,
                    backgroundColor: formatFilter === fmt ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: formatFilter === fmt ? '1px solid #3b82f6' : '1px solid #1e2638',
                    color: formatFilter === fmt ? '#60a5fa' : '#828fa6',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {fmt === 'all' ? 'All' : fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search series by title (e.g. Solo Leveling, Omniscient Reader, Northern Blade)..."
                style={{
                  width: '100%',
                  height: '42px',
                  paddingLeft: '2.5rem',
                  paddingRight: '2rem',
                  backgroundColor: '#090c14',
                  border: '1px solid #1e2638',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#1e2638')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadFeatured();
                  }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: '42px',
                padding: '0 1.25rem',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isLoading ? <Loader2 size={16} className="spin-animation" /> : <Search size={16} />}
              <span>Search</span>
            </button>
          </form>
        </div>

        {/* Content Area: Grid of Results */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            backgroundColor: '#090b12',
          }}
        >
          {error && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                gap: '1rem',
                color: '#828fa6',
              }}
            >
              <Loader2 size={36} color="#3b82f6" className="spin-animation" />
              <p style={{ fontSize: '0.9rem' }}>Querying MangaDex and AniList API databases...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '280px',
                gap: '0.75rem',
                color: '#828fa6',
                textAlign: 'center',
              }}
            >
              <Database size={36} color="#334155" />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>No matching series found</div>
              <p style={{ fontSize: '0.82rem', maxWidth: '380px' }}>
                Try adjusting your search terms, removing filters, or searching using the series romanized or Korean title.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {filteredResults.map((m) => {
                const isAlreadyInCatalog = existingTitlesNormalized.has(m.title.toLowerCase().trim());
                const isImportedInSession = importedIds.has(m.id);
                const isMangaDex = m.id.startsWith('mangadex');

                return (
                  <div
                    key={m.id}
                    style={{
                      backgroundColor: '#101422',
                      border: isImportedInSession ? '1px solid #10b981' : '1px solid #1c2438',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s ease, border-color 0.2s ease',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Upper Card: Thumbnail + Key Metadata */}
                    <div style={{ display: 'flex', padding: '1rem', gap: '1rem' }}>
                      <div
                        style={{
                          width: '85px',
                          height: '120px',
                          flexShrink: 0,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#181f30',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={m.cover_image_url}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        {/* Provider tag overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            backgroundColor: isMangaDex ? '#ea580c' : '#0284c7',
                            color: '#ffffff',
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {isMangaDex ? 'MangaDex' : 'AniList'}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                          <span className={`badge badge-format-${m.format}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {m.format.toUpperCase()}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              color: m.status === 'completed' ? '#34d399' : '#f59e0b',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {m.status}
                          </span>
                          {m.total_chapters > 0 && (
                            <span style={{ fontSize: '0.65rem', color: '#828fa6' }}>
                              • Ch. {m.total_chapters}
                            </span>
                          )}
                        </div>

                        <h4
                          style={{
                            color: '#ffffff',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            lineHeight: '1.25',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginBottom: '0.2rem',
                          }}
                          title={m.title}
                        >
                          {m.title}
                        </h4>

                        {m.alternative_titles?.hangul && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: '#828fa6',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginBottom: '0.3rem',
                            }}
                          >
                            {m.alternative_titles.hangul}
                          </div>
                        )}

                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 'auto' }}>
                          By {m.authors[0] || 'Unknown Author'}
                        </div>

                        {/* Badges / status tags */}
                        {isAlreadyInCatalog && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '4px', fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                            <Check size={11} /> In Catalog
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Synopsis snippet */}
                    <div
                      style={{
                        padding: '0 1rem 0.75rem 1rem',
                        fontSize: '0.78rem',
                        color: '#94a3b8',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      {m.synopsis}
                    </div>

                    {/* Genres pills */}
                    <div
                      style={{
                        padding: '0 1rem 0.75rem 1rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem',
                      }}
                    >
                      {(m.genres || []).slice(0, 3).map((g) => (
                        <span
                          key={g}
                          style={{
                            fontSize: '0.65rem',
                            backgroundColor: '#171e2e',
                            color: '#cbd5e1',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px solid #222c42',
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>

                    {/* Card Actions Footer */}
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#0c0f1a',
                        borderTop: '1px solid #1a2233',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      {/* External view link */}
                      {m.official_links && m.official_links.length > 0 && (
                        <a
                          href={m.official_links[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#64748b',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                          }}
                          title={`View on ${m.official_links[0].platform}`}
                        >
                          <ExternalLink size={12} />
                          <span>Source</span>
                        </a>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                        {/* Option to load into manual form */}
                        {onSelectForManualForm && (
                          <button
                            type="button"
                            onClick={() => handleLoadIntoForm(m)}
                            title="Load metadata into proposal form to customize before submission"
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#171e2e',
                              border: '1px solid #28354f',
                              color: '#cbd5e1',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>Customize</span>
                          </button>
                        )}

                        {/* Role-Specific Action: Admin vs Contributor */}
                        {currentRole === 'admin' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => handleProposeDraft(m)}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                border: '1px solid rgba(139, 92, 246, 0.35)',
                                color: '#c084fc',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Send size={11} />
                              <span>Draft</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddDirectly(m)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#2563eb',
                                border: '1px solid #3b82f6',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                              }}
                            >
                              <Plus size={13} />
                              <span>Publish to Catalog</span>
                            </button>
                          </div>
                        ) : (
                          /* Contributor / Moderator Action */
                          <button
                            type="button"
                            onClick={() => handleProposeDraft(m)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              backgroundColor: '#8b5cf6',
                              border: '1px solid #a855f7',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                            }}
                          >
                            <Send size={12} />
                            <span>Propose to Queue</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #161d2d',
            backgroundColor: '#0a0d17',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <div>
            Showing <strong style={{ color: '#ffffff' }}>{filteredResults.length}</strong> series from{' '}
            {selectedSource === 'all'
              ? 'MangaDex API & AniList GraphQL'
              : selectedSource === 'mangadex'
              ? 'MangaDex v5 REST API'
              : 'AniList GraphQL API'}
          </div>
          <div>All imported titles undergo enterprise schema normalization & security sanitization.</div>
        </div>
      </div>
    </div>
  );
};
