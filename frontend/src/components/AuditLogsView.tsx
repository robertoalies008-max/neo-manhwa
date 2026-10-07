import React from 'react';
import { Activity, Lock, ShieldCheck } from 'lucide-react';
import type { AuditLog, UserRole } from '../types';

interface AuditLogsViewProps {
  logs: AuditLog[];
  currentRole: UserRole;
  onOpenSecurityModal?: () => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, currentRole, onOpenSecurityModal }) => {
  if (currentRole !== 'moderator' && currentRole !== 'admin') {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <Lock size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
        <h3 style={{ color: '#ffffff', fontSize: '1.25rem' }}>Access Denied (403 Forbidden)</h3>
        <p style={{ color: '#828fa6', marginTop: '0.5rem' }}>
          According to the RBAC Privilege Matrix, Audit Logs are restricted to <strong>Moderator</strong> (Scoped) and <strong>Super Admin</strong> (Full Access).
        </p>
      </div>
    );
  }

  // Moderator sees scoped logs (e.g. comment flags, content edits); Super admin sees full logs (roles, system, bans)
  const visibleLogs = currentRole === 'moderator' 
    ? logs.filter(l => l.target_entity !== 'User' && l.action !== 'ROLE_PROMOTION')
    : logs;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'inline-block', marginBottom: '0.4rem' }}>
            <span className={`badge badge-role-${currentRole}`}>
              {currentRole === 'admin' ? 'Tamper-Evident Full Audit Ledger' : 'Moderator Scoped Activity Logs'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>System Audit & Security Logs</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Immutable record of administrative actions, content mutations, and privilege reconfigurations.
          </p>
        </div>

        {onOpenSecurityModal && (
          <button
            onClick={onOpenSecurityModal}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '0.65rem 1.1rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 0 20px rgba(37, 99, 235, 0.35)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ShieldCheck size={18} />
            <span>DevSecOps Security Console</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {visibleLogs.map(log => (
          <div 
            key={log.id} 
            className="surface-card"
            style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={14} color="#3b82f6" />
                <span style={{ fontWeight: 700, color: '#60a5fa' }}>{log.action}</span>
                <span style={{ color: '#64748b' }}>•</span>
                <span style={{ color: '#e2e8f0' }}>Target: {log.target_entity} ({log.target_id})</span>
              </div>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', color: '#94a3b8' }}>
              <div>
                Actor: <span style={{ color: '#ffffff', fontWeight: 600 }}>{log.actor_name}</span> ({log.actor_role})
              </div>
              <div>
                IP: <span style={{ color: '#828fa6' }}>{log.ip_address}</span>
              </div>
            </div>

            {/* Changes Diff */}
            <div style={{ marginTop: '0.6rem', backgroundColor: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', color: '#a5b4fc' }}>
              <code>Changes: {JSON.stringify(log.changes)}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
