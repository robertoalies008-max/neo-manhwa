import React, { useState } from 'react';
import { Users, Shield, Trash2, Ban, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { User, UserRole } from '../types';

interface UserManagementProps {
  users: User[];
  currentRole: UserRole;
  currentUserId: string;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onBanUser: (userId: string, durationDays: number | null) => void;
  onDeleteUser: (userId: string) => void;
  onRequestDeletion: (userId: string) => void;
  onRemoveBan: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  currentRole,
  currentUserId,
  onUpdateRole,
  onBanUser,
  onDeleteUser,
  onRequestDeletion,
  onRemoveBan
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Access check: only moderators and admins can view the dashboard
  if (currentRole !== 'admin' && currentRole !== 'moderator') {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <Shield size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
        <h3 style={{ color: '#ffffff', fontSize: '1.25rem' }}>Access Denied (403 Forbidden)</h3>
        <p style={{ color: '#828fa6', marginTop: '0.5rem' }}>
          Only <strong>Moderators</strong> and <strong>Admins</strong> have access to User Management.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'inline-block', marginBottom: '0.4rem' }}>
            <span className={`badge badge-role-${currentRole}`}>
              {currentRole === 'admin' ? 'Super Admin Dashboard' : 'Moderator Dashboard'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>User Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage community members, assign roles, and handle disciplinary actions.
          </p>
        </div>

        <input 
          type="text" 
          placeholder="Search users..." 
          className="input-field" 
          style={{ width: '250px' }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="surface-card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-medium)', color: '#9aa4b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '1rem' }}>User</th>
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Strikes</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No users found matching "{searchTerm}".
                </td>
              </tr>
            ) : filteredUsers.map(user => {
              const isSelf = user.id === currentUserId;
              const isHigherOrEqualTier = 
                (currentRole === 'moderator' && (user.role === 'admin' || user.role === 'moderator')) ||
                (currentRole === 'admin' && user.role === 'admin');

              return (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.username}
                      {user.deletion_requested && (
                        <span title="Deletion Requested by Moderator" style={{ color: '#ef4444', display: 'flex' }}>
                          <AlertTriangle size={14} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.email}</div>
                  </td>
                  
                  {/* Role Assignment (Admin Only) */}
                  <td style={{ padding: '1rem' }}>
                    {currentRole === 'admin' && !isSelf ? (
                      <select 
                        value={user.role} 
                        onChange={(e) => onUpdateRole(user.id, e.target.value as UserRole)}
                        className="input-field"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      >
                        <option value="user">User</option>
                        <option value="contributor">Contributor</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`badge badge-role-${user.role}`}>{user.role}</span>
                    )}
                  </td>

                  {/* Status (Banned/Active) */}
                  <td style={{ padding: '1rem' }}>
                    {user.is_banned ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Ban size={14} /> 
                        Banned
                        {user.ban_expires_at && <span style={{ fontSize: '0.7rem', color: '#f87171' }}>(Temp)</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> Active
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '1rem', color: user.strike_count > 0 ? '#f59e0b' : '#64748b', fontWeight: user.strike_count > 0 ? 700 : 400 }}>
                    {user.strike_count}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {/* Banning (Mods and Admins) */}
                      {!isSelf && !isHigherOrEqualTier && !user.is_banned && (
                        <>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            title="Temporary Ban (7 Days)"
                            onClick={() => onBanUser(user.id, 7)}
                            style={{ padding: '0.3rem', color: '#f59e0b' }}
                          >
                            <Clock size={16} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            title="Permanent Ban"
                            onClick={() => onBanUser(user.id, null)}
                            style={{ padding: '0.3rem', color: '#ef4444' }}
                          >
                            <Ban size={16} />
                          </button>
                        </>
                      )}

                      {!isSelf && !isHigherOrEqualTier && user.is_banned && (
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => onRemoveBan(user.id)}
                          style={{ padding: '0.3rem 0.6rem', color: '#10b981' }}
                        >
                          Unban
                        </button>
                      )}

                      {/* Deletion (Admins can delete, Mods can request) */}
                      {!isSelf && !isHigherOrEqualTier && (
                        currentRole === 'admin' ? (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            title="Hard Delete Account"
                            onClick={() => {
                              if(window.confirm(`Permanently delete account for ${user.username}?`)) {
                                onDeleteUser(user.id);
                              }
                            }}
                            style={{ padding: '0.3rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          !user.deletion_requested && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              title="Request Account Deletion"
                              onClick={() => onRequestDeletion(user.id)}
                              style={{ padding: '0.3rem', color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
                            >
                              <AlertTriangle size={16} />
                            </button>
                          )
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
