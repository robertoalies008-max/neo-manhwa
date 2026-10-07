// Direct implementation of specification.MD Domain Data Models

export type UserRole = 'guest' | 'user' | 'contributor' | 'moderator' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  strike_count: number;
  mute_expires_at: string | null;
  is_banned: boolean;
  ban_expires_at?: string | null;
  deletion_requested?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ManhwaFormat = 'manhwa' | 'manhua' | 'manga';
export type ManhwaStatus = 'ongoing' | 'completed' | 'hiatus';

export interface Manhwa {
  id: string;
  title: string;
  alternative_titles: {
    hangul?: string;
    romanized?: string;
    english?: string[];
  };
  synopsis: string;
  authors: string[];
  artists: string[];
  cover_image_url: string;
  banner_image_url?: string;
  format: ManhwaFormat;
  status: ManhwaStatus;
  genres: string[];
  tropes: string[];
  release_year: number;
  total_chapters: number;
  official_links: { platform: string; url: string }[];
  is_published: boolean;
  rating_avg: number;
  rating_count: number;
  is_new_this_week?: boolean;
  weekly_drop_day?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type LibraryStatus = 'reading' | 'plan_to_read' | 'completed' | 'on_hold' | 'dropped';

export interface UserLibraryEntry {
  id: string;
  user_id: string;
  manhwa_id: string;
  status: LibraryStatus;
  current_chapter: number;
  score: number | null; // 1 to 5 integer
  is_favorite: boolean;
  updated_at: string;
}

export interface Comment {
  id: string;
  manhwa_id: string;
  user_id: string;
  username: string;
  user_avatar?: string;
  user_role: UserRole;
  parent_id: string | null; // Nullable for root comment, ID for 1-level reply
  content: string;
  is_spoiler: boolean;
  upvotes: number;
  downvotes: number;
  user_vote?: 'up' | 'down' | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ReportTargetType = 'comment' | 'user' | 'manhwa';
export type ReportReason = 'spam' | 'harassment' | 'spoilers' | 'incorrect_data' | 'other';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: ReportTargetType;
  target_id: string;
  target_preview: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target_entity: string;
  target_id: string;
  changes: Record<string, { old: any; new: any }>;
  ip_address: string;
  timestamp: string;
}

export interface ContributorDraft {
  id: string;
  contributor_id: string;
  contributor_name: string;
  title: string;
  hangul: string;
  format: ManhwaFormat;
  status: ManhwaStatus;
  synopsis: string;
  genres: string[];
  total_chapters: number;
  submission_date: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  cover_image_url?: string;
  authors?: string[];
  artists?: string[];
  release_year?: number;
  api_source?: 'mangadex' | 'anilist' | 'manual';
  api_id?: string;
}

