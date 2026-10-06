import React from 'react';
import { Star, Heart, Layers } from 'lucide-react';
import type { Manhwa } from '../types';

interface ManhwaCardProps {
  manhwa: Manhwa;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelect: (manhwa: Manhwa) => void;
  onSelectGenre?: (genre: string, e: React.MouseEvent) => void;
}

export const ManhwaCard: React.FC<ManhwaCardProps> = ({
  manhwa,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onSelectGenre,
}) => {
  return (
    <div 
      className="surface-card"
      onClick={() => onSelect(manhwa)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Cover Image Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '142%',
        overflow: 'hidden',
        backgroundColor: '#0c0e14',
      }}>
        <img
          src={manhwa.cover_image_url}
          alt={manhwa.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.35s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />

        {/* Format Badge (Manhwa / Manhua / Manga) */}
        <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span className={`badge badge-format-${manhwa.format}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
            {manhwa.format}
          </span>
          {manhwa.is_new_this_week && (
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#ffffff',
              fontSize: '0.58rem',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '3px',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap'
            }}>
              ⚡ New This Week
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={(e) => onToggleFavorite(manhwa.id, e)}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 2,
            background: isFavorite ? 'rgba(239, 68, 68, 0.9)' : 'rgba(10, 12, 18, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFavorite ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Heart size={14} fill={isFavorite ? '#ffffff' : 'none'} />
        </button>

        {/* Bottom subtle shadow */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50px',
          background: 'linear-gradient(to top, rgba(9, 10, 13, 0.95), transparent)',
          pointerEvents: 'none'
        }} />

        {/* Rating overlay badge */}
        <div style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid #232838',
          padding: '1px 5px',
          borderRadius: 'var(--radius-xs)',
          backdropFilter: 'blur(4px)',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#f59e0b'
        }}>
          <Star size={11} fill="#f59e0b" color="#f59e0b" />
          <span>{(manhwa.rating_avg || 0).toFixed(1)}</span>
        </div>

        {/* Chapters count */}
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid #232838',
          padding: '1px 5px',
          borderRadius: 'var(--radius-xs)',
          backdropFilter: 'blur(4px)',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: '#cbd5e1'
        }}>
          <Layers size={11} color="#60a5fa" />
          <span>Ch. {manhwa.total_chapters || '?'}</span>
        </div>
      </div>

      {/* Card Info */}
      <div style={{ padding: '0.7rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h4 style={{
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#f3f4f6',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '0.25rem'
        }} title={manhwa.title}>
          {manhwa.title}
        </h4>

        {/* Korean Subtitle / Alt */}
        {manhwa.alternative_titles?.hangul && (
          <div style={{
            fontSize: '0.7rem',
            color: '#64748b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '0.5rem'
          }}>
            {manhwa.alternative_titles.hangul}
          </div>
        )}

        {/* Clickable Genres on card */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: 'auto' }}>
          {(manhwa.genres || []).slice(0, 2).map((genre) => (
            <span
              key={genre}
              onClick={(e) => {
                if (onSelectGenre) {
                  e.stopPropagation();
                  onSelectGenre(genre, e);
                }
              }}
              className="genre-clickable"
              style={{
                fontSize: '0.68rem',
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid #1e2433',
                color: '#94a3b8'
              }}
              title={`Click to filter catalog by ${genre}`}
            >
              {genre}
            </span>
          ))}
          {(manhwa.genres || []).length > 2 && (
            <span style={{ fontSize: '0.65rem', color: '#64748b', alignSelf: 'center' }}>
              +{(manhwa.genres || []).length - 2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
