# Manhwa Platform Specification & System Architecture (SPECIFICATION.md)

---

## 1. System Architecture & Software Engineering Standards

*   **Version Control & Branching Strategy:** Enforce Git Flow across all repositories. Direct pushes to `main` and `develop` branches are prohibited via branch protection rules. All development must take place on dedicated branches (`feature/`, `hotfix/`, `refactor/`), adhere to Conventional Commits formatting (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`), and require at least one approved peer code review prior to merge.
*   **Testing Discipline:** Test-Driven Development (TDD) principles apply to all business logic. Front-end components and utilities require unit and integration testing via Vitest and React Testing Library; end-to-end critical user journeys (authentication flows, review submissions, library chapter increments) require Playwright or Cypress automation. A minimum code coverage threshold of 80% is enforced in CI pipelines.
*   **Continuous Integration & Continuous Deployment (CI/CD):** Every pull request automatically triggers headless workflows (e.g., GitHub Actions) to run linters, type checks, unit tests, and bundle analyzers. Builds must pass without errors or warnings before merge eligibility.
*   **API Design & Architecture:** All internal and external endpoints adhere to RESTful conventions under an immutable URL versioning schema (e.g., `/api/v1/`). Payloads must return standardized JSON contracts with consistent envelopes:
    ```json
    {
      "success": true,
      "data": {},
      "pagination": { "page": 1, "limit": 20, "total": 312 },
      "error": null
    }
    ```
*   **Type Safety:** Strictly enforce TypeScript across all application code, maintaining synchronized data interfaces across API payloads, state management, and component props to eliminate runtime type errors.
*   **Asset Performance:** Images must be served through an external Content Delivery Network (CDN) utilizing next-gen formats (`.webp`, `.avif`) with explicit `width`, `height`, and `loading="lazy"` attributes to prevent cumulative layout shift (CLS).

---

## 2. Role-Based Access Control (RBAC) & User Hierarchy

The platform defines five distinct security roles with non-overlapping privilege boundaries:



+---------------------------------------------------------------+
|                         Super Admin                           |
|       (Platform Settings, Full Database Control, Audits)      |
+---------------------------------------------------------------+
|
+---------------------------------------------------------------+
|                          Moderator                            |
|       (Content Moderation, Report Resolution, User Bans)      |
+---------------------------------------------------------------+
|
+---------------------------------------------------------------+
|                         Contributor                           |
|   (Drafting/Proposing Manhwa Metadata, Alt Titles, Chapters)   |
+---------------------------------------------------------------+
|
+---------------------------------------------------------------+
|                      Authenticated User                       |
|   (Tracking, Rating, Reviewing, Lists, Commenting, Reporting) |
+---------------------------------------------------------------+
|
+---------------------------------------------------------------+
|                            Guest                              |
|           (Public Browsing, Search, Reading Reviews)          |
+---------------------------------------------------------------+


*   **Guest:** Public unauthenticated visitor. Granted read-only access to browse titles, view aggregated ratings, read user comments, execute search queries, and view public recommendations.
*   **Authenticated User:** Registered account holder. Inherits Guest permissions plus authorization to create and manage personal reading lists, track chapter progress, rate titles, publish comments and 1-level replies, toggle spoiler tags, edit/delete their own comments, and report violating content.
*   **Contributor:** Vetted community tier. Inherits Authenticated User permissions plus authorization to propose new manhwa entries, append alternative titles (Hangul, Romanized), and update chapter release numbers. Submissions enter a moderation queue.
*   **Moderator:** Platform safety operator. Inherits Contributor permissions plus authorization to inspect flagged reports, approve/reject Contributor drafts, edit or soft-delete violating comments, and issue temporary user mutes.
*   **Super Admin:** System owner. Unrestricted CRUD permissions across all system entities, authority to assign or revoke user roles, execute permanent account bans, review tamper-evident audit logs, and configure global platform settings.

### Privilege Matrix

| Entity | Role | Create | Read | Update | Delete |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Manhwa** | Guest | Denied | Public records only | Denied | Denied |
| | User | Denied | Public records only | Denied | Denied |
| | Contributor | Propose new draft | Public records only | Propose edits | Denied |
| | Moderator | Propose / Approve | Full records | Approve / Edit | Soft-delete only |
| | Super Admin | Full access | Full access | Full access | Soft / Hard-delete |
| **Comments** | Guest | Denied | Visible comments | Denied | Denied |
| | User | Authored records | Visible comments | Own comments only | Own comments (soft) |
| | Moderator | Authored records | All comments | Hide any / Edit own | Soft-delete any |
| | Super Admin | Authored records | All comments | Hide any / Edit own | Hard-delete any |
| **Ratings** | Guest | Denied | Aggregated scores | Denied | Denied |
| | User | Own rating (1-5) | Aggregated scores | Own rating only | Remove own rating |
| | Moderator | Own rating (1-5) | Full logs | Own rating only | Soft-delete abusive votes |
| | Super Admin | Own rating (1-5) | Full logs | Own rating only | Purge bad-faith votes |
| **Reports** | User | Submit report | Denied | Denied | Denied |
| | Moderator | Denied | Full queue | Update report status | Dismiss report |
| | Super Admin | Denied | Full queue | Update report status | Dismiss report |
| **Audit Logs** | User / Contributor | Denied | Denied | Denied | Denied |
| | Moderator | System generated | Scoped logs | Denied | Denied |
| | Super Admin | System generated | Full logs | Denied | Denied |

---

## 3. Comprehensive Domain Data Models & Schemas

```typescript
// 1. User Entity
interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'guest' | 'user' | 'contributor' | 'moderator' | 'admin';
  strike_count: number;
  mute_expires_at: string | null;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 2. Manhwa Entity
interface Manhwa {
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
  format: 'manhwa' | 'manhua' | 'manga';
  status: 'ongoing' | 'completed' | 'hiatus';
  genres: string[];
  tropes: string[];
  release_year: number;
  total_chapters: number;
  official_links: { platform: string; url: string }[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 3. User Library & Tracking Entity
interface UserLibraryEntry {
  id: string;
  user_id: string;
  manhwa_id: string;
  status: 'reading' | 'plan_to_read' | 'completed' | 'on_hold' | 'dropped';
  current_chapter: number;
  score: number | null; // 1 to 5 integer
  is_favorite: boolean;
  updated_at: string;
}

// 4. Comment Entity
interface Comment {
  id: string;
  manhwa_id: string;
  user_id: string;
  parent_id: string | null; // Nullable for root comment, ID for 1-level reply
  content: string;
  is_spoiler: boolean;
  upvotes: number;
  downvotes: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 5. Moderation Report Entity
interface Report {
  id: string;
  reporter_id: string;
  target_type: 'comment' | 'user' | 'manhwa';
  target_id: string;
  reason: 'spam' | 'harassment' | 'spoilers' | 'incorrect_data' | 'other';
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

// 6. Audit Log Entity
interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_entity: string;
  target_id: string;
  changes: Record<string, { old: any; new: any }>;
  ip_address: string;
  timestamp: string;
}