import React, { useState, useRef, useEffect } from 'react';
import { Search, Shield, LogIn, LogOut, UserPlus, BookOpen, Layers, ShieldAlert, Sparkles, X, Star } from 'lucide-react';
import type { UserRole, Manhwa } from '../types';

interface NavbarProps {
  activeTab: 'catalog' | 'library' | 'contributor' | 'moderation' | 'audit';
  currentRole: UserRole;
  currentUsername: string;
  searchQuery: string;
  favoritesCount: number;
  manhwaList: Manhwa[];
  onSelectTab: (tab: 'catalog' | 'library' | 'contributor' | 'moderation' | 'audit') => void;
  onSearchChange: (q: string) => void;
  onRoleSwitch: (role: UserRole) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onLogout: () => void;
  onSelectManhwa: (m: Manhwa) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  currentRole,
  currentUsername,
  searchQuery,
  favoritesCount,
  manhwaList,
  onSelectTab,
  onSearchChange,
  onRoleSwitch,
  onOpenAuth,
  onLogout,
  onSelectManhwa,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Quick matches for search dropdown preview
  const searchResults = searchQuery.trim()
    ? manhwaList.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.genres || []).some(g => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.alternative_titles?.hangul && m.alternative_titles.hangul.includes(searchQuery))
      ).slice(0, 5)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(9, 10, 13, 0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Top Banner: RBAC Persona Simulator Bar */}
        <div style={{
          backgroundColor: '#0c0e14',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.35rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: '#828fa6',
          flexWrap: 'wrap',
          gap: '0.4rem',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
            <Shield size={13} color="#3b82f6" />
            <span style={{ display: 'none' }}>RBAC:</span>
            <span className={`badge badge-role-${currentRole}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
              {currentRole}
            </span>
            <span style={{ color: '#525b6e' }}>|</span>
            <span style={{ color: '#cbd5e1' }}>{currentUsername}</span>
          </div>

          {/* Quick Persona Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Switch:</span>
            {(['guest', 'user', 'contributor', 'moderator', 'admin'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRoleSwitch(r)}
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 5px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: currentRole === r ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                  border: currentRole === r ? '1px solid #3b82f6' : '1px solid #1a202c',
                  color: currentRole === r ? '#ffffff' : '#828fa6',
                  cursor: 'pointer',
                  fontWeight: currentRole === r ? 700 : 500,
                  textTransform: 'capitalize'
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Main Navbar */}
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          {/* Brand */}
          <div 
            onClick={() => onSelectTab('catalog')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexShrink: 0 }}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 0 10px rgba(37, 99, 235, 0.4)'
            }}>
              N
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' }}>
              NEO<span style={{ color: '#3b82f6' }}>MANHWA</span>
            </span>
          </div>

          {/* Search Bar with Instant Results Dropdown */}
          <div ref={searchContainerRef} style={{ flex: 1, maxWidth: '440px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search title, genre, trope..."
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsSearchFocused(true);
              }}
              style={{
                paddingLeft: '2.2rem',
                paddingRight: searchQuery ? '2rem' : '0.8rem',
                backgroundColor: '#12151f',
                borderColor: isSearchFocused ? '#3b82f6' : 'var(--border-subtle)',
                height: '36px',
                fontSize: '0.82rem',
                borderRadius: 'var(--radius-sm)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setIsSearchFocused(false);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={14} />
              </button>
            )}

            {/* Instant Search Results Dropdown */}
            {isSearchFocused && searchQuery.trim() && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                backgroundColor: '#10131d',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1000,
                overflow: 'hidden',
                animation: 'scaleUp 0.15s ease-out'
              }}>
                <div style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                  Matching Titles ({searchResults.length})
                </div>

                {searchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#828fa6', fontSize: '0.8rem' }}>
                    No titles matching "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map(m => (
                    <div
                      key={m.id}
                      onClick={() => {
                        onSelectManhwa(m);
                        setIsSearchFocused(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #181d28',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <img
                        src={m.cover_image_url}
                        alt={m.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg';
                        }}
                        style={{ width: '34px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.72rem', color: '#828fa6' }}>
                          <span className={`badge badge-format-${m.format}`} style={{ fontSize: '0.62rem', padding: '0 4px' }}>
                            {m.format}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                            <Star size={10} fill="#f59e0b" />
                            {(m.rating_avg || 0).toFixed(1)}
                          </span>
                          <span>•</span>
                          <span>Ch. {m.total_chapters || '?'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav style={{ display: 'none', alignItems: 'center', gap: '0.35rem' }} className="desktop-nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onSelectTab('catalog')}
              style={{ color: activeTab === 'catalog' ? '#3b82f6' : 'var(--text-secondary)' }}
            >
              Catalog
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onSelectTab('library')}
              style={{ color: activeTab === 'library' ? '#3b82f6' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <span>Library</span>
              {favoritesCount > 0 && (
                <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '10px', fontWeight: 700 }}>
                  {favoritesCount}
                </span>
              )}
            </button>

            {(currentRole === 'contributor' || currentRole === 'moderator' || currentRole === 'admin') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSelectTab('contributor')}
                style={{ color: activeTab === 'contributor' ? '#8b5cf6' : 'var(--text-secondary)' }}
              >
                Contributor
              </button>
            )}

            {(currentRole === 'moderator' || currentRole === 'admin') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSelectTab('moderation')}
                style={{ color: activeTab === 'moderation' ? '#10b981' : 'var(--text-secondary)' }}
              >
                Mod Queue
              </button>
            )}

            {(currentRole === 'moderator' || currentRole === 'admin') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSelectTab('audit')}
                style={{ color: activeTab === 'audit' ? '#60a5fa' : 'var(--text-secondary)' }}
              >
                Audit
              </button>
            )}

            {(currentRole === 'moderator' || currentRole === 'admin') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSelectTab('users')}
                style={{ color: activeTab === 'users' ? '#f43f5e' : 'var(--text-secondary)' }}
              >
                Users
              </button>
            )}
          </nav>

          {/* Auth Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            {currentRole === 'guest' ? (
              <>
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenAuth('signin')}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </button>
                <button 
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenAuth('signup')}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <UserPlus size={13} />
                  <span>Join</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                title="Log out"
                style={{ color: '#ef4444', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Dedicated Mobile Bottom Bar for Phone Users */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className={`mobile-nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
        >
          <BookOpen size={18} />
          <span>Catalog</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('library')}
          className={`mobile-nav-btn ${activeTab === 'library' ? 'active' : ''}`}
        >
          <Layers size={18} />
          <span>Library ({favoritesCount})</span>
        </button>

        {(currentRole === 'contributor' || currentRole === 'moderator' || currentRole === 'admin') && (
          <button
            type="button"
            onClick={() => onSelectTab('contributor')}
            className={`mobile-nav-btn ${activeTab === 'contributor' ? 'active' : ''}`}
          >
            <Sparkles size={18} />
            <span>Propose</span>
          </button>
        )}

        {(currentRole === 'moderator' || currentRole === 'admin') && (
          <button
            type="button"
            onClick={() => onSelectTab('moderation')}
            className={`mobile-nav-btn ${activeTab === 'moderation' ? 'active' : ''}`}
          >
            <ShieldAlert size={18} />
            <span>Mod Queue</span>
          </button>
        )}

        {currentRole === 'admin' && (
          <button
            type="button"
            onClick={() => onSelectTab('audit')}
            className={`mobile-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <Shield size={18} />
            <span>Audit</span>
          </button>
        )}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
};
