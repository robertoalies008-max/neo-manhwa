import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserManagement } from './UserManagement';
import type { User, UserRole } from '../types';

const mockUsers: User[] = [
  {
    id: '1',
    username: 'TestUser',
    email: 'test@example.com',
    role: 'user',
    strike_count: 0,
    mute_expires_at: null,
    is_banned: false,
    created_at: '',
    updated_at: '',
    deleted_at: null
  }
];

describe('UserManagement Component', () => {
  const defaultProps = {
    users: mockUsers,
    currentUserId: 'admin-id',
    onUpdateRole: () => {},
    onBanUser: () => {},
    onDeleteUser: () => {},
    onRequestDeletion: () => {},
    onRemoveBan: () => {},
  };

  it('should deny access to guests, users, and contributors', () => {
    const roles: UserRole[] = ['guest', 'user', 'contributor'];
    
    roles.forEach(role => {
      const { unmount } = render(<UserManagement {...defaultProps} currentRole={role} />);
      expect(screen.getByText('Access Denied (403 Forbidden)')).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
      unmount();
    });
  });

  it('should grant access to moderators and admins', () => {
    const roles: UserRole[] = ['moderator', 'admin'];
    
    roles.forEach(role => {
      const { unmount } = render(<UserManagement {...defaultProps} currentRole={role} />);
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('TestUser')).toBeInTheDocument();
      expect(screen.queryByText('Access Denied (403 Forbidden)')).not.toBeInTheDocument();
      unmount();
    });
  });

  it('should not show the role dropdown for moderators', () => {
    render(<UserManagement {...defaultProps} currentRole="moderator" />);
    // Moderator shouldn't see a combobox to change roles
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should show the role dropdown for admins to manage other users', () => {
    render(<UserManagement {...defaultProps} currentRole="admin" />);
    // Admin should see a combobox to change test user's role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
