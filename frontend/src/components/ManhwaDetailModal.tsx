import React, { useState } from 'react';
import { 
  X, Star, Heart, MessageSquare, ThumbsUp, ThumbsDown, 
  AlertTriangle, ExternalLink, User, Palette, 
  Trash2, EyeOff, CornerDownRight, Send, Share2, Check,
  Info, Loader2, AlertCircle
} from 'lucide-react';
import type { Manhwa, Comment, UserLibraryEntry, UserRole, LibraryStatus, ReportTargetType } from '../types';
import { validateComment, sanitizeText, checkRateLimit, getRateLimitCooldown } from '../lib/validation';

interface ManhwaDetailModalProps {
  manhwa: Manhwa;
  libraryEntry?: UserLibraryEntry;
  comments: Comment[];
  isLoadingReviews?: boolean;
  currentRole: UserRole;
  currentUsername: string;
  onClose: () => void;
  onUpdateLibrary: (manhwaId: string, updates: Partial<UserLibraryEntry>) => void;
  onToggleFavorite: (manhwaId: string) => void;
  onAddComment: (manhwaId: string, content: string, isSpoiler: boolean, parentId: string | null) => void;
  onVoteComment: (commentId: string, type: 'up' | 'down') => void;
  onModerateComment: (commentId: string, action: 'hide' | 'soft-delete' | 'hard-delete') => void;
  onOpenReport: (targetType: ReportTargetType, targetId: string, targetTitle: string) => void;
  onSelectGenre: (genre: string) => void;
  onSelectTrope: (trope: string) => void;
}

export const ManhwaDetailModal: React.FC<ManhwaDetailModalProps> = ({
  manhwa,
  libraryEntry,
  comments,
  isLoadingReviews = false,
  currentRole,
  currentUsername,
  onClose,
  onUpdateLibrary,
  onToggleFavorite,
  onAddComment,
  onVoteComment,
  onModerateComment,
  onOpenReport,
  onSelectGenre,
  onSelectTrope,
}) => {
  const [modalTab, setModalTab] = useState<'overview' | 'comments'>('overview');
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentSpoiler, setNewCommentSpoiler] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);

  const isFavorite = libraryEntry?.is_favorite || false;
  const readingStatus = libraryEntry?.status || 'plan_to_read';
  const userScore = libraryEntry?.score || null;

  const toggleSpoilerReveal = (commentId: string) => {
    setRevealedSpoilers(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleScoreClick = (score: number) => {
    if (currentRole === 'guest') {
      return;
    }
    const newScore = userScore === score ? null : score;
    onUpdateLibrary(manhwa.id, { score: newScore });
  };



  const handleStatusChange = (status: LibraryStatus) => {
    if (currentRole === 'guest') return;
    onUpdateLibrary(manhwa.id, { status });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentRole === 'guest') return;

    const validation = validateComment(newCommentText);
    if (!validation.valid) {
      setCommentError(validation.error || 'Invalid comment.');
      return;
    }

    // Rate limit: 5 comments per minute
    if (!checkRateLimit(`comment-${manhwa.id}`, 5, 60_000)) {
      const cooldown = getRateLimitCooldown(`comment-${manhwa.id}`, 60_000);
      setCommentError(`Too many comments. Wait ${cooldown}s.`);
      return;
    }

    setCommentError('');
    onAddComment(manhwa.id, sanitizeText(newCommentText.trim()), newCommentSpoiler, null);
    setNewCommentText('');
    setNewCommentSpoiler(false);
  };

  const submitReply = (parentId: string) => {
    if (currentRole === 'guest') return;

    const validation = validateComment(replyText);
    if (!validation.valid) {
      // For replies, we silently block — the textarea placeholder guides the user
      return;
    }

    onAddComment(manhwa.id, sanitizeText(replyText.trim()), false, parentId);
    setReplyText('');
    setReplyingToId(null);
  };

  const handleGenreClick = (genre: string) => {
    onSelectGenre(genre);
    onClose();
  };

  const handleTropeClick = (trope: string) => {
    onSelectTrope(trope);
    onClose();
  };

  // Group comments
  const rootComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '860px', padding: '0', overflowX: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner / Header Bar */}
        <div style={{
          position: 'relative',
          height: '160px',
          backgroundColor: '#12151f',
          backgroundImage: manhwa.banner_image_url ? `url(${manhwa.banner_image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottom: '1px solid var(--border-medium)',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,10,13,0.3), rgba(9,10,13,0.96))'
          }} />
          
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: '0.4rem' }}>
            <button 
              onClick={handleShare}
              className="btn btn-secondary btn-icon btn-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: '50%', color: copiedLink ? '#10b981' : '#ffffff' }}
              title="Share Title"
            >
              {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            </button>
            <button 
              onClick={onClose}
              className="btn btn-ghost btn-icon btn-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: '50%', color: '#ffffff' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '0 1.25rem 2rem 1.25rem', marginTop: '-60px', position: 'relative', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* Left Column: Cover & Primary Actions */}
            <div style={{ width: '100%', maxWidth: '200px', margin: '0 auto', flexShrink: 0 }}>
              <div style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '2px solid #232838',
                boxShadow: 'var(--shadow-lg)',
                backgroundColor: '#000000',
                position: 'relative',
                width: '100%',
                paddingTop: '142%'
              }}>
                <img
                  src={manhwa.cover_image_url}
                  alt={manhwa.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
                  }}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Action Buttons: Read Now, Favorite & Tracking */}
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(manhwa.id)}
                  className="btn"
                  style={{
                    width: '100%',
                    backgroundColor: isFavorite ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-elevated)',
                    borderColor: isFavorite ? '#ef4444' : 'var(--border-subtle)',
                    color: isFavorite ? '#ef4444' : 'var(--text-primary)',
                    justifyContent: 'center'
                  }}
                >
                  <Heart size={16} fill={isFavorite ? '#ef4444' : 'none'} />
                  {isFavorite ? 'In Favorites' : 'Add to Favorites'}
                </button>

                {/* Library Status Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#828fa6', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Reading Status
                  </label>
                  <select 
                    value={readingStatus} 
                    onChange={(e) => handleStatusChange(e.target.value as LibraryStatus)}
                    disabled={currentRole === 'guest'}
                  >
                    <option value="reading">Reading</option>
                    <option value="plan_to_read">Plan to Read</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>

                {/* Chapter Information */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#828fa6', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Total Chapters
                  </label>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#60a5fa' }}>
                    {manhwa.total_chapters || '?'}
                  </div>
                </div>

                {/* Report Manhwa Button */}
                <button
                  type="button"
                  onClick={() => onOpenReport('manhwa', manhwa.id, manhwa.title)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ef4444', marginTop: '0.3rem', justifyContent: 'center' }}
                >
                  <AlertTriangle size={13} />
                  Report Inaccuracies
                </button>
              </div>
            </div>

            {/* Right Column: Title, Quick Bar & Tabbed Details */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span className={`badge badge-format-${manhwa.format}`}>{manhwa.format}</span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: manhwa.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: manhwa.status === 'completed' ? '#34d399' : '#60a5fa',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {manhwa.status}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Release {manhwa.release_year}</span>
              </div>

              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {manhwa.title}
              </h2>

              {/* Alt titles block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', margin: '0.35rem 0 0.85rem 0', fontSize: '0.82rem' }}>
                {manhwa.alternative_titles?.hangul && (
                  <div style={{ color: '#94a3b8' }}>
                    <strong style={{ color: '#64748b' }}>Hangul:</strong> {manhwa.alternative_titles.hangul}
                  </div>
                )}
                {manhwa.alternative_titles?.romanized && (
                  <div style={{ color: '#94a3b8' }}>
                    <strong style={{ color: '#64748b' }}>Romanized:</strong> {manhwa.alternative_titles.romanized}
                  </div>
                )}
              </div>

              {/* 1-5 Star Rating Bar */}
              <div style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1.25rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Community Score
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                    <Star size={18} fill="#f59e0b" color="#f59e0b" />
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
                      {(manhwa.rating_avg || 0).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#828fa6' }}>
                      ({(manhwa.rating_count || 0).toLocaleString()})
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {userScore ? 'Your Rating' : 'Rate (1-5)'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem' }}>
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isFilled = (userScore || 0) >= starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => handleScoreClick(starVal)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: currentRole === 'guest' ? 'not-allowed' : 'pointer',
                            padding: '2px',
                            color: isFilled ? '#f59e0b' : '#333c4d',
                          }}
                          title={`Score ${starVal} out of 5`}
                        >
                          <Star size={20} fill={isFilled ? '#f59e0b' : 'none'} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MODAL NAVIGATION TABS: Overview / Chapters List / Discussions */}
              <div style={{
                display: 'flex',
                gap: '0.4rem',
                borderBottom: '1px solid var(--border-medium)',
                marginBottom: '1.25rem'
              }}>
                <button
                  type="button"
                  onClick={() => setModalTab('overview')}
                  style={{
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    borderBottom: modalTab === 'overview' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: modalTab === 'overview' ? '#ffffff' : '#828fa6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Info size={14} />
                  Overview
                </button>


                <button
                  type="button"
                  onClick={() => setModalTab('comments')}
                  style={{
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    borderBottom: modalTab === 'comments' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: modalTab === 'comments' ? '#ffffff' : '#828fa6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <MessageSquare size={14} />
                  Discussions {isLoadingReviews ? '⏳' : `(${comments.length})`}
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {modalTab === 'overview' && (
                <div>
                  {/* Synopsis */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', color: '#828fa6', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Synopsis
                    </h4>
                    <p style={{ color: '#c5cee0', fontSize: '0.88rem', lineHeight: '1.6' }}>
                      {manhwa.synopsis}
                    </p>
                  </div>

                  {/* Creators */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
                        <User size={12} />
                        <span>Story / Author</span>
                      </div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.82rem', marginTop: '0.15rem' }}>
                        {manhwa.authors.join(', ')}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
                        <Palette size={12} />
                        <span>Art Studio</span>
                      </div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.82rem', marginTop: '0.15rem' }}>
                        {manhwa.artists.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Taxonomy & Tropes */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#828fa6', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Tropes & Taxonomy (Click to filter)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {manhwa.genres.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleGenreClick(g)}
                          className="genre-clickable"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: '#161c28',
                            color: '#cbd5e1',
                            border: '1px solid #283447',
                          }}
                        >
                          {g}
                        </button>
                      ))}
                      {manhwa.tropes.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleTropeClick(t)}
                          className="trope-clickable"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                          }}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Official External Links */}
                  {manhwa.official_links && manhwa.official_links.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Licensed Reading Platforms
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {manhwa.official_links.map(link => (
                          <a 
                            key={link.platform} 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            <ExternalLink size={12} />
                            {link.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* TAB 3: DISCUSSIONS */}
              {modalTab === 'comments' && (
                <div>
                  {/* Comment Submission */}
                  <form onSubmit={submitComment} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-elevated)', border: `1px solid ${commentError ? '#ef4444' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                      <textarea
                        rows={2}
                        placeholder={currentRole === 'guest' ? 'Sign in to participate in discussions...' : 'Share your theory or reaction... (max 2000 chars)'}
                        value={newCommentText}
                        onChange={(e) => { setNewCommentText(e.target.value); if (commentError) setCommentError(''); }}
                        disabled={currentRole === 'guest'}
                        maxLength={2000}
                        style={{ background: 'transparent', border: 'none', resize: 'vertical' }}
                        aria-invalid={!!commentError}
                      />
                      {commentError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#f87171', marginBottom: '0.3rem' }}>
                          <AlertCircle size={12} />{commentError}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#9aa4b8', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newCommentSpoiler}
                            onChange={(e) => setNewCommentSpoiler(e.target.checked)}
                            disabled={currentRole === 'guest'}
                            style={{ width: 'auto' }}
                          />
                          <span>Spoiler Tag</span>
                        </label>

                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={currentRole === 'guest' || !newCommentText.trim()}
                        >
                          <Send size={13} />
                          Post
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Comments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
                    {/* Loading indicator for external reviews */}
                    {isLoadingReviews && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#93c5fd',
                        fontSize: '0.82rem'
                      }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Fetching community reviews & discussions from AniList...</span>
                      </div>
                    )}

                    {/* Empty state when done loading and no comments */}
                    {!isLoadingReviews && rootComments.length === 0 && (
                      <div style={{
                        padding: '2.5rem 1.5rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px dashed var(--border-subtle)',
                        color: '#828fa6'
                      }}>
                        <MessageSquare size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>No discussions yet</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Be the first to share your review or theory above!</p>
                      </div>
                    )}

                    {rootComments.map((comment) => {
                      const replies = getReplies(comment.id);

                      return (
                        <div 
                          key={comment.id}
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.85rem',
                            opacity: comment.is_hidden ? 0.55 : 1
                          }}
                        >
                          {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {comment.user_avatar ? (
                                <img 
                                  src={comment.user_avatar} 
                                  alt={comment.username}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#232838', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#94a3b8' }}>
                                  <User size={12} />
                                </div>
                              )}
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>
                                {comment.username}
                              </span>
                              <span className={`badge badge-role-${comment.user_role}`} style={{ fontSize: '0.62rem' }}>
                                {comment.user_role}
                              </span>
                              {comment.is_hidden && (
                                <span style={{ fontSize: '0.68rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                  Hidden
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenReport('comment', comment.id, `Comment by ${comment.username}`)}
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Report Comment"
                                style={{ color: '#ef4444', padding: '2px' }}
                              >
                                <AlertTriangle size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Content */}
                          <div style={{ margin: '0.35rem 0 0.5rem 0' }}>
                            {comment.is_spoiler && !revealedSpoilers[comment.id] ? (
                              <div 
                                onClick={() => toggleSpoilerReveal(comment.id)}
                                style={{
                                  padding: '0.45rem 0.75rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px dashed rgba(239, 68, 68, 0.3)',
                                  borderRadius: 'var(--radius-xs)',
                                  cursor: 'pointer',
                                  color: '#f87171',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <span>⚠️ Spoiler Hidden</span>
                                <span style={{ fontSize: '0.72rem', textDecoration: 'underline' }}>Reveal</span>
                              </div>
                            ) : (
                              <p style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.55', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                                {comment.content}
                              </p>
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onVoteComment(comment.id, 'up')}
                                style={{ padding: '0.15rem 0.4rem', color: comment.user_vote === 'up' ? '#3b82f6' : '#94a3b8' }}
                              >
                                <ThumbsUp size={13} />
                                <span>{comment.upvotes}</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onVoteComment(comment.id, 'down')}
                                style={{ padding: '0.15rem 0.4rem', color: comment.user_vote === 'down' ? '#ef4444' : '#94a3b8' }}
                              >
                                <ThumbsDown size={13} />
                                <span>{comment.downvotes}</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                                disabled={currentRole === 'guest'}
                                style={{ color: '#828fa6', padding: '0.15rem 0.4rem' }}
                              >
                                <CornerDownRight size={12} />
                                Reply
                              </button>
                            </div>

                            {/* Moderation actions */}
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              {(currentRole === 'moderator' || currentRole === 'admin') && (
                                <button
                                  type="button"
                                  onClick={() => onModerateComment(comment.id, 'hide')}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                                >
                                  <EyeOff size={11} />
                                  {comment.is_hidden ? 'Unhide' : 'Hide'}
                                </button>
                              )}

                              {((currentRole === 'user' && comment.username === currentUsername) || currentRole === 'moderator' || currentRole === 'admin') && (
                                <button
                                  type="button"
                                  onClick={() => onModerateComment(comment.id, 'soft-delete')}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.68rem', color: '#f87171', padding: '0.15rem 0.4rem' }}
                                >
                                  <Trash2 size={11} />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Reply Box */}
                          {replyingToId === comment.id && (
                            <div style={{ marginTop: '0.6rem', paddingLeft: '0.75rem', borderLeft: '2px solid #2b3347' }}>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <input
                                  type="text"
                                  placeholder="Write reply..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                />
                                <button 
                                  type="button" 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => submitReply(comment.id)}
                                >
                                  Send
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Nested Replies */}
                          {replies.length > 0 && (
                            <div style={{ marginTop: '0.6rem', paddingLeft: '0.85rem', borderLeft: '2px solid #232838', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {replies.map(reply => (
                                <div key={reply.id} style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-xs)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#e2e8f0' }}>{reply.username}</span>
                                      <span className={`badge badge-role-${reply.user_role}`} style={{ fontSize: '0.62rem' }}>{reply.user_role}</span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{new Date(reply.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
