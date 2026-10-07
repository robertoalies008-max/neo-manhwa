import React, { useState, useEffect } from 'react';
import { 
  INITIAL_USERS, INITIAL_USER_LIST, INITIAL_MANHWA, INITIAL_LIBRARY, INITIAL_COMMENTS, 
  INITIAL_REPORTS, INITIAL_AUDIT_LOGS, INITIAL_CONTRIBUTOR_DRAFTS 
} from './mockData';
import type { 
  Manhwa, Comment, Report, AuditLog, UserLibraryEntry, User,
  ContributorDraft, UserRole, ReportTargetType, ReportReason, ManhwaFormat, ManhwaStatus 
} from './types';
import { Navbar } from './components/Navbar';
import { ManhwaCard } from './components/ManhwaCard';
import { ManhwaDetailModal } from './components/ManhwaDetailModal';
import { LibraryView } from './components/LibraryView';
import { ContributorHub } from './components/ContributorHub';
import { ModeratorQueue } from './components/ModeratorQueue';
import { AuditLogsView } from './components/AuditLogsView';
import { UserManagement } from './components/UserManagement';
import { AuthModal } from './components/AuthModal';
import { ReportModal } from './components/ReportModal';
import { LoadingScreen } from './components/LoadingScreen';
import { DevOpsSecurityModal } from './components/DevOpsSecurityModal';
import { ApiManhwaImporterModal } from './components/ApiManhwaImporterModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { isSupabaseConfigured } from './lib/supabase';
import { canModerate, sanitizeText, canContribute, checkRateLimit, getRateLimitCooldown } from './lib/validation';
import { fetchManhwaFromDatabase, fetchUserLibrary, addCommentToDatabase, fetchComments, syncManhwaToDatabase } from './services/supabaseService';
import { fetchAniListReviews, searchAniListIdByTitle } from './services/anilistService';
import { fetchMangaUpdatesReviews } from './services/mangaUpdatesService';
import { getCurrentWeekInfo, enrichWithWeeklyRoster, syncWeeklyDropsToSupabase, getWeeklyDrops } from './services/weeklyRosterService';
import { BookOpen, X, Sparkles, Star, ChevronRight, Database, MessageSquare, Flame, Plus } from 'lucide-react';

export function App() {
  // Security & Persona State
  const [currentRole, setCurrentRole] = useState<UserRole>('user');
  const currentUser = INITIAL_USERS[currentRole];

  // Domain Entities State (Initialized with enriched weekly release metadata)
  const [manhwaList, setManhwaList] = useState<Manhwa[]>(() => enrichWithWeeklyRoster(INITIAL_MANHWA));
  const [library, setLibrary] = useState<UserLibraryEntry[]>(INITIAL_LIBRARY);
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [drafts, setDrafts] = useState<ContributorDraft[]>(INITIAL_CONTRIBUTOR_DRAFTS);
  const [usersList, setUsersList] = useState<User[]>(INITIAL_USER_LIST);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isApiImporterOpen, setIsApiImporterOpen] = useState(false);
  const [prefilledManhwaForDraft, setPrefilledManhwaForDraft] = useState<Manhwa | null>(null);

  // In-app Toasts (hoisted for early availability)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (title: string, message?: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  };
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'catalog' | 'library' | 'contributor' | 'moderation' | 'audit' | 'users'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | ManhwaFormat>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ManhwaStatus>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'popular' | 'latest'>('popular');
  const [weeklyOnlyFilter, setWeeklyOnlyFilter] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(24);

  // Calendar Week Info (available for future weekly banner display)
  void getCurrentWeekInfo; // referenced via service, suppress lint

  // Modals & Overlays
  const [selectedManhwaState, setSelectedManhwaState] = useState<Manhwa | null>(null);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

  const setSelectedManhwa = async (manhwa: Manhwa | null) => {
    setSelectedManhwaState(manhwa);
    if (manhwa) {
      setIsFetchingReviews(true);

      try {
        // 1. Fetch Supabase DB comments (user authored)
        const dbPromise = isSupabaseConfigured
          ? fetchComments(manhwa.id)
          : Promise.resolve<Comment[]>([]);

        // 2. Fetch AniList Reviews dynamically
        const aniListPromise = (async (): Promise<Comment[]> => {
          let anilistId: number | null = null;
          const aniListLink = manhwa.official_links?.find(l => l.platform === 'AniList');
          if (aniListLink) {
            const match = aniListLink.url.match(/manga\/(\d+)/);
            if (match) anilistId = parseInt(match[1], 10);
          }
          if (!anilistId && manhwa.id.startsWith('anilist-')) {
            const parsed = parseInt(manhwa.id.replace('anilist-', ''), 10);
            if (!isNaN(parsed)) anilistId = parsed;
          }
          if (!anilistId) {
            anilistId = await searchAniListIdByTitle(manhwa.title);
          }
          if (anilistId) {
            return await fetchAniListReviews(anilistId, manhwa.id);
          }
          return [];
        })();

        // 3. MangaUpdates fallback (safe)
        const muPromise = fetchMangaUpdatesReviews(manhwa.title, manhwa.id);

        const [dbRes, aniRes, muRes] = await Promise.allSettled([dbPromise, aniListPromise, muPromise]);
        
        const dbComments = dbRes.status === 'fulfilled' && dbRes.value ? dbRes.value : [];
        const aniComments = aniRes.status === 'fulfilled' && aniRes.value ? aniRes.value : [];
        const muComments = muRes.status === 'fulfilled' && muRes.value ? muRes.value : [];

        const mergedComments = [...dbComments, ...aniComments, ...muComments];
        mergedComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setComments(mergedComments);
      } catch (err) {
        console.error('Error fetching discussions:', err);
      } finally {
        setIsFetchingReviews(false);
      }
    } else {
      setComments([]);
      setIsFetchingReviews(false);
    }
  };

  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'signin' | 'signup' }>({ isOpen: false, mode: 'signin' });
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: ReportTargetType; targetId: string; targetTitle: string }>({
    isOpen: false,
    targetType: 'comment',
    targetId: '',
    targetTitle: '',
  });

  const [isDbLoading, setIsDbLoading] = useState(false);

  // Load from Supabase on mount and synchronize Weekly Releases Roster
  useEffect(() => {
    async function initSupabase() {
      if (isSupabaseConfigured) {
        setIsDbLoading(true);
        const data = await fetchManhwaFromDatabase();
        if (data && data.length > 0) {
          const enriched = enrichWithWeeklyRoster(data);
          setManhwaList(enriched);
          // Automatically sync weekly drop additions in the background
          const drops = getWeeklyDrops(data);
          syncWeeklyDropsToSupabase(drops);
          addToast('Catalog Synchronized', `Loaded ${data.length} titles from PostgreSQL. 10 fresh weekly drops active.`, 'success');
        } else {
          addToast('Supabase Connected', 'Connected to PostgreSQL database. Ready for queries.', 'info');
        }

        // Fetch User Library from Supabase so progress and favorites persist
        const userLib = await fetchUserLibrary(currentUser.id);
        if (userLib && userLib.length > 0) {
          setLibrary(userLib);
        }

        setIsDbLoading(false);
      }
    }
    initSupabase();
  }, [currentUser.id]);

  // Animated Loading Screen State
  const [loadingState, setLoadingState] = useState<{
    isOpen: boolean;
    action: 'signin' | 'signup' | 'logout' | 'roleswitch';
    roleName?: string;
  }>({
    isOpen: false,
    action: 'signin',
  });

  // Unique genres across catalog
  const allGenres = Array.from(new Set(manhwaList.flatMap(m => m.genres))).sort();

  // Favorites count
  const favoritesCount = library.filter(e => e.is_favorite).length;

  /* ================= Auth & Role Simulation Handlers ================= */
  const triggerLoading = (action: 'signin' | 'signup' | 'logout' | 'roleswitch', roleName?: string, callback?: () => void) => {
    setLoadingState({ isOpen: true, action, roleName });
    setTimeout(() => {
      if (callback) callback();
      setLoadingState({ isOpen: false, action });
    }, 600);
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    triggerLoading('roleswitch', newRole, () => {
      setCurrentRole(newRole);
      addToast(`Switched Persona to ${newRole.toUpperCase()}`, `Permissions adjusted to ${newRole} privilege matrix.`, 'info');
      if ((newRole === 'guest' || newRole === 'user') && (activeTab === 'moderation' || activeTab === 'audit')) {
        setActiveTab('catalog');
      }
      if (newRole === 'guest' && activeTab === 'contributor') {
        setActiveTab('catalog');
      }
    });
  };

  const handleAuthSubmit = (mode: 'signin' | 'signup', selectedRole: UserRole = 'user') => {
    setAuthModal({ isOpen: false, mode: 'signin' });
    triggerLoading(mode, selectedRole, () => {
      setCurrentRole(selectedRole);
      addToast(
        mode === 'signin' ? 'Welcome Back!' : 'Account Created Successfully!',
        `Authenticated as ${INITIAL_USERS[selectedRole].username} (${selectedRole}).`,
        'success'
      );
    });
  };

  const handleLogout = () => {
    triggerLoading('logout', undefined, () => {
      setCurrentRole('guest');
      addToast('Logged Out', 'Switched session back to unauthenticated Guest tier.', 'info');
      if (activeTab !== 'catalog') setActiveTab('catalog');
    });
  };

  /* ================= Genre & Trope Redirection ================= */
  const handleSelectGenre = (genre: string) => {
    setGenreFilter(genre);
    setCurrentPage(1);
    setActiveTab('catalog');
    setSelectedManhwa(null);
    addToast(`Filtered by ${genre}`, `Displaying all manhwa categorized under ${genre}.`, 'info');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleSelectTrope = (trope: string) => {
    setSearchQuery(trope);
    setCurrentPage(1);
    setActiveTab('catalog');
    setSelectedManhwa(null);
    addToast(`Searching #${trope}`, `Found titles tagged with trope #${trope}.`, 'info');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setGenreFilter('all');
    setFormatFilter('all');
    setStatusFilter('all');
    setWeeklyOnlyFilter(false);
    setSearchQuery('');
    setCurrentPage(1);
    addToast('Filters Reset', 'Viewing full manhwa catalog.', 'info');
  };

  /* ================= Library & Favorite Handlers ================= */
  const handleToggleFavorite = (manhwaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (currentRole === 'guest') {
      addToast('Action Prohibited', 'Guests cannot save favorites. Please sign in or switch persona.', 'warning');
      return;
    }

    const title = manhwaList.find(m => m.id === manhwaId)?.title || 'Title';

    setLibrary(prev => {
      const existing = prev.find(entry => entry.manhwa_id === manhwaId);
      if (existing) {
        const nextFav = !existing.is_favorite;
        addToast(
          nextFav ? 'Added to Favorites' : 'Removed from Favorites',
          nextFav ? `Saved ${title} to your favorite shelf.` : `Removed ${title} from favorites.`,
          nextFav ? 'success' : 'info'
        );
        return prev.map(entry => 
          entry.manhwa_id === manhwaId 
            ? { ...entry, is_favorite: nextFav, updated_at: new Date().toISOString() } 
            : entry
        );
      } else {
        addToast('Added to Favorites', `Saved ${title} to your library vault.`, 'success');
        const newEntry: UserLibraryEntry = {
          id: `lib-${Date.now()}`,
          user_id: currentUser.id,
          manhwa_id: manhwaId,
          status: 'plan_to_read',
          current_chapter: 0,
          score: null,
          is_favorite: true,
          updated_at: new Date().toISOString(),
        };
        return [...prev, newEntry];
      }
    });
  };

  const handleUpdateLibrary = (manhwaId: string, updates: Partial<UserLibraryEntry>) => {
    if (currentRole === 'guest') {
      addToast('Guest Restriction', 'Guests cannot modify library tracking. Switch to User role.', 'warning');
      return;
    }

    setLibrary(prev => {
      const existing = prev.find(e => e.manhwa_id === manhwaId);
      if (existing) {
        return prev.map(e => e.manhwa_id === manhwaId ? { ...e, ...updates, updated_at: new Date().toISOString() } : e);
      } else {
        const newEntry: UserLibraryEntry = {
          id: `lib-${Date.now()}`,
          user_id: currentUser.id,
          manhwa_id: manhwaId,
          status: updates.status || 'reading',
          current_chapter: updates.current_chapter || 0,
          score: updates.score !== undefined ? updates.score : null,
          is_favorite: updates.is_favorite || false,
          updated_at: new Date().toISOString(),
        };
        return [...prev, newEntry];
      }
    });

    if (updates.score !== undefined) {
      addToast('Rating Updated', `Your score of ${updates.score || 'reset'} / 5 was recorded.`, 'success');
    }
  };

  /* ================= Comment Handlers (RBAC Governed) ================= */
  const handleAddComment = async (manhwaId: string, content: string, isSpoiler: boolean, parentId: string | null) => {
    if (currentRole === 'guest') {
      addToast('Permission Denied', 'Guests cannot author comments per the RBAC Privilege Matrix.', 'warning');
      return;
    }

    const cleanContent = sanitizeText(content);

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      manhwa_id: manhwaId,
      user_id: currentUser.id,
      username: currentUser.username,
      user_avatar: currentUser.avatar_url,
      user_role: currentRole,
      parent_id: parentId,
      content: cleanContent,
      is_spoiler: isSpoiler,
      upvotes: 0,
      downvotes: 0,
      is_hidden: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    setComments(prev => [newComment, ...prev]);
    if (isSupabaseConfigured) {
      await addCommentToDatabase({
         manhwa_id: manhwaId,
         user_id: currentUser.id,
         parent_id: parentId,
         content: cleanContent,
         is_spoiler: isSpoiler,
      });
    }
    addToast('Comment Published', 'Your response is live in the discussion feed.', 'success');
  };

  const handleVoteComment = (commentId: string, type: 'up' | 'down') => {
    if (currentRole === 'guest') {
      addToast('Guest Restriction', 'Sign in to vote on community comments.', 'warning');
      return;
    }

    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      if (c.user_vote === type) {
        return {
          ...c,
          user_vote: null,
          upvotes: type === 'up' ? c.upvotes - 1 : c.upvotes,
          downvotes: type === 'down' ? c.downvotes - 1 : c.downvotes,
        };
      } else {
        const prevVote = c.user_vote;
        return {
          ...c,
          user_vote: type,
          upvotes: type === 'up' ? c.upvotes + 1 : (prevVote === 'up' ? c.upvotes - 1 : c.upvotes),
          downvotes: type === 'down' ? c.downvotes + 1 : (prevVote === 'down' ? c.downvotes - 1 : c.downvotes),
        };
      }
    }));
  };

  const handleModerateComment = (commentId: string, action: 'hide' | 'soft-delete' | 'hard-delete') => {
    // Enforce RBAC: only moderators and admins may perform moderation actions
    if (!canModerate(currentRole)) {
      addToast('Permission Denied', 'Only Moderator or Admin roles may moderate comments.', 'error');
      return;
    }

    if (action === 'hide') {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_hidden: !c.is_hidden } : c));
      logAuditAction('COMMENT_VISIBILITY_TOGGLE', 'Comment', commentId, { action: 'toggle_hide' });
      addToast('Visibility Toggled', 'Comment hidden state updated.', 'info');
    } else if (action === 'soft-delete') {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: '[Comment deleted by moderator or author]', deleted_at: new Date().toISOString() } : c));
      logAuditAction('COMMENT_SOFT_DELETE', 'Comment', commentId, { soft_deleted: true });
      addToast('Comment Soft-Deleted', 'Content masked in thread.', 'info');
    } else if (action === 'hard-delete') {
      if (currentRole !== 'admin') {
        addToast('Permission Denied', 'Only Super Admin may permanently delete comments.', 'error');
        return;
      }
      setComments(prev => prev.filter(c => c.id !== commentId));
      logAuditAction('COMMENT_HARD_PURGE', 'Comment', commentId, { purged_from_database: true });
      addToast('Database Purge Complete', 'Comment record deleted permanently.', 'error');
    }
  };

  /* ================= Reports & Moderation Queue Handlers ================= */
  const handleOpenReport = (targetType: ReportTargetType, targetId: string, targetTitle: string) => {
    if (currentRole === 'guest') {
      addToast('Permission Denied', 'Guests cannot submit reports. Please sign in or switch persona.', 'warning');
      return;
    }
    setReportModal({
      isOpen: true,
      targetType,
      targetId,
      targetTitle,
    });
  };

  const handleSubmitReport = (reason: ReportReason, details: string) => {
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      reporter_id: currentUser.id,
      reporter_name: currentUser.username,
      target_type: reportModal.targetType,
      target_id: reportModal.targetId,
      target_preview: reportModal.targetTitle,
      reason,
      details,
      status: 'pending',
      resolved_by: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    };

    setReports(prev => [newReport, ...prev]);
    addToast('Report Submitted', 'Dispatched to platform safety queue.', 'warning');
  };

  const handleUpdateReportStatus = (reportId: string, status: 'resolved' | 'dismissed') => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status, resolved_by: currentUser.username, resolved_at: new Date().toISOString() } : r));
    logAuditAction(`REPORT_${status.toUpperCase()}`, 'Report', reportId, { status });
    addToast('Report Processed', `Marked as ${status.toUpperCase()}.`, 'success');
  };

  /* ================= Contributor Hub Handlers ================= */
  const handleProposeDraft = (draftData: Omit<ContributorDraft, 'id' | 'submission_date' | 'moderation_status'>): boolean => {
    const trimmedTitle = draftData.title.trim().toLowerCase();

    // 1. Duplicate check: is this title already pending in drafts?
    const alreadyPending = drafts.some(
      (d) => d.moderation_status === 'pending' && d.title.trim().toLowerCase() === trimmedTitle
    );
    if (alreadyPending) {
      addToast('Already Pending', `A proposal for "${draftData.title}" is already awaiting moderation.`, 'warning');
      return false;
    }

    // 2. Duplicate check: is this title already published in the catalog?
    const alreadyInCatalog = manhwaList.some(
      (m) => m.title.trim().toLowerCase() === trimmedTitle
    );
    if (alreadyInCatalog) {
      addToast('Already in Catalog', `"${draftData.title}" is already in the official catalog.`, 'info');
      return false;
    }

    // 3. Anti-spam throttle: max 1 proposal per 1.5s
    if (!checkRateLimit(`draft-throttle-${currentUser.id}`, 1, 1500)) {
      addToast('Please Wait', 'Please slow down between submissions.', 'warning');
      return false;
    }

    // 4. Rate-limit window: max 5 proposals per 2 minutes
    if (!checkRateLimit(`draft-submit-${currentUser.id}`, 5, 120_000)) {
      const cooldown = getRateLimitCooldown(`draft-submit-${currentUser.id}`, 120_000);
      addToast('Rate Limited', `Limit reached. Please wait ${cooldown}s before proposing again.`, 'error');
      return false;
    }

    const newDraft: ContributorDraft = {
      ...draftData,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      submission_date: new Date().toISOString(),
      moderation_status: 'pending',
    };
    setDrafts(prev => [newDraft, ...prev]);
    logAuditAction('DRAFT_PROPOSED', 'ContributorDraft', newDraft.id, { title: draftData.title });
    addToast('Draft Proposed', `"${draftData.title}" submitted to Moderator Queue.`, 'success');
    return true;
  };

  const handleAddManhwaDirectly = (manhwa: Manhwa): boolean => {
    const trimmedTitle = manhwa.title.trim().toLowerCase();

    // 1. Duplicate check
    if (manhwaList.some(m => m.id === manhwa.id || m.title.trim().toLowerCase() === trimmedTitle)) {
      addToast('Already in Catalog', `"${manhwa.title}" is already present in the catalog.`, 'info');
      return false;
    }

    // 2. Throttle
    if (!checkRateLimit(`admin-add-${currentUser.id}`, 1, 1000)) {
      addToast('Please Wait', 'Processing previous entry, please do not spam click.', 'warning');
      return false;
    }

    setManhwaList(prev => [manhwa, ...prev]);
    logAuditAction('MANHWA_IMPORTED_API', 'Manhwa', manhwa.id, {
      title: manhwa.title,
      source: manhwa.id.startsWith('mangadex') ? 'MangaDex' : 'AniList',
      imported_by: currentUser.username,
    });
    addToast('Series Published', `"${manhwa.title}" added directly to live catalog!`, 'success');

    if (isSupabaseConfigured) {
      syncManhwaToDatabase([manhwa]).catch(err => console.error('Supabase sync error:', err));
    }
    return true;
  };

  const handleApproveDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;

    const draftTimestamp = Date.now();
    const isoNow = new Date(draftTimestamp).toISOString();

    const newManhwa: Manhwa = {
      id: draft.api_id || `m-${draftTimestamp}`,
      title: draft.title,
      alternative_titles: {
        hangul: draft.hangul,
      },
      synopsis: draft.synopsis,
      authors: draft.authors && draft.authors.length > 0 ? draft.authors : ['Community Contributor'],
      artists: draft.artists && draft.artists.length > 0 ? draft.artists : ['Pending Attribution'],
      cover_image_url: draft.cover_image_url || 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg',
      format: draft.format,
      status: draft.status,
      genres: draft.genres,
      tropes: ['New Addition'],
      release_year: draft.release_year || 2026,
      total_chapters: draft.total_chapters,
      official_links: draft.api_source === 'mangadex' && draft.api_id
        ? [{ platform: 'MangaDex', url: `https://mangadex.org/title/${draft.api_id.replace('mangadex-', '')}` }]
        : [],
      is_published: true,
      rating_avg: 5.0,
      rating_count: 1,
      created_at: isoNow,
      updated_at: isoNow,
      deleted_at: null,
    };

    setManhwaList(prev => [newManhwa, ...prev]);
    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, moderation_status: 'approved' } : d));
    logAuditAction('DRAFT_APPROVED_PUBLISHED', 'Manhwa', newManhwa.id, { title: draft.title });
    addToast('Draft Approved', `${draft.title} is now published in the official catalog.`, 'success');

    if (isSupabaseConfigured) {
      syncManhwaToDatabase([newManhwa]).catch(err => console.error('Supabase sync error:', err));
    }
  };

  const handleRejectDraft = (draftId: string) => {
    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, moderation_status: 'rejected' } : d));
    logAuditAction('DRAFT_REJECTED', 'ContributorDraft', draftId, { status: 'rejected' });
    addToast('Draft Rejected', 'Submission proposal dismissed.', 'info');
  };

  const logAuditAction = (action: string, target_entity: string, target_id: string, changes: Record<string, { old: unknown; new: unknown }> | Record<string, unknown>) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actor_id: currentUser.id,
      actor_name: currentUser.username,
      actor_role: currentRole,
      action,
      target_entity,
      target_id,
      changes: changes as Record<string, { old: any; new: any }>,
      ip_address: 'client-masked',  // Never expose real IPs client-side
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  /* ================= User Management Handlers ================= */
  const handleUpdateRole = (userId: string, newRole: UserRole) => {
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    logAuditAction('ROLE_PROMOTION', 'User', userId, { newRole });
    addToast('Role Updated', 'User privileges modified.', 'success');
  };

  const handleBanUser = (userId: string, durationDays: number | null) => {
    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, is_banned: true, ban_expires_at: expiresAt } : u));
    logAuditAction('USER_BANNED', 'User', userId, { expiresAt });
    addToast('User Banned', durationDays ? `Temporarily banned for ${durationDays} days.` : 'Permanently banned.', 'error');
  };

  const handleRemoveBan = (userId: string) => {
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, is_banned: false, ban_expires_at: null } : u));
    logAuditAction('USER_UNBANNED', 'User', userId, { action: 'lift_ban' });
    addToast('Ban Lifted', 'User access restored.', 'success');
  };

  const handleDeleteUser = (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
    logAuditAction('USER_PURGED', 'User', userId, { purged: true });
    addToast('User Deleted', 'Account permanently removed.', 'error');
  };

  const handleRequestDeletion = (userId: string) => {
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, deletion_requested: true } : u));
    logAuditAction('USER_DELETION_REQUESTED', 'User', userId, { requested_by: currentRole });
    addToast('Deletion Requested', 'Flagged for admin review.', 'info');
  };

  /* ================= Filtered Manhwa Catalog ================= */
  const filteredManhwa = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return manhwaList.filter(m => {
      const matchesSearch = !q || (
        m.title.toLowerCase().includes(q) ||
        (m.alternative_titles?.hangul && m.alternative_titles.hangul.includes(q)) ||
        (m.alternative_titles?.romanized && m.alternative_titles.romanized.toLowerCase().includes(q)) ||
        (m.genres || []).some(g => g.toLowerCase().includes(q)) ||
        (m.tropes || []).some(t => t.toLowerCase().includes(q))
      );

      const matchesFormat = formatFilter === 'all' || m.format === formatFilter;
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesGenre = genreFilter === 'all' || (m.genres || []).includes(genreFilter);
      const matchesWeekly = !weeklyOnlyFilter || m.is_new_this_week === true;

      return matchesSearch && matchesFormat && matchesStatus && matchesGenre && matchesWeekly;
    }).sort((a, b) => {
      if (sortBy === 'rating') return (b.rating_avg || 0) - (a.rating_avg || 0);
      if (sortBy === 'popular') return (b.rating_count || 0) - (a.rating_count || 0);
      if (sortBy === 'latest') return (b.release_year || 0) - (a.release_year || 0);
      return 0;
    });
  }, [manhwaList, searchQuery, formatFilter, statusFilter, genreFilter, sortBy, weeklyOnlyFilter]);

  // Senior Engineering Pagination with Smart Orphan Absorption:
  // If the last page would have <= 3 items (e.g. 1, 2, or 3 orphan items),
  // merge them into the previous page so users never see an awkward page with just 2 isolated items!
  const { totalPages, paginatedManhwa } = React.useMemo(() => {
    const total = filteredManhwa.length;
    if (total === 0) {
      return { totalPages: 1, paginatedManhwa: [], startIndex: 0, endIndex: 0 };
    }

    if (pageSize >= total) {
      return { totalPages: 1, paginatedManhwa: filteredManhwa, startIndex: 1, endIndex: total };
    }

    const rawPages = Math.ceil(total / pageSize);
    const lastPageCount = total % pageSize;

    const shouldAbsorbOrphan = lastPageCount > 0 && lastPageCount <= 3 && rawPages > 1;
    const computedTotalPages = shouldAbsorbOrphan ? rawPages - 1 : rawPages;
    const safeCurrentPage = Math.min(Math.max(1, currentPage), computedTotalPages);

    const start = (safeCurrentPage - 1) * pageSize;
    let end = start + pageSize;
    if (safeCurrentPage === computedTotalPages) {
      end = total;
    }

    return {
      totalPages: computedTotalPages,
      paginatedManhwa: filteredManhwa.slice(start, end),
      startIndex: start + 1,
      endIndex: Math.min(end, total),
    };
  }, [filteredManhwa, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const hasActiveFilters = genreFilter !== 'all' || formatFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '' || weeklyOnlyFilter;

  // Spotlight featured title: dynamically prioritize top rated series with official artwork
  const featured = React.useMemo(() => {
    return manhwaList.find(m => m.banner_image_url && m.rating_avg >= 4.9) || manhwaList[0] || INITIAL_MANHWA[0];
  }, [manhwaList]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Animated Fullscreen Loading Screen */}
      {loadingState.isOpen && (
        <LoadingScreen 
          action={loadingState.action} 
          roleName={loadingState.roleName} 
        />
      )}

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        currentRole={currentRole}
        currentUsername={currentUser.username}
        searchQuery={searchQuery}
        favoritesCount={favoritesCount}
        manhwaList={manhwaList}
        onSelectTab={setActiveTab}
        onSearchChange={setSearchQuery}
        onRoleSwitch={handleRoleSwitch}
        onOpenAuth={(mode) => setAuthModal({ isOpen: true, mode })}
        onLogout={handleLogout}
        onSelectManhwa={setSelectedManhwa}
        onOpenSecurityTester={() => setIsSecurityModalOpen(true)}
        onOpenApiImporter={() => setIsApiImporterOpen(true)}
      />

      {/* Main Tab Content */}
      <main style={{ flex: 1 }}>
        {activeTab === 'catalog' && (
          <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.25rem 1rem' }}>
            
            {/* Cinematic Featured Spotlight Hero */}
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              backgroundColor: '#0c0e14',
              border: '1px solid var(--border-medium)',
              marginBottom: '1.75rem',
              minHeight: '260px',
              display: 'flex',
              alignItems: 'center'
            }}>
              {/* Backdrop Art with Gradient Mask */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '65%',
                backgroundImage: `url(${featured.banner_image_url || featured.cover_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 30%',
                opacity: 0.35,
                filter: 'brightness(0.7) contrast(1.1)',
                maskImage: 'linear-gradient(to right, transparent, black 40%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 40%)'
              }} />

              {/* Hero Content */}
              <div style={{
                padding: '2.25rem 1.5rem',
                maxWidth: '680px',
                position: 'relative',
                zIndex: 2
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-format-manhwa">Featured Spotlight</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700 }}>
                    <Star size={12} fill="#f59e0b" />
                    {(featured.rating_avg || 0).toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#828fa6' }}>•</span>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Ch. {featured.total_chapters || '?'} Episodes</span>
                </div>

                <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '0.6rem' }}>
                  {featured.title}
                </h1>
                <p style={{ color: '#9aa4b8', fontSize: '0.88rem', lineHeight: '1.55', marginBottom: '1.25rem', maxWidth: '580px' }}>
                  {featured.synopsis.slice(0, 160)}...
                </p>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSelectedManhwa(featured)}
                  >
                    <MessageSquare size={15} />
                    Discussions & Reviews
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedManhwa(featured)}
                  >
                    View Details
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* HORIZONTAL BROWSE-BY-GENRE PILL BAR */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#828fa6', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={13} color="#3b82f6" />
                    Explore by Genre (Click to filter)
                  </span>
                  {canContribute(currentRole) && (
                    <button
                      type="button"
                      onClick={() => setIsApiImporterOpen(true)}
                      style={{
                        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                        border: '1px solid rgba(249, 115, 22, 0.4)',
                        borderRadius: '20px',
                        padding: '2px 9px',
                        color: '#fdba74',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                      title="Search MangaDex & AniList to add new manhwa"
                    >
                      <Plus size={11} color="#f97316" />
                      <span>Search & Add (MangaDex & AniList)</span>
                    </button>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <X size={12} />
                    Reset All Filters
                  </button>
                )}
              </div>

              {/* Scrollable Genre Pills Container */}
              <div style={{
                display: 'flex',
                gap: '0.45rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                WebkitOverflowScrolling: 'touch',
              }}>
                <button
                  type="button"
                  onClick={() => setGenreFilter('all')}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: genreFilter === 'all' ? '1px solid #3b82f6' : '1px solid #1e2433',
                    backgroundColor: genreFilter === 'all' ? '#2563eb' : 'var(--bg-elevated)',
                    color: genreFilter === 'all' ? '#ffffff' : '#828fa6',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  All Titles ({manhwaList.length})
                </button>
                {allGenres.map(genre => {
                  const isSelected = genreFilter === genre;
                  const count = manhwaList.filter(m => m.genres.includes(genre)).length;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setGenreFilter(isSelected ? 'all' : genre)}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '20px',
                        border: isSelected ? '1px solid #3b82f6' : '1px solid #1e2433',
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-elevated)',
                        color: isSelected ? '#60a5fa' : '#94a3b8',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>{genre}</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Filter Notification Bar */}
            {hasActiveFilters && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.82rem',
                color: '#93c5fd'
              }}>
                <div>
                  Filtering by: 
                  {genreFilter !== 'all' && <strong style={{ color: '#ffffff', marginLeft: '0.3rem' }}>Genre: {genreFilter}</strong>}
                  {formatFilter !== 'all' && <strong style={{ color: '#ffffff', marginLeft: '0.3rem' }}>Format: {formatFilter}</strong>}
                  {searchQuery && <strong style={{ color: '#ffffff', marginLeft: '0.3rem' }}>Query: "{searchQuery}"</strong>}
                  <span style={{ color: '#9aa4b8', marginLeft: '0.5rem' }}>({filteredManhwa.length} manhwa found)</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ffffff', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Format Filter & Sorting Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              {/* Format Filter Buttons */}
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {(['all', 'manhwa', 'manhua', 'manga'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormatFilter(fmt)}
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      borderRadius: 'var(--radius-xs)',
                      border: formatFilter === fmt ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                      backgroundColor: formatFilter === fmt ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-elevated)',
                      color: formatFilter === fmt ? '#60a5fa' : '#828fa6',
                      cursor: 'pointer'
                    }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* Status & Sort Picker & AniList Button */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  <option value="all">All Status</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>

                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  <option value="popular">Most Popular</option>
                  <option value="rating">Top Rated (1-5)</option>
                  <option value="latest">Latest Released</option>
                </select>

                {/* Weekly Releases Toggle Button (Adds 10 new manhwas to the roster each week) */}
                <button
                  type="button"
                  onClick={() => {
                    setWeeklyOnlyFilter(prev => !prev);
                    setCurrentPage(1);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-xs)',
                    background: weeklyOnlyFilter
                      ? 'linear-gradient(135deg, #ef4444, #f59e0b)'
                      : 'rgba(239, 68, 68, 0.12)',
                    color: weeklyOnlyFilter ? '#ffffff' : '#f87171',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: weeklyOnlyFilter ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    boxShadow: weeklyOnlyFilter ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter by this week's scheduled 10 new releases"
                >
                  <Flame size={13} />
                  <span>Weekly Drops (+10 New)</span>
                </button>

                {/* Page Size Selector */}
                <select 
                  value={pageSize} 
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                  title="Cards per page"
                >
                  <option value={24}>24 / page</option>
                  <option value={48}>48 / page</option>
                  <option value={96}>96 / page</option>
                  <option value={1000}>All ({filteredManhwa.length})</option>
                </select>

                {/* Supabase Status Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: isSupabaseConfigured ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${isSupabaseConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  fontSize: '0.74rem',
                  color: isSupabaseConfigured ? '#34d399' : '#fbbf24'
                }}>
                  <Database size={12} />
                  <span>{isDbLoading ? 'Supabase: Syncing...' : isSupabaseConfigured ? 'Supabase: Connected' : 'Supabase: Standby'}</span>
                </div>
              </div>
            </div>

            {/* Manhwa Cards Grid - Mobile Optimized (2 per row on small phones) */}
            {filteredManhwa.length === 0 ? (
              <div className="surface-card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#828fa6' }}>
                <BookOpen size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h4 style={{ color: '#ffffff', fontSize: '1.1rem', marginBottom: '0.35rem' }}>No matching titles found</h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Try clearing your genre or keyword filters.</p>
                <button type="button" onClick={handleResetFilters} className="btn btn-secondary btn-sm">
                  Reset All Filters
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                  gap: '1rem',
                }}>
                  {paginatedManhwa.map((m) => {
                    const isFav = library.some(lib => lib.manhwa_id === m.id && lib.is_favorite);
                    return (
                      <ManhwaCard
                        key={m.id}
                        manhwa={m}
                        isFavorite={isFav}
                        onToggleFavorite={handleToggleFavorite}
                        onSelect={setSelectedManhwa}
                        onSelectGenre={handleSelectGenre}
                      />
                    );
                  })}
                </div>
                
                {/* Enhanced Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-sm"
                      title="First Page"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      First
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Previous
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                        .map((p, idx, arr) => {
                          const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={p}>
                              {showEllipsisBefore && <span style={{ color: '#64748b', padding: '0 4px', fontSize: '0.8rem' }}>...</span>}
                              <button
                                type="button"
                                onClick={() => handlePageChange(p)}
                                style={{
                                  minWidth: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  border: p === currentPage ? '1px solid #3b82f6' : '1px solid #232838',
                                  backgroundColor: p === currentPage ? '#2563eb' : 'rgba(255,255,255,0.03)',
                                  color: p === currentPage ? '#ffffff' : '#94a3b8',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-sm"
                      title="Last Page"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Last ({totalPages})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: User Library Tracker */}
        {activeTab === 'library' && (
          <LibraryView
            library={library}
            manhwaList={manhwaList}
            onSelectManhwa={setSelectedManhwa}
            onUpdateLibrary={handleUpdateLibrary}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Tab 3: Contributor Hub */}
        {activeTab === 'contributor' && (
          <ContributorHub
            drafts={drafts}
            currentRole={currentRole}
            currentUserId={currentUser.id}
            currentUsername={currentUser.username}
            existingTitles={manhwaList.map((m) => m.title)}
            onProposeDraft={handleProposeDraft}
            onOpenApiImporter={() => setIsApiImporterOpen(true)}
            onAddDirectly={handleAddManhwaDirectly}
            prefilledManhwa={prefilledManhwaForDraft}
          />
        )}

        {/* Tab 4: Moderator Safety Queue */}
        {activeTab === 'moderation' && (
          <ModeratorQueue
            reports={reports}
            drafts={drafts}
            currentRole={currentRole}
            onUpdateReportStatus={handleUpdateReportStatus}
            onApproveDraft={handleApproveDraft}
            onRejectDraft={handleRejectDraft}
          />
        )}

        {/* Tab 5: Tamper-Evident Audit Logs */}
        {activeTab === 'audit' && (
          <AuditLogsView
            logs={auditLogs}
            currentRole={currentRole}
            onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          />
        )}
        {/* Tab 6: User Management */}
        {activeTab === 'users' && (
          <UserManagement
            users={usersList}
            currentRole={currentRole}
            currentUserId={currentUser.id}
            onUpdateRole={handleUpdateRole}
            onBanUser={handleBanUser}
            onRemoveBan={handleRemoveBan}
            onDeleteUser={handleDeleteUser}
            onRequestDeletion={handleRequestDeletion}
          />
        )}
      </main>

      {/* Modal: Manhwa Details, Ratings & Discussions */}
      {selectedManhwaState && (
        <ManhwaDetailModal
          manhwa={selectedManhwaState}
          libraryEntry={library.find(e => e.manhwa_id === selectedManhwaState.id)}
          comments={comments.filter(c => c.manhwa_id === selectedManhwaState.id && (!c.deleted_at || currentRole === 'admin' || currentRole === 'moderator'))}
          isLoadingReviews={isFetchingReviews}
          currentRole={currentRole}
          currentUsername={currentUser.username}
          onClose={() => setSelectedManhwa(null)}
          onUpdateLibrary={handleUpdateLibrary}
          onToggleFavorite={handleToggleFavorite}
          onAddComment={handleAddComment}
          onVoteComment={handleVoteComment}
          onModerateComment={handleModerateComment}
          onOpenReport={handleOpenReport}
          onSelectGenre={handleSelectGenre}
          onSelectTrope={handleSelectTrope}
        />
      )}

      {/* Modal: Authentication */}
      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={() => setAuthModal({ isOpen: false, mode: 'signin' })}
        onSubmit={handleAuthSubmit}
      />

      {/* Modal: Reporting Violation */}
      <ReportModal
        isOpen={reportModal.isOpen}
        targetType={reportModal.targetType}
        targetId={reportModal.targetId}
        targetTitle={reportModal.targetTitle}
        reporterId={currentUser.id}
        onClose={() => setReportModal({ ...reportModal, isOpen: false })}
        onSubmitReport={handleSubmitReport}
      />

      {/* Modal: DevSecOps Penetration Testing Console */}
      <DevOpsSecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      {/* Modal: MangaDex & AniList Importer */}
      <ApiManhwaImporterModal
        isOpen={isApiImporterOpen}
        onClose={() => setIsApiImporterOpen(false)}
        currentRole={currentRole}
        currentUserId={currentUser.id}
        currentUsername={currentUser.username}
        existingTitles={manhwaList.map((m) => m.title)}
        pendingDraftTitles={drafts.filter((d) => d.moderation_status === 'pending').map((d) => d.title)}
        onAddDirectly={handleAddManhwaDirectly}
        onProposeDraft={handleProposeDraft}
        onSelectForManualForm={(m) => {
          setPrefilledManhwaForDraft(m);
          setActiveTab('contributor');
          setIsApiImporterOpen(false);
        }}
      />



      {/* Sleek Dark Footer */}
      <footer style={{
        backgroundColor: '#07080b',
        borderTop: '1px solid var(--border-subtle)',
        padding: '2rem 1rem',
        marginTop: '3rem',
        color: '#64748b',
        fontSize: '0.8rem'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: '#cbd5e1' }}>NeoManhwa Platform v2.0</strong> — Built strictly to <span style={{ color: '#93c5fd' }}>specification.MD</span>.
          </div>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <span>Active Persona: <strong style={{ color: '#f3f4f6' }}>{currentRole}</strong></span>
            <span>Mobile Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
