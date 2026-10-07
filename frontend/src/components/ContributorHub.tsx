import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  FileText,
  Send,
  AlertCircle,
  Search,
  Database,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import type { ContributorDraft, ManhwaFormat, ManhwaStatus, UserRole, Manhwa } from '../types';
import {
  validateTitle,
  validateSynopsis,
  sanitizeText,
  checkRateLimit,
  getRateLimitCooldown,
  canContribute,
} from '../lib/validation';
import { searchAniListManhwa } from '../services/anilistService';
import { searchMangaDexManhwa } from '../services/mangadexService';

interface ContributorHubProps {
  drafts: ContributorDraft[];
  currentRole: UserRole;
  currentUserId: string;
  currentUsername: string;
  existingTitles?: string[];
  onProposeDraft: (draft: Omit<ContributorDraft, 'id' | 'submission_date' | 'moderation_status'>) => void;
  onOpenApiImporter?: () => void;
  onAddDirectly?: (manhwa: Manhwa) => void;
  prefilledManhwa?: Manhwa | null;
}

export const ContributorHub: React.FC<ContributorHubProps> = ({
  drafts,
  currentRole,
  currentUserId,
  currentUsername,
  existingTitles = [],
  onProposeDraft,
  onOpenApiImporter,
  onAddDirectly,
  prefilledManhwa,
}) => {
  const [activeMode, setActiveMode] = useState<'search' | 'manual'>('search');
  const [title, setTitle] = useState('');
  const [hangul, setHangul] = useState('');
  const [format, setFormat] = useState<ManhwaFormat>('manhwa');
  const [status, setStatus] = useState<ManhwaStatus>('ongoing');
  const [totalChapters, setTotalChapters] = useState(1);
  const [genres, setGenres] = useState('Action, Fantasy');
  const [synopsis, setSynopsis] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(undefined);
  const [authors, setAuthors] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [releaseYear, setReleaseYear] = useState<number | undefined>(undefined);
  const [apiSource, setApiSource] = useState<'mangadex' | 'anilist' | 'manual'>('manual');
  const [apiId, setApiId] = useState<string | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimitError, setRateLimitError] = useState('');

  // Quick API Search inside Contributor Hub
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiProvider, setApiProvider] = useState<'all' | 'mangadex' | 'anilist'>('all');
  const [apiResults, setApiResults] = useState<Manhwa[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [apiSearchError, setApiSearchError] = useState<string | null>(null);
  const [justImportedId, setJustImportedId] = useState<string | null>(null);
  const [proposedApiIds, setProposedApiIds] = useState<Set<string>>(new Set());
  const [apiProcessingId, setApiProcessingId] = useState<string | null>(null);

  // Normalized title sets for fast duplicate prevention
  const pendingDraftTitles = useMemo(() => {
    return new Set(
      drafts
        .filter((d) => d.moderation_status === 'pending')
        .map((d) => d.title.toLowerCase().trim())
    );
  }, [drafts]);

  const catalogTitles = useMemo(() => {
    return new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  }, [existingTitles]);

  // Cooldown countdown timer for anti-spam protection
  useEffect(() => {
    if (submitCooldown <= 0) return;
    const timer = setInterval(() => {
      setSubmitCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [submitCooldown]);

  // If a prefilled manhwa is passed in (e.g. from modal)
  useEffect(() => {
    if (prefilledManhwa) {
      applyManhwaToForm(prefilledManhwa);
      setActiveMode('manual');
    }
  }, [prefilledManhwa]);

  // Access check — contributors (and above) only
  if (!canContribute(currentRole)) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
        <h3 style={{ color: '#ffffff', fontSize: '1.25rem' }}>Access Denied (403 Forbidden)</h3>
        <p style={{ color: '#828fa6', marginTop: '0.5rem' }}>
          Per the RBAC Privilege Matrix, only <strong>Contributor</strong>, <strong>Moderator</strong>, and{' '}
          <strong>Super Admin</strong> roles may propose new catalog entries.
        </p>
      </div>
    );
  }

  const applyManhwaToForm = (m: Manhwa) => {
    setTitle(m.title);
    setHangul(m.alternative_titles?.hangul || '');
    setFormat(m.format);
    setStatus(m.status);
    setTotalChapters(m.total_chapters || 1);
    setGenres((m.genres || []).join(', '));
    setSynopsis(m.synopsis);
    setCoverImageUrl(m.cover_image_url);
    setAuthors(m.authors || []);
    setArtists(m.artists || []);
    setReleaseYear(m.release_year);
    setApiSource(m.id.startsWith('mangadex') ? 'mangadex' : 'anilist');
    setApiId(m.id);
  };

  const handleApiSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = apiSearchQuery.trim();
    if (!query) return;

    setIsSearchingApi(true);
    setApiSearchError(null);
    try {
      if (apiProvider === 'mangadex') {
        const mdResults = await searchMangaDexManhwa(query, 12);
        setApiResults(mdResults);
      } else if (apiProvider === 'anilist') {
        const alResults = await searchAniListManhwa(query, 1, 12);
        setApiResults(alResults);
      } else {
        const [alData, mdData] = await Promise.allSettled([
          searchAniListManhwa(query, 1, 8),
          searchMangaDexManhwa(query, 8),
        ]);
        const combined: Manhwa[] = [];
        const seen = new Set<string>();

        const al = alData.status === 'fulfilled' ? alData.value : [];
        const md = mdData.status === 'fulfilled' ? mdData.value : [];
        const max = Math.max(al.length, md.length);

        for (let i = 0; i < max; i++) {
          if (i < al.length && !seen.has(al[i].title.toLowerCase())) {
            seen.add(al[i].title.toLowerCase());
            combined.push(al[i]);
          }
          if (i < md.length && !seen.has(md[i].title.toLowerCase())) {
            seen.add(md[i].title.toLowerCase());
            combined.push(md[i]);
          }
        }
        setApiResults(combined);
      }
    } catch (err: any) {
      setApiSearchError(err.message || 'Failed to search APIs');
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handleQuickProposeFromApi = (m: Manhwa) => {
    const norm = m.title.toLowerCase().trim();
    if (
      apiProcessingId === m.id ||
      proposedApiIds.has(m.id) ||
      pendingDraftTitles.has(norm) ||
      catalogTitles.has(norm)
    ) {
      return;
    }

    // Anti-spam rate limiting: max 5 draft submissions per 2 minutes
    if (!checkRateLimit(`draft-submit-${currentUserId}`, 5, 2 * 60_000)) {
      const cooldown = getRateLimitCooldown(`draft-submit-${currentUserId}`, 2 * 60_000);
      setRateLimitError(`Too many submissions. Please wait ${cooldown}s before trying again.`);
      return;
    }
    setRateLimitError('');
    setApiProcessingId(m.id);

    onProposeDraft({
      contributor_id: currentUserId,
      contributor_name: currentUsername,
      title: sanitizeText(m.title),
      hangul: sanitizeText(m.alternative_titles?.hangul || ''),
      format: m.format,
      status: m.status,
      total_chapters: m.total_chapters || 1,
      genres: (m.genres || []).map((g) => sanitizeText(g.trim())),
      synopsis: sanitizeText(m.synopsis),
      cover_image_url: m.cover_image_url,
      authors: m.authors,
      artists: m.artists,
      release_year: m.release_year,
      api_source: m.id.startsWith('mangadex') ? 'mangadex' : 'anilist',
      api_id: m.id,
    });
    setProposedApiIds((prev) => new Set(prev).add(m.id));
    setJustImportedId(m.id);
    setTimeout(() => setApiProcessingId(null), 350);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const norm = title.trim().toLowerCase();
    if (pendingDraftTitles.has(norm)) {
      newErrors.title = 'A proposal for this title is already pending in the moderation queue.';
    } else if (catalogTitles.has(norm)) {
      newErrors.title = 'This title is already published in the official catalog.';
    }

    const titleResult = validateTitle(title);
    if (!titleResult.valid && !newErrors.title) newErrors.title = titleResult.error!;

    const synopsisResult = validateSynopsis(synopsis);
    if (!synopsisResult.valid) newErrors.synopsis = synopsisResult.error!;

    if (totalChapters < 1 || totalChapters > 10000 || !Number.isInteger(totalChapters)) {
      newErrors.totalChapters = 'Chapter count must be a whole number between 1 and 10,000.';
    }

    const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean);
    if (genreList.length === 0) newErrors.genres = 'At least one genre is required.';
    if (genreList.length > 15) newErrors.genres = 'Maximum 15 genres allowed.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitCooldown > 0) return;

    // Rate limit: max 5 draft submissions per 2 minutes
    if (!checkRateLimit(`draft-submit-${currentUserId}`, 5, 2 * 60_000)) {
      const cooldown = getRateLimitCooldown(`draft-submit-${currentUserId}`, 2 * 60_000);
      setRateLimitError(`Too many submissions. Please wait ${cooldown}s before trying again.`);
      return;
    }
    setRateLimitError('');

    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitCooldown(4);
    setTimeout(() => {
      onProposeDraft({
        contributor_id: currentUserId,
        contributor_name: currentUsername,
        title: sanitizeText(title.trim()),
        hangul: sanitizeText(hangul.trim()),
        format,
        status,
        total_chapters: Number(totalChapters),
        genres: genres.split(',').map((g) => sanitizeText(g.trim())).filter(Boolean),
        synopsis: sanitizeText(synopsis.trim()),
        cover_image_url: coverImageUrl,
        authors: authors.length > 0 ? authors : undefined,
        artists: artists.length > 0 ? artists : undefined,
        release_year: releaseYear,
        api_source: apiSource,
        api_id: apiId,
      });
      setTitle('');
      setHangul('');
      setSynopsis('');
      setCoverImageUrl(undefined);
      setAuthors([]);
      setArtists([]);
      setErrors({});
      setIsSubmitting(false);
    }, 400);
  };

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', fontSize: '0.75rem', color: '#ef4444' }}>
        <AlertCircle size={12} />
        {errors[field]}
      </div>
    ) : null;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span className="badge badge-role-contributor">Contributor & Admin Workspace</span>
            <span style={{ fontSize: '0.72rem', color: '#828fa6' }}>• Anti-Spam Protected</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>Metadata & Catalog Proposal Hub</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Search global APIs (MangaDex & AniList) to import complete metadata, or submit custom drafts for moderation review.
          </p>
        </div>

        {onOpenApiImporter && (
          <button
            type="button"
            onClick={onOpenApiImporter}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#2563eb',
              boxShadow: '0 2px 12px rgba(37, 99, 235, 0.4)',
            }}
          >
            <Database size={15} />
            <span>Open API Importer Modal</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Switcher between API Search & Manual Form */}
        <div className="surface-card" style={{ padding: '1.75rem' }}>
          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#0c0e17',
              padding: '4px',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              border: '1px solid #1a2233',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMode('search')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: activeMode === 'search' ? 700 : 500,
                backgroundColor: activeMode === 'search' ? '#2563eb' : 'transparent',
                color: activeMode === 'search' ? '#ffffff' : '#828fa6',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Search size={14} />
              <span>Search MangaDex & AniList</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('manual')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: activeMode === 'manual' ? 700 : 500,
                backgroundColor: activeMode === 'manual' ? '#8b5cf6' : 'transparent',
                color: activeMode === 'manual' ? '#ffffff' : '#828fa6',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <PlusCircle size={14} />
              <span>Manual Entry Form</span>
            </button>
          </div>

          {rateLimitError && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.8rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                color: '#f87171',
              }}
            >
              <AlertCircle size={14} />
              {rateLimitError}
            </div>
          )}

          {/* MODE 1: SEARCH MANGADEX & ANILIST */}
          {activeMode === 'search' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>API Provider:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['all', 'mangadex', 'anilist'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setApiProvider(prov)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: apiProvider === prov ? 700 : 500,
                        backgroundColor: apiProvider === prov ? '#1d4ed8' : '#111827',
                        color: apiProvider === prov ? '#ffffff' : '#9ca3af',
                        border: apiProvider === prov ? '1px solid #3b82f6' : '1px solid #1f2937',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {prov === 'all' ? 'Both' : prov === 'mangadex' ? 'MangaDex' : 'AniList'}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleApiSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    placeholder="Search by series title (e.g. Solo Leveling, Northern Blade)..."
                    value={apiSearchQuery}
                    onChange={(e) => setApiSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '2.2rem',
                      height: '38px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingApi}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 1rem', fontSize: '0.8rem' }}
                >
                  {isSearchingApi ? <Loader2 size={14} className="spin-animation" /> : <Search size={14} />}
                  <span>Search</span>
                </button>
              </form>

              {apiSearchError && (
                <div style={{ padding: '0.6rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.78rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  {apiSearchError}
                </div>
              )}

              {/* API Results list */}
              {isSearchingApi ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#828fa6' }}>
                  <Loader2 size={28} color="#3b82f6" className="spin-animation" style={{ margin: '0 auto 0.5rem auto' }} />
                  <div style={{ fontSize: '0.82rem' }}>Querying MangaDex and AniList databases...</div>
                </div>
              ) : apiResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {apiResults.map((m) => {
                    const isMangaDex = m.id.startsWith('mangadex');
                    const normTitle = m.title.toLowerCase().trim();
                    const isAlreadyInCat = catalogTitles.has(normTitle) || justImportedId === m.id;
                    const isAlreadyInQueue = pendingDraftTitles.has(normTitle) || proposedApiIds.has(m.id);
                    const isApiProcessing = apiProcessingId === m.id;

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: '#0d111d',
                          border: isAlreadyInCat ? '1px solid #10b981' : isAlreadyInQueue ? '1px solid #8b5cf6' : '1px solid #1a2233',
                          borderRadius: '8px',
                        }}
                      >
                        <img
                          src={m.cover_image_url}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
                          }}
                          style={{ width: '52px', height: '74px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <span
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: isMangaDex ? '#ea580c' : '#0284c7',
                                color: '#ffffff',
                                textTransform: 'uppercase',
                              }}
                            >
                              {isMangaDex ? 'MangaDex' : 'AniList'}
                            </span>
                            <span className={`badge badge-format-${m.format}`} style={{ fontSize: '0.58rem', padding: '0 4px' }}>
                              {m.format}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.title}
                          </div>
                          {m.alternative_titles?.hangul && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{m.alternative_titles.hangul}</div>
                          )}

                          <div style={{ fontSize: '0.7rem', color: '#828fa6', marginTop: 'auto' }}>
                            Ch. {m.total_chapters || '?'} • By {m.authors[0] || 'Unknown'}
                          </div>

                          {/* Quick buttons */}
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                applyManhwaToForm(m);
                                setActiveMode('manual');
                              }}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                backgroundColor: '#171e2e',
                                border: '1px solid #28354f',
                                color: '#cbd5e1',
                                cursor: 'pointer',
                              }}
                            >
                              Edit in Form
                            </button>

                            {currentRole === 'admin' && onAddDirectly ? (
                              <button
                                type="button"
                                disabled={isApiProcessing || isAlreadyInCat}
                                onClick={() => {
                                  if (isApiProcessing || isAlreadyInCat) return;
                                  setApiProcessingId(m.id);
                                  onAddDirectly(m);
                                  setJustImportedId(m.id);
                                  setTimeout(() => setApiProcessingId(null), 350);
                                }}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.7rem',
                                  borderRadius: '4px',
                                  backgroundColor: isAlreadyInCat ? '#10b981' : '#2563eb',
                                  border: isAlreadyInCat ? '1px solid #059669' : '1px solid #3b82f6',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  cursor: isApiProcessing || isAlreadyInCat ? 'not-allowed' : 'pointer',
                                  opacity: isAlreadyInCat ? 0.8 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                {isApiProcessing ? (
                                  <Loader2 size={11} className="spin-animation" />
                                ) : isAlreadyInCat ? (
                                  <Check size={11} />
                                ) : (
                                  <Plus size={11} />
                                )}
                                <span>{isAlreadyInCat ? 'In Catalog' : 'Add to Catalog'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isApiProcessing || isAlreadyInQueue || isAlreadyInCat}
                                onClick={() => handleQuickProposeFromApi(m)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.7rem',
                                  borderRadius: '4px',
                                  backgroundColor: isAlreadyInCat ? '#10b981' : isAlreadyInQueue ? '#475569' : '#8b5cf6',
                                  border: isAlreadyInCat ? '1px solid #059669' : isAlreadyInQueue ? '1px solid #64748b' : '1px solid #a855f7',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  cursor: isApiProcessing || isAlreadyInQueue || isAlreadyInCat ? 'not-allowed' : 'pointer',
                                  opacity: isAlreadyInQueue || isAlreadyInCat ? 0.75 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                {isApiProcessing ? (
                                  <Loader2 size={10} className="spin-animation" />
                                ) : isAlreadyInCat ? (
                                  <Check size={10} />
                                ) : isAlreadyInQueue ? (
                                  <Check size={10} />
                                ) : (
                                  <Send size={10} />
                                )}
                                <span>{isAlreadyInCat ? 'In Catalog' : isAlreadyInQueue ? 'In Queue' : 'Propose Draft'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.82rem' }}>
                  <Database size={28} color="#334155" style={{ margin: '0 auto 0.5rem auto' }} />
                  <div>Type a series title above to query live records from MangaDex and AniList.</div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#475569' }}>
                    Anti-spam protection actively limits rapid consecutive draft submissions.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: MANUAL PROPOSAL FORM */}
          {activeMode === 'manual' && (
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {apiSource !== 'manual' && (
                <div
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Pre-filled from {apiSource === 'mangadex' ? 'MangaDex' : 'AniList'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setApiSource('manual');
                      setApiId(undefined);
                      setCoverImageUrl(undefined);
                    }}
                    style={{ background: 'none', border: 'none', color: '#828fa6', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    Clear API Link
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="draft-title" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                  Official English Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="draft-title"
                  type="text"
                  placeholder="e.g. The Legend of the Northern Blade"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors(p => ({ ...p, title: '' })); }}
                  maxLength={200}
                  aria-invalid={!!errors.title}
                  style={{ borderColor: errors.title ? '#ef4444' : undefined }}
                />
                <FieldError field="title" />
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', textAlign: 'right' }}>{title.length}/200</div>
              </div>

              <div>
                <label htmlFor="draft-hangul" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                  Native Title (Hangul / Hanzi / Kanji)
                </label>
                <input
                  id="draft-hangul"
                  type="text"
                  placeholder="e.g. 북검전기"
                  value={hangul}
                  onChange={(e) => setHangul(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="draft-format" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>Format</label>
                  <select id="draft-format" value={format} onChange={(e) => setFormat(e.target.value as ManhwaFormat)}>
                    <option value="manhwa">Manhwa (KR)</option>
                    <option value="manhua">Manhua (CN)</option>
                    <option value="manga">Manga (JP)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="draft-status" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>Publication Status</label>
                  <select id="draft-status" value={status} onChange={(e) => setStatus(e.target.value as ManhwaStatus)}>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="hiatus">Hiatus</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="draft-chapters" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                  Total Verified Chapters <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="draft-chapters"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={totalChapters}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTotalChapters(isNaN(val) ? 1 : Math.min(10000, Math.max(1, val)));
                    if (errors.totalChapters) setErrors(p => ({ ...p, totalChapters: '' }));
                  }}
                  style={{ borderColor: errors.totalChapters ? '#ef4444' : undefined }}
                  aria-invalid={!!errors.totalChapters}
                />
                <FieldError field="totalChapters" />
              </div>

              <div>
                <label htmlFor="draft-genres" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                  Genres (Comma Separated) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="draft-genres"
                  type="text"
                  placeholder="Action, Murim, Martial Arts"
                  value={genres}
                  onChange={(e) => { setGenres(e.target.value); if (errors.genres) setErrors(p => ({ ...p, genres: '' })); }}
                  maxLength={300}
                  style={{ borderColor: errors.genres ? '#ef4444' : undefined }}
                  aria-invalid={!!errors.genres}
                />
                <FieldError field="genres" />
              </div>

              <div>
                <label htmlFor="draft-synopsis" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                  Synopsis / Plot Summary <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  id="draft-synopsis"
                  rows={4}
                  placeholder="Detailed description of the prologue and story arc... (min. 20 characters)"
                  value={synopsis}
                  onChange={(e) => { setSynopsis(e.target.value); if (errors.synopsis) setErrors(p => ({ ...p, synopsis: '' })); }}
                  maxLength={3000}
                  style={{ borderColor: errors.synopsis ? '#ef4444' : undefined }}
                  aria-invalid={!!errors.synopsis}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  <FieldError field="synopsis" />
                  <div style={{ fontSize: '0.7rem', color: synopsis.length > 2800 ? '#f59e0b' : '#64748b', marginLeft: 'auto' }}>
                    {synopsis.length}/3000
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || submitCooldown > 0}
                style={{
                  marginTop: '0.5rem',
                  backgroundColor: '#8b5cf6',
                  borderColor: '#7c3aed',
                  opacity: isSubmitting || submitCooldown > 0 ? 0.6 : 1,
                  cursor: isSubmitting || submitCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="spin-animation" />
                    <span>Dispatching...</span>
                  </>
                ) : submitCooldown > 0 ? (
                  <span>Please wait ({submitCooldown}s)...</span>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Dispatch to Moderation Queue</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Existing Drafts Queue */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <FileText size={20} color="#60a5fa" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>Your Proposed Submissions</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {drafts.length === 0 && (
              <div className="surface-card" style={{ padding: '2rem', textAlign: 'center', color: '#828fa6', fontSize: '0.85rem' }}>
                No drafts submitted yet. Search MangaDex/AniList above or propose a new title.
              </div>
            )}
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="surface-card"
                style={{
                  padding: '1.25rem',
                  borderLeft:
                    draft.moderation_status === 'approved'
                      ? '3px solid #10b981'
                      : draft.moderation_status === 'rejected'
                      ? '3px solid #ef4444'
                      : '3px solid #f59e0b',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700 }}>{draft.title}</h4>
                    {draft.api_source && draft.api_source !== 'manual' && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: draft.api_source === 'mangadex' ? '#ea580c' : '#0284c7',
                          color: '#ffffff',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {draft.api_source}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor:
                        draft.moderation_status === 'approved'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : draft.moderation_status === 'rejected'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        draft.moderation_status === 'approved'
                          ? '#34d399'
                          : draft.moderation_status === 'rejected'
                          ? '#f87171'
                          : '#fbbf24',
                    }}
                  >
                    {draft.moderation_status}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#828fa6', marginBottom: '0.6rem' }}>
                  {draft.hangul && `${draft.hangul} • `}
                  {draft.format.toUpperCase()} • Ch. {draft.total_chapters} • Submitted on{' '}
                  {new Date(draft.submission_date).toLocaleDateString()}
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5' }}>{draft.synopsis}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
