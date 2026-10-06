import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Send, AlertCircle } from 'lucide-react';
import type { ReportReason, ReportTargetType } from '../types';
import {
  validateReportDetails,
  sanitizeText,
  checkRateLimit,
  getRateLimitCooldown,
} from '../lib/validation';

interface ReportModalProps {
  isOpen: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  reporterId: string;
  onClose: () => void;
  onSubmitReport: (reason: ReportReason, details: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  targetTitle,
  reporterId,
  onClose,
  onSubmitReport,
}) => {
  const [reason, setReason] = useState<ReportReason>('spoilers');
  const [details, setDetails] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [rateLimitError, setRateLimitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('spoilers');
      setDetails('');
      setDetailsError('');
      setRateLimitError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate details
    const detailsResult = validateReportDetails(details);
    if (!detailsResult.valid) {
      setDetailsError(detailsResult.error!);
      return;
    }
    setDetailsError('');

    // Rate limiting: max 5 reports per 15 minutes
    const rateLimitKey = `report-${reporterId}`;
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60_000)) {
      const cooldown = getRateLimitCooldown(rateLimitKey, 15 * 60_000);
      setRateLimitError(`Too many reports submitted. Please wait ${cooldown}s.`);
      return;
    }
    setRateLimitError('');

    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitReport(reason, sanitizeText(details.trim()));
      onClose();
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Submit Violation Report">
      <div
        className="modal-content"
        style={{ maxWidth: '480px', padding: '1.75rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-xs)', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>Submit Violation Report</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Target: {targetType.toUpperCase()} — <span style={{ color: '#93c5fd' }}>{targetTitle}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close dialog">
            <X size={18} />
          </button>
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
            <label htmlFor="report-reason" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.4rem' }}>
              Violation Category (Per Rulebook) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              <option value="spoilers">Unmarked Major Spoilers</option>
              <option value="harassment">Harassment / Toxicity / Hate Speech</option>
              <option value="spam">Commercial Spam / Self-Promotion</option>
              <option value="incorrect_data">Inaccurate Manhwa Metadata or Chapter Count</option>
              <option value="other">Other Community Guideline Infraction</option>
            </select>
          </div>

          <div>
            <label htmlFor="report-details" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.4rem' }}>
              Incident Details
            </label>
            <textarea
              id="report-details"
              rows={4}
              placeholder="Provide context for moderation queue review..."
              value={details}
              onChange={(e) => {
                setDetails(e.target.value);
                if (detailsError) setDetailsError('');
              }}
              maxLength={1000}
              style={{ borderColor: detailsError ? '#ef4444' : undefined }}
              aria-invalid={!!detailsError}
              aria-describedby="report-details-error"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {detailsError ? (
                <div id="report-details-error" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#ef4444' }}>
                  <AlertCircle size={12} /> {detailsError}
                </div>
              ) : <span />}
              <span style={{ fontSize: '0.7rem', color: details.length > 900 ? '#f59e0b' : '#64748b', textAlign: 'right' }}>
                {details.length}/1000
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              <Send size={15} />
              {isSubmitting ? 'Submitting...' : 'Submit to Mod Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
