import React, { useState, useEffect } from 'react';
import { 
  fetchAniListTrendingManhwa, 
  searchAniListManhwa, 
  fetchAniListByGenre 
} from '../services/anilistService';
import type { Manhwa } from '../types';
import { 
  Search, 
  Sparkles, 
  DownloadCloud, 
  X, 
  Star, 
  BookOpen, 
  Check, 
  ExternalLink,
  Flame,
  Layers
} from 'lucide-react';

interface AniListExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportManhwa: (manhwa: Manhwa) => void;
  onImportMultiple: (manhwas: Manhwa[]) => void;
  existingTitles: string[];
}

const GENRE_SHORTCUTS = ['All Genres', 'Action', 'Fantasy', 'Romance', 'Comedy', 'Drama', 'Adventure', 'Mystery', 'Supernatural'];

export function AniListExplorerModal({
  isOpen,
  onClose,
  onImportManhwa,
  onImportMultiple,
  existingTitles,
}: AniListExplorerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [results, setResults] = useState<Manhwa[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const loadTrending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAniListTrendingManhwa(1, 48);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch from AniList');
    } finally {
      setIsLoading(false);
    }
  };

  // Load trending on mount or when opened
  useEffect(() => {
    if (isOpen) {
      loadTrending();
    }
  }, [isOpen]);


  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      if (selectedGenre !== 'All Genres') {
        handleGenreSelect(selectedGenre);
      } else {
        loadTrending();
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await searchAniListManhwa(searchQuery.trim(), 1, 48);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to search AniList');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenreSelect = async (genre: string) => {
    setSelectedGenre(genre);
    setIsLoading(true);
    setError(null);
    try {
      if (genre === 'All Genres') {
        const data = await fetchAniListTrendingManhwa(1, 48);
        setResults(data);
      } else {
        const data = await fetchAniListByGenre(genre, 1, 48);
        setResults(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to filter by genre');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleImport = (m: Manhwa) => {
    onImportManhwa(m);
    setImportedIds(prev => new Set(prev).add(m.id));
  };

  const handleImportAllVisible = () => {
    const unimported = results.filter(m => !existingTitles.includes(m.title) && !importedIds.has(m.id));
    if (unimported.length > 0) {
      onImportMultiple(unimported);
      setImportedIds(prev => {
        const next = new Set(prev);
        unimported.forEach(item => next.add(item.id));
        return next;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      backgroundColor: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '90vh',
        backgroundColor: '#0f141f',
        border: '1px solid #1f293d',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #0f172a, #0b1120)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                AniList Manhwa Explorer
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  Live AniList API
                </span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Fetch real synopsis, high-res covers, genres, tropes, and import directly to Supabase
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleImportAllVisible}
              disabled={isLoading || results.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: results.length === 0 ? 0.5 : 1
              }}
            >
              <DownloadCloud size={16} />
              Import All Visible ({results.length})
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Search & Genre Filter Bar */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#0b0f19',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search AniList for manhwa (e.g. Solo Leveling, Omniscient Reader, Lookism...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                  backgroundColor: '#131b2e',
                  border: '1px solid #23314d',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={loadTrending}
              disabled={isLoading}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Flame size={15} />
              Trending
            </button>
          </form>

          {/* Quick Genre Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>Filter:</span>
            {GENRE_SHORTCUTS.map(genre => (
              <button
                key={genre}
                onClick={() => handleGenreSelect(genre)}
                style={{
                  padding: '3px 9px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  backgroundColor: selectedGenre === genre ? '#2563eb' : '#131b2e',
                  borderColor: selectedGenre === genre ? '#3b82f6' : '#23314d',
                  color: selectedGenre === genre ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.5rem',
          backgroundColor: '#0a0e17'
        }}>
          {error && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 1rem',
              color: '#94a3b8',
              gap: '1rem'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(56, 189, 248, 0.2)',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Querying AniList GraphQL API...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
              <BookOpen size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>No manhwa found on AniList for this query.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Try searching by alternate title or change genre filter.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem'
            }}>
              {results.map((item) => {
                const isAlreadyInCatalog = existingTitles.includes(item.title) || importedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: '#111827',
                      border: '1px solid #1f293d',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Top Poster & Info */}
                    <div style={{ display: 'flex', gap: '0.85rem', padding: '0.85rem' }}>
                      <img
                        src={item.cover_image_url}
                        alt={item.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&q=85';
                        }}
                        style={{
                          width: '75px',
                          height: '110px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          flexShrink: 0,
                          backgroundColor: '#1e293b'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '3px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#1e3a5f',
                            color: '#60a5fa',
                            textTransform: 'uppercase'
                          }}>
                            {item.format}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Star size={11} fill="#fbbf24" color="#fbbf24" />
                            {(item.rating_avg || 0).toFixed(1)}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            • {item.total_chapters > 0 ? `${item.total_chapters} ch` : 'Ongoing'}
                          </span>
                        </div>

                        <h4 style={{
                          margin: '0 0 2px 0',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          lineHeight: '1.25',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={item.title}>
                          {item.title}
                        </h4>

                        {item.alternative_titles.hangul && (
                          <p style={{
                            margin: '0 0 4px 0',
                            fontSize: '0.72rem',
                            color: '#94a3b8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.alternative_titles.hangul}
                          </p>
                        )}

                        {/* Genres */}
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {item.genres.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              style={{
                                fontSize: '0.65rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#1e293b',
                                color: '#cbd5e1'
                              }}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Synopsis Snippet */}
                    <div style={{
                      padding: '0 0.85rem 0.75rem',
                      fontSize: '0.74rem',
                      color: '#94a3b8',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1
                    }}>
                      {item.synopsis}
                    </div>

                    {/* Tropes / Tags */}
                    {item.tropes.length > 0 && (
                      <div style={{
                        padding: '0 0.85rem 0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}>
                        <Layers size={11} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {item.tropes.slice(0, 3).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{
                      padding: '0.6rem 0.85rem',
                      borderTop: '1px solid #1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#0c111c'
                    }}>
                      {item.official_links[0] && (
                        <a
                          href={item.official_links[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.72rem',
                            color: '#38bdf8',
                            textDecoration: 'none'
                          }}
                        >
                          AniList Page <ExternalLink size={11} />
                        </a>
                      )}

                      <button
                        onClick={() => handleSingleImport(item)}
                        disabled={isAlreadyInCatalog}
                        style={{
                          padding: '0.35rem 0.7rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isAlreadyInCatalog ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: isAlreadyInCatalog ? '#064e3b' : '#2563eb',
                          color: isAlreadyInCatalog ? '#6ee7b7' : '#fff',
                          border: 'none',
                          marginLeft: 'auto'
                        }}
                      >
                        {isAlreadyInCatalog ? (
                          <>
                            <Check size={13} /> Added
                          </>
                        ) : (
                          <>
                            <DownloadCloud size={13} /> Import
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
