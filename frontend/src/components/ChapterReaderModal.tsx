import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Manhwa } from '../types';

interface ChapterReaderModalProps {
  manhwa: Manhwa;
  initialChapter: number;
  onClose: () => void;
  onChapterComplete: (chapter: number) => void;
}

export const ChapterReaderModal: React.FC<ChapterReaderModalProps> = ({
  manhwa,
  initialChapter,
  onClose,
  onChapterComplete,
}) => {
  const [currentChapter, setCurrentChapter] = useState(initialChapter > 0 ? initialChapter : 1);

  const goToNextChapter = () => {
    if (currentChapter < manhwa.total_chapters) {
      const next = currentChapter + 1;
      setCurrentChapter(next);
      onChapterComplete(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevChapter = () => {
    if (currentChapter > 1) {
      setCurrentChapter(currentChapter - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#040507',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Top Reader Controls Header */}
      <header style={{
        height: '56px',
        backgroundColor: '#0c0e14',
        borderBottom: '1px solid var(--border-medium)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.4rem' }}
          >
            <X size={18} />
          </button>
          <div style={{ overflow: 'hidden' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {manhwa.title}
            </h4>
            <div style={{ fontSize: '0.72rem', color: '#60a5fa' }}>
              Chapter {currentChapter} of {manhwa.total_chapters}
            </div>
          </div>
        </div>

        {/* Chapter Switcher & Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={goToPrevChapter}
            disabled={currentChapter <= 1}
            style={{ padding: '0.3rem 0.6rem' }}
          >
            <ChevronLeft size={14} />
            <span style={{ display: 'none' }}>Prev</span>
          </button>

          <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0 0.4rem', color: '#cbd5e1' }}>
            Ch. {currentChapter}
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={goToNextChapter}
            disabled={currentChapter >= manhwa.total_chapters}
            style={{ padding: '0.3rem 0.6rem' }}
          >
            <span style={{ display: 'none' }}>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* Webtoon Continuous Vertical Scroll Canvas */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.5rem 0.5rem 5rem 0.5rem',
        backgroundColor: '#07080b',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(0,0,0,0.8)',
          backgroundColor: '#0c0e14',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {/* Chapter Splash Title */}
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center', borderBottom: '1px solid #1e2433' }}>
            <span style={{ fontSize: '0.72rem', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              {manhwa.format.toUpperCase()} EPISODE {currentChapter}
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.35rem' }}>
              {manhwa.title}
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
              Illustrated by {manhwa.artists.join(', ')} • Official Vertical Reader
            </p>
          </div>

          {/* Webtoon Art Panels Mockup */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <img 
              src={manhwa.cover_image_url} 
              alt="Panel 1" 
              style={{ width: '100%', height: 'auto', display: 'block' }} 
            />
            {manhwa.banner_image_url && (
              <img 
                src={manhwa.banner_image_url} 
                alt="Panel 2" 
                style={{ width: '100%', height: 'auto', display: 'block' }} 
              />
            )}
            <div style={{
              padding: '4rem 1.5rem',
              backgroundColor: '#0f1219',
              textAlign: 'center',
              borderTop: '1px solid #1a202e',
              borderBottom: '1px solid #1a202e'
            }}>
              <p style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
                "The gate vibrations exceeded S-Class thresholds. Sung Jin-woo’s monarch shadow loomed across the dimensional fracture..."
              </p>
            </div>
            <img 
              src={manhwa.cover_image_url} 
              alt="Panel 3" 
              style={{ width: '100%', height: 'auto', filter: 'hue-rotate(30deg) brightness(0.9)', display: 'block' }} 
            />
          </div>

          {/* Chapter End Controls */}
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', backgroundColor: '#10131d', borderTop: '1px solid #232838' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
              End of Chapter {currentChapter}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#828fa6', marginBottom: '1.5rem' }}>
              Your reading progress has been synchronized to your personal library vault.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Back to Details
              </button>
              {currentChapter < manhwa.total_chapters ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={goToNextChapter}
                >
                  Next: Chapter {currentChapter + 1}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                >
                  <Check size={16} />
                  Mark Title Completed
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
