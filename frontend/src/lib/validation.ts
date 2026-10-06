/**
 * Security: Input validation, sanitization & rate-limiting utilities.
 * All user-facing inputs must pass through these guards before processing.
 */

// ─── Sanitization ────────────────────────────────────────────────────────────

/**
 * Strips all HTML/script tags and trims whitespace.
 * Prevents XSS in comment/form content.
 */
export function sanitizeText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/javascript:/gi, '')      // strip JS protocol
    .replace(/on\w+\s*=/gi, '')        // strip inline event handlers
    .trim();
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Email validation using RFC 5322 simplified pattern */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required.' };
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!pattern.test(trimmed)) return { valid: false, error: 'Please enter a valid email address.' };
  if (trimmed.length > 254) return { valid: false, error: 'Email address is too long.' };
  return { valid: true };
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
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return { valid: false, error: 'Username may only contain letters, numbers, underscores, and hyphens.' };
  return { valid: true };
}

/** Comment content validation */
export function validateComment(content: string): ValidationResult {
  const trimmed = content.trim();
  if (!trimmed) return { valid: false, error: 'Comment cannot be empty.' };
  if (trimmed.length < 3) return { valid: false, error: 'Comment must be at least 3 characters.' };
  if (trimmed.length > 2000) return { valid: false, error: `Comment is too long (${trimmed.length}/2000 chars).` };
  return { valid: true };
}

/** Report details validation */
export function validateReportDetails(details: string): ValidationResult {
  const trimmed = details.trim();
  if (trimmed.length > 1000) return { valid: false, error: `Details too long (${trimmed.length}/1000 chars).` };
  return { valid: true };
}

/** Synopsis validation for contributor drafts */
export function validateSynopsis(synopsis: string): ValidationResult {
  const trimmed = synopsis.trim();
  if (!trimmed) return { valid: false, error: 'Synopsis is required.' };
  if (trimmed.length < 20) return { valid: false, error: 'Synopsis must be at least 20 characters.' };
  if (trimmed.length > 3000) return { valid: false, error: `Synopsis is too long (${trimmed.length}/3000 chars).` };
  return { valid: true };
}

/** Title validation for contributor drafts */
export function validateTitle(title: string): ValidationResult {
  const trimmed = title.trim();
  if (!trimmed) return { valid: false, error: 'Title is required.' };
  if (trimmed.length < 2) return { valid: false, error: 'Title must be at least 2 characters.' };
  if (trimmed.length > 200) return { valid: false, error: 'Title must not exceed 200 characters.' };
  return { valid: true };
}

// ─── Rate Limiting (Client-side best-effort) ──────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore: Record<string, RateLimitEntry> = {};

/**
 * Simple in-memory rate limiter.
 * @param key       Identifier (e.g. 'comment', 'report')
 * @param limit     Max allowed attempts
 * @param windowMs  Time window in milliseconds
 * @returns true if allowed, false if rate-limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore[key];

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore[key] = { count: 1, windowStart: now };
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
  const entry = rateLimitStore[key];
  if (!entry) return 0;
  const elapsed = Date.now() - entry.windowStart;
  const remaining = windowMs - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ─── RBAC Authorization Guard ──────────────────────────────────────────────────

import type { UserRole } from '../types';

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
  return ROLE_RANK[current] >= ROLE_RANK[required];
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
