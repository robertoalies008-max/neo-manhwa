import React, { useState } from 'react';
import { PlusCircle, FileText, Send, AlertCircle } from 'lucide-react';
import type { ContributorDraft, ManhwaFormat, ManhwaStatus, UserRole } from '../types';
import {
  validateTitle,
  validateSynopsis,
  sanitizeText,
  checkRateLimit,
  getRateLimitCooldown,
  canContribute,
} from '../lib/validation';

interface ContributorHubProps {
  drafts: ContributorDraft[];
  currentRole: UserRole;
  currentUserId: string;
  currentUsername: string;
  onProposeDraft: (draft: Omit<ContributorDraft, 'id' | 'submission_date' | 'moderation_status'>) => void;
}

export const ContributorHub: React.FC<ContributorHubProps> = ({
  drafts,
  currentRole,
  currentUserId,
  currentUsername,
  onProposeDraft,
}) => {
  const [title, setTitle] = useState('');
  const [hangul, setHangul] = useState('');
  const [format, setFormat] = useState<ManhwaFormat>('manhwa');
  const [status, setStatus] = useState<ManhwaStatus>('ongoing');
  const [totalChapters, setTotalChapters] = useState(1);
  const [genres, setGenres] = useState('Action, Fantasy');
  const [synopsis, setSynopsis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimitError, setRateLimitError] = useState('');

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const titleResult = validateTitle(title);
    if (!titleResult.valid) newErrors.title = titleResult.error!;

    const synopsisResult = validateSynopsis(synopsis);
    if (!synopsisResult.valid) newErrors.synopsis = synopsisResult.error!;

    if (totalChapters < 1 || totalChapters > 10000 || !Number.isInteger(totalChapters)) {
      newErrors.totalChapters = 'Chapter count must be a whole number between 1 and 10,000.';
    }

    const genreList = genres.split(',').map(g => g.trim()).filter(Boolean);
    if (genreList.length === 0) newErrors.genres = 'At least one genre is required.';
    if (genreList.length > 15) newErrors.genres = 'Maximum 15 genres allowed.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limit: max 3 draft submissions per 10 minutes
    if (!checkRateLimit(`draft-submit-${currentUserId}`, 3, 10 * 60_000)) {
      const cooldown = getRateLimitCooldown(`draft-submit-${currentUserId}`, 10 * 60_000);
      setRateLimitError(`Too many submissions. Please wait ${cooldown}s before trying again.`);
      return;
    }
    setRateLimitError('');

    if (!validate()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onProposeDraft({
        contributor_id: currentUserId,
        contributor_name: currentUsername,
        title: sanitizeText(title.trim()),
        hangul: sanitizeText(hangul.trim()),
        format,
        status,
        total_chapters: Number(totalChapters),
        genres: genres.split(',').map(g => sanitizeText(g.trim())).filter(Boolean),
        synopsis: sanitizeText(synopsis.trim()),
      });
      setTitle('');
      setHangul('');
      setSynopsis('');
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
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
          <span className="badge badge-role-contributor">Contributor Tier Vetted</span>
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>Metadata & Catalog Proposal Hub</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Per the RBAC privilege matrix, contributors can propose new manhwa drafts and chapter revisions for moderator review.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Submission Form */}
        <div className="surface-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <PlusCircle size={20} color="#8b5cf6" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>Propose New Title Entry</h3>
          </div>

          {rateLimitError && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 0.8rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              color: '#f87171'
            }}>
              <AlertCircle size={14} />
              {rateLimitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              disabled={isSubmitting}
              style={{ marginTop: '0.5rem', backgroundColor: '#8b5cf6', borderColor: '#7c3aed', opacity: isSubmitting ? 0.7 : 1 }}
            >
              <Send size={15} />
              {isSubmitting ? 'Dispatching...' : 'Dispatch to Moderation Queue'}
            </button>
          </form>
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
                No drafts submitted yet. Use the form to propose a new title.
              </div>
            )}
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="surface-card"
                style={{ padding: '1.25rem', borderLeft: draft.moderation_status === 'approved' ? '3px solid #10b981' : draft.moderation_status === 'rejected' ? '3px solid #ef4444' : '3px solid #f59e0b' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700 }}>{draft.title}</h4>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: draft.moderation_status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : draft.moderation_status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: draft.moderation_status === 'approved' ? '#34d399' : draft.moderation_status === 'rejected' ? '#f87171' : '#fbbf24',
                  }}>
                    {draft.moderation_status}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#828fa6', marginBottom: '0.6rem' }}>
                  {draft.hangul && `${draft.hangul} • `}{draft.format.toUpperCase()} • Ch. {draft.total_chapters} • Submitted on {new Date(draft.submission_date).toLocaleDateString()}
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
