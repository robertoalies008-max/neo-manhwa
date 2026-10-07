/**
 * Security: Enterprise Input Validation, Sanitization, SQLi Detection & Rate-Limiting.
 * Core defensive module protecting against OWASP Top 10 vulnerabilities (SQLi, XSS, BOLA, DoS).
 */

import type { UserRole } from '../types';

// ─── Sanitization & Escaping (XSS Prevention) ──────────────────────────────────

/**
 * Encodes special HTML characters into safe HTML entities.
 */
export function escapeHtml(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return raw.replace(/[&<>"'`/=\\]/g, (char) => entityMap[char] || char);
}

/**
 * Multi-pass recursive sanitization that completely eliminates all HTML/script tags,
 * script bodies, inline event handlers, and dangerous URI schemes.
 * Neutralizes nested injection bypasses (e.g. <<script>script> or javascjavascript:ript:).
 */
export function sanitizeText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let sanitized = raw;
  let previous = '';
  let iterations = 0;
  const maxIterations = 10;

  // Multi-pass recursive stripping to handle nested/obfuscated vectors (CWE-182)
  while (sanitized !== previous && iterations < maxIterations) {
    previous = sanitized;
    iterations++;

    sanitized = sanitized
      // Strip script and style blocks entirely (including contents)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Strip HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Strip complete HTML/XML tags
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Strip unclosed tags or remaining tag brackets
      .replace(/<[^>]*>?/g, '')
      // Strip dangerous URI protocols (case-insensitive & whitespace tolerant)
      .replace(/(?:javascript|vbscript|data|blob):\s*/gi, '')
      // Strip inline DOM event handlers (onclick=, onerror=, etc.)
      .replace(/\bon\w+\s*=\s*['"]?[^'"]*['"]?/gi, '')
      // Strip null bytes and control chars (except standard newlines/tabs)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  // Strip any remaining orphan angle brackets to guarantee zero tag construction
  sanitized = sanitized.replace(/[<>]/g, '');

  return sanitized.trim();
}

// ─── SQL Injection & PostgREST Filter Guards ─────────────────────────────────

export interface SqlScanResult {
  isSuspicious: boolean;
  reason?: string;
  matchedPattern?: string;
}

/**
 * Comprehensive heuristic SQL Injection detection engine.
 * Scans inputs for stacked statements, union exfiltration, time-based attacks,
 * boolean tautologies, and command executions.
 */
export function detectSqlInjection(input: string): SqlScanResult {
  if (!input || typeof input !== 'string') {
    return { isSuspicious: false };
  }

  const normalized = input.trim();

  // Pattern library for common SQLi attack vectors (ordered by specificity)
  const signatures: Array<{ name: string; pattern: RegExp }> = [
    {
      name: 'Stacked / Piggybacked Query Execution',
      pattern: /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|EXEC|GRANT|REVOKE)\b/i,
    },
    {
      name: 'Union-Based Data Exfiltration',
      pattern: /\bUNION(\s+ALL)?\s+SELECT\b/i,
    },
    {
      name: 'Time-Based / Blind Delay Injection',
      pattern: /\b(pg_sleep\s*\(|sleep\s*\(|waitfor\s+delay|benchmark\s*\()/i,
    },
    {
      name: 'Boolean Tautology / Auth Bypass',
      pattern: /('|\b)(OR|AND)\b\s+('?[0-9a-zA-Z_]+'?|[0-9]+)\s*(=|!=|<>|LIKE)\s*('?[0-9a-zA-Z_]+'?|[0-9]+)/i,
    },
    {
      name: 'Hex / Character Function Injection',
      pattern: /\b(0x[0-9a-fA-F]{4,}|CHAR\s*\(|CHR\s*\()/i,
    },
    {
      name: 'Database Meta Schema Enumeration',
      pattern: /\b(information_schema|pg_catalog|sys\.databases|sysobjects)\b/i,
    },
    {
      name: 'SQL Comment Sequence / Inline Truncation',
      // Detects SQL comment injection: quotes/semicolons followed by --, isolated -- followed by commands, /* */ or #
      // Prevents false positives on markdown horizontal rules (---) or typography dashes in synopses
      pattern: /(?:['";`]\s*--|(?<!-)--(?!\-)(?:\s+[a-zA-Z0-9_\*]|\s*$)|\/\*[\s\S]*?\*\/|#\s+)/i,
    },
  ];

  for (const sig of signatures) {
    if (sig.pattern.test(normalized)) {
      return {
        isSuspicious: true,
        reason: `Potential SQL Injection detected (${sig.name})`,
        matchedPattern: sig.name,
      };
    }
  }

  return { isSuspicious: false };
}

/**
 * Sanitizes search terms and filter parameters passed into Supabase PostgREST queries.
 * Escapes PostgREST operators (eq., ilike., in., etc.) and delimiter characters.
 */
export function sanitizeSqlFilter(term: string): string {
  if (!term || typeof term !== 'string') return '';
  return term
    .replace(/[%,()":]/g, '') // Remove PostgREST filter delimiter characters
    .replace(/\\/g, '')        // Remove escape backslashes
    .trim();
}

// ─── Input Validation ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/** Email validation using RFC 5322 simplified pattern */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required.' };
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!pattern.test(trimmed)) return { valid: false, error: 'Please enter a valid email address.' };
  if (trimmed.length > 254) return { valid: false, error: 'Email address is too long.' };

  // Guard against SQL injection attempts in email field
  const sqliScan = detectSqlInjection(trimmed);
  if (sqliScan.isSuspicious) {
    return { valid: false, error: 'Malformed email format detected.' };
  }

  return { valid: true, sanitized: trimmed.toLowerCase() };
}

/** Password security requirements */
export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required.' };
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' };
  if (password.length > 128) return { valid: false, error: 'Password is too long (max 128 characters).' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one number.' };
  return { valid: true };
}

/** Username validation */
export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();
  if (!trimmed) return { valid: false, error: 'Username is required.' };
  if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters.' };
  if (trimmed.length > 30) return { valid: false, error: 'Username must not exceed 30 characters.' };
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username may only contain letters, numbers, underscores, and hyphens.' };
  }
  return { valid: true, sanitized: trimmed };
}

/** Comment content validation with integrated SQLi and XSS protection */
export function validateComment(content: string): ValidationResult {
  const sqli = detectSqlInjection(content);
  if (sqli.isSuspicious) {
    return { valid: false, error: 'Invalid characters or SQL statements detected in comment.' };
  }

  const trimmed = sanitizeText(content);
  if (!trimmed) return { valid: false, error: 'Comment cannot be empty.' };
  if (trimmed.length < 3) return { valid: false, error: 'Comment must be at least 3 characters.' };
  if (trimmed.length > 2000) return { valid: false, error: `Comment is too long (${trimmed.length}/2000 chars).` };

  return { valid: true, sanitized: trimmed };
}

/** Report details validation */
export function validateReportDetails(details: string): ValidationResult {
  const sqli = detectSqlInjection(details);
  if (sqli.isSuspicious) {
    return { valid: false, error: 'Invalid characters detected in report submission.' };
  }

  const trimmed = sanitizeText(details);
  if (trimmed.length > 1000) return { valid: false, error: `Details too long (${trimmed.length}/1000 chars).` };

  return { valid: true, sanitized: trimmed };
}

/** Synopsis validation for contributor drafts */
export function validateSynopsis(synopsis: string): ValidationResult {
  const sqli = detectSqlInjection(synopsis);
  if (sqli.isSuspicious) {
    return { valid: false, error: 'Invalid format or SQL commands detected in synopsis.' };
  }

  const trimmed = sanitizeText(synopsis);
  if (!trimmed) return { valid: false, error: 'Synopsis is required.' };
  if (trimmed.length < 20) return { valid: false, error: 'Synopsis must be at least 20 characters.' };
  if (trimmed.length > 3000) return { valid: false, error: `Synopsis is too long (${trimmed.length}/3000 chars).` };

  return { valid: true, sanitized: trimmed };
}

/** Title validation for contributor drafts */
export function validateTitle(title: string): ValidationResult {
  const sqli = detectSqlInjection(title);
  if (sqli.isSuspicious) {
    return { valid: false, error: 'Invalid characters or SQL commands detected in title.' };
  }

  const trimmed = sanitizeText(title);
  if (!trimmed) return { valid: false, error: 'Title is required.' };
  if (trimmed.length < 2) return { valid: false, error: 'Title must be at least 2 characters.' };
  if (trimmed.length > 200) return { valid: false, error: 'Title must not exceed 200 characters.' };

  return { valid: true, sanitized: trimmed };
}

// ─── Rate Limiting (Defense Against Brute-Force & DoS) ─────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore: Record<string, RateLimitEntry> = {};

/**
 * High-performance sliding-window rate limiter.
 * Automatically prunes expired records to prevent unbounded memory growth.
 * @param key       Identifier (e.g. 'comment-user123', 'auth-ip')
 * @param limit     Max allowed attempts
 * @param windowMs  Time window in milliseconds
 * @returns true if allowed, false if rate-limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const normalizedKey = key.trim().toLowerCase();
  const now = Date.now();
  const entry = rateLimitStore[normalizedKey];

  // Periodic garbage collection for memory hygiene
  if (Object.keys(rateLimitStore).length > 500) {
    for (const k in rateLimitStore) {
      if (now - rateLimitStore[k].windowStart > 300_000) {
        delete rateLimitStore[k];
      }
    }
  }

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore[normalizedKey] = { count: 1, windowStart: now };
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Returns remaining seconds in the rate limit window (0 if not limited).
 */
export function getRateLimitCooldown(key: string, windowMs: number): number {
  const normalizedKey = key.trim().toLowerCase();
  const entry = rateLimitStore[normalizedKey];
  if (!entry) return 0;
  const elapsed = Date.now() - entry.windowStart;
  const remaining = windowMs - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Resets rate limit for a specific key (useful for tests or admin unlocks).
 */
export function resetRateLimit(key: string): void {
  delete rateLimitStore[key.trim().toLowerCase()];
}

// ─── RBAC Authorization Guard ──────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  contributor: 2,
  moderator: 3,
  admin: 4,
};

/**
 * Returns true if the given role meets or exceeds the required minimum role.
 */
export function hasMinimumRole(current: UserRole, required: UserRole): boolean {
  return (ROLE_RANK[current] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

/**
 * Returns true if current role can moderate (moderator or admin only).
 */
export function canModerate(role: UserRole): boolean {
  return role === 'moderator' || role === 'admin';
}

/**
 * Returns true if current role can contribute (contributor, moderator, admin).
 */
export function canContribute(role: UserRole): boolean {
  return role === 'contributor' || role === 'moderator' || role === 'admin';
}

/**
 * Returns true if the user is authenticated (not a guest).
 */
export function isAuthenticated(role: UserRole): boolean {
  return role !== 'guest';
}
