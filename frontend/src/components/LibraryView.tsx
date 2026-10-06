import React, { useState } from 'react';
import { BookOpen, Star, Heart, Plus, Minus, ArrowRight } from 'lucide-react';
import type { Manhwa, UserLibraryEntry, LibraryStatus } from '../types';

interface LibraryViewProps {
  library: UserLibraryEntry[];
  manhwaList: Manhwa[];
  onSelectManhwa: (manhwa: Manhwa) => void;
  onUpdateLibrary: (manhwaId: string, updates: Partial<UserLibraryEntry>) => void;
  onToggleFavorite: (manhwaId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  library,
  manhwaList,
  onSelectManhwa,
  onUpdateLibrary,
  onToggleFavorite,
}) => {
  const [filter, setFilter] = useState<LibraryStatus | 'favorites' | 'all'>('all');

  // Pair library entries with their manhwa entity
  const enrichedEntries = library.map(entry => {
    const manhwa = manhwaList.find(m => m.id === entry.manhwa_id);
    return { ...entry, manhwa };
  }).filter(e => e.manhwa !== undefined);

  const filteredEntries = enrichedEntries.filter(entry => {
    if (filter === 'all') return true;
    if (filter === 'favorites') return entry.is_favorite;
    return entry.status === filter;
  });

  const getStatusColor = (status: LibraryStatus) => {
    switch (status) {
      case 'reading': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'plan_to_read': return '#8b5cf6';
      case 'on_hold': return '#f59e0b';
      case 'dropped': return '#ef4444';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>Personal Vault & Library</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Tracking your chapter progress, personal 1-5 ratings, and curated lists.
          </p>
        </div>

        {/* Filter Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          backgroundColor: 'var(--bg-elevated)',
          padding: '0.35rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto'
        }}>
          {(['all', 'reading', 'plan_to_read', 'completed', 'on_hold', 'favorites'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'capitalize',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                backgroundColor: filter === tab ? '#2563eb' : 'transparent',
                color: filter === tab ? '#ffffff' : '#828fa6',
                cursor: 'pointer'
              }}
            >
              {tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px dashed var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '4rem 2rem',
          textAlign: 'center',
          color: '#828fa6'
        }}>
          <BookOpen size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.4 }} />
          <h4 style={{ color: '#ffffff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No titles in this category</h4>
          <p style={{ fontSize: '0.85rem' }}>Browse the catalog and add manhwa titles to your reading queue.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredEntries.map(({ manhwa, current_chapter, status, score, is_favorite }) => {
            if (!manhwa) return null;
            const hasTotal = typeof manhwa.total_chapters === 'number' && manhwa.total_chapters > 0;
            const progressPercent = hasTotal 
              ? Math.min(100, Math.round((current_chapter / manhwa.total_chapters) * 100)) 
              : 0;

            return (
              <div 
                key={manhwa.id}
                className="surface-card"
                style={{
                  display: 'flex',
                  padding: '1rem',
                  gap: '1rem',
                  borderRadius: 'var(--radius-md)',
                  alignItems: 'center'
                }}
              >
                {/* Cover Thumbnail */}
                <div 
                  onClick={() => onSelectManhwa(manhwa)}
                  style={{
                    width: '80px',
                    height: '115px',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <img 
                    src={manhwa.cover_image_url} 
                    alt={manhwa.title} 
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>

                {/* Info & Progress */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h4 
                      onClick={() => onSelectManhwa(manhwa)}
                      style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f3f4f6', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {manhwa.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(manhwa.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: is_favorite ? '#ef4444' : '#525b6e' }}
                    >
                      <Heart size={16} fill={is_favorite ? '#ef4444' : 'none'} />
                    </button>
                  </div>

                  {/* Status & Rating tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: getStatusColor(status),
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '1px 6px',
                      borderRadius: '3px'
                    }}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    {score && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                        <Star size={12} fill="#f59e0b" />
                        {score}/5
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#828fa6', marginBottom: '0.25rem' }}>
                      <span>Ch. {current_chapter} of {hasTotal ? manhwa.total_chapters : '?'}</span>
                      <span>{hasTotal ? `${progressPercent}%` : 'Ongoing'}</span>
                    </div>
                    <div style={{ height: '4px', backgroundColor: '#1e2433', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${hasTotal ? progressPercent : Math.min(100, current_chapter * 2)}%`, height: '100%', backgroundColor: getStatusColor(status), transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  {/* Quick Chapter Step Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onUpdateLibrary(manhwa.id, { current_chapter: Math.max(0, current_chapter - 1) })}
                      disabled={current_chapter <= 0}
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onUpdateLibrary(manhwa.id, { current_chapter: Math.min(manhwa.total_chapters, current_chapter + 1) })}
                      disabled={current_chapter >= manhwa.total_chapters}
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onSelectManhwa(manhwa)}
                      style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#60a5fa' }}
                    >
                      Details <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
