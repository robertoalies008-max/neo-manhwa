import React, { useState } from 'react';
import { AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import type { Report, ContributorDraft, UserRole } from '../types';

interface ModeratorQueueProps {
  reports: Report[];
  drafts: ContributorDraft[];
  currentRole: UserRole;
  onUpdateReportStatus: (reportId: string, status: 'resolved' | 'dismissed') => void;
  onApproveDraft: (draftId: string) => void;
  onRejectDraft: (draftId: string) => void;
}

export const ModeratorQueue: React.FC<ModeratorQueueProps> = ({
  reports,
  drafts,
  currentRole,
  onUpdateReportStatus,
  onApproveDraft,
  onRejectDraft,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'drafts'>('reports');

  if (currentRole !== 'moderator' && currentRole !== 'admin') {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
        <h3 style={{ color: '#ffffff', fontSize: '1.25rem' }}>Access Denied (403 Forbidden)</h3>
        <p style={{ color: '#828fa6', marginTop: '0.5rem' }}>
          According to the RBAC Privilege Matrix, only <strong>Moderator</strong> and <strong>Super Admin</strong> roles possess privileges to read and process the moderation queue.
        </p>
      </div>
    );
  }

  const pendingReports = reports.filter(r => r.status === 'pending');
  const resolvedReports = reports.filter(r => r.status !== 'pending');
  const pendingDrafts = drafts.filter(d => d.moderation_status === 'pending');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-block', marginBottom: '0.4rem' }}>
            <span className={`badge badge-role-${currentRole}`}>
              {currentRole === 'admin' ? 'Super Admin Authorization' : 'Moderator Queue'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>Platform Safety & Content Verification</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Review flagged community reports and review proposals from vetted contributors.
          </p>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-elevated)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="btn btn-sm"
            style={{
              backgroundColor: activeTab === 'reports' ? '#2563eb' : 'transparent',
              color: activeTab === 'reports' ? '#ffffff' : '#828fa6',
              border: 'none'
            }}
          >
            <AlertTriangle size={14} />
            User Reports ({pendingReports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className="btn btn-sm"
            style={{
              backgroundColor: activeTab === 'drafts' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'drafts' ? '#ffffff' : '#828fa6',
              border: 'none'
            }}
          >
            <FileText size={14} />
            Draft Proposals ({pendingDrafts.length})
          </button>
        </div>
      </div>

      {activeTab === 'reports' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f3f4f6' }}>Pending Flagged Reports</h3>
          
          {pendingReports.length === 0 ? (
            <div className="surface-card" style={{ padding: '3rem', textAlign: 'center', color: '#828fa6' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem auto', color: '#10b981' }} />
              <h4 style={{ color: '#ffffff', fontSize: '1.05rem' }}>Queue is Clean</h4>
              <p style={{ fontSize: '0.85rem' }}>There are currently no outstanding community violation reports.</p>
            </div>
          ) : (
            pendingReports.map(report => (
              <div 
                key={report.id}
                className="surface-card"
                style={{ padding: '1.25rem', borderLeft: '3px solid #ef4444' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '3px', marginRight: '0.5rem' }}>
                      {report.reason.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#9aa4b8' }}>
                      Target: <strong>{report.target_type}</strong> ({report.target_preview})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Reported by {report.reporter_name} • {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <strong>Reporter Note:</strong> {report.details}
                </div>

                {/* Actions per matrix: Update report status / Dismiss report */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => onUpdateReportStatus(report.id, 'dismissed')}
                    className="btn btn-secondary btn-sm"
                  >
                    Dismiss Report
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateReportStatus(report.id, 'resolved')}
                    className="btn btn-primary btn-sm"
                  >
                    Resolve & Moderate
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Historical resolved reports */}
          {resolvedReports.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#828fa6', marginBottom: '0.75rem' }}>Recently Resolved Reports</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.7 }}>
                {resolvedReports.map(r => (
                  <div key={r.id} className="surface-elevated" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span>{r.target_type.toUpperCase()} reported for {r.reason}</span>
                    <span style={{ color: r.status === 'resolved' ? '#10b981' : '#828fa6', fontWeight: 600 }}>
                      Status: {r.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Contributor Drafts Queue */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f3f4f6' }}>Draft Title Proposals</h3>

          {pendingDrafts.length === 0 ? (
            <div className="surface-card" style={{ padding: '3rem', textAlign: 'center', color: '#828fa6' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem auto', color: '#8b5cf6' }} />
              <h4 style={{ color: '#ffffff', fontSize: '1.05rem' }}>No Submissions Awaiting Approval</h4>
              <p style={{ fontSize: '0.85rem' }}>All contributor proposals have been reviewed.</p>
            </div>
          ) : (
            pendingDrafts.map(draft => (
              <div 
                key={draft.id}
                className="surface-card"
                style={{ padding: '1.25rem', borderLeft: '3px solid #8b5cf6' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div>
                    <h4 style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>{draft.title}</h4>
                    <div style={{ fontSize: '0.8rem', color: '#9aa4b8', marginTop: '0.2rem' }}>
                      Native: {draft.hangul} • Format: {draft.format.toUpperCase()} • Verified Chapters: {draft.total_chapters}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Submitted by {draft.contributor_name}
                  </span>
                </div>

                <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', margin: '0.75rem 0' }}>
                  {draft.synopsis}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onRejectDraft(draft.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#ef4444' }}
                  >
                    Reject Proposal
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveDraft(draft.id)}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                  >
                    Approve & Publish to Catalog
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
