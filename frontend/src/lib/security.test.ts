import { describe, it, expect } from 'vitest';
import { DevOpsSecurityScanner } from '../security/devopsSecurityEngine';
import {
  detectSqlInjection,
  sanitizeSqlFilter,
  sanitizeText,
  escapeHtml,
  validateComment,
  validateEmail,
  validatePassword,
  validateTitle,
  validateSynopsis,
  checkRateLimit,
  resetRateLimit,
  hasMinimumRole,
  canModerate,
  canContribute,
  isAuthenticated,
} from './validation';

describe('DevSecOps Security & Penetration Testing Suite', () => {
  // ─── 1. SQL Injection (SQLi) Defense Tests ─────────────────────────────────
  describe('SQL Injection (SQLi) Vector Audits', () => {
    it('detects and neutralizes boolean tautology auth bypass', () => {
      const payload = "' OR '1'='1";
      const sqliResult = detectSqlInjection(payload);
      expect(sqliResult.isSuspicious).toBe(true);
      expect(sqliResult.reason).toContain('Boolean Tautology');

      const commentResult = validateComment(payload);
      expect(commentResult.valid).toBe(false);
    });

    it('detects SQL comment sequence and statement truncation', () => {
      const payload = "admin' --";
      const sqliResult = detectSqlInjection(payload);
      expect(sqliResult.isSuspicious).toBe(true);
      expect(sqliResult.reason).toContain('SQL Comment');
    });

    it('detects stacked query execution (DROP TABLE / DELETE)', () => {
      const payload = 'Solo; DROP TABLE manhwa; --';
      const sqliResult = detectSqlInjection(payload);
      expect(sqliResult.isSuspicious).toBe(true);
      expect(sqliResult.reason).toContain('Stacked');

      const titleResult = validateTitle(payload);
      expect(titleResult.valid).toBe(false);
    });

    it('detects UNION-based data exfiltration attempts', () => {
      const payload = "' UNION SELECT null, username, password_hash FROM users --";
      const sqliResult = detectSqlInjection(payload);
      expect(sqliResult.isSuspicious).toBe(true);
      expect(sqliResult.reason).toContain('Union-Based');
    });

    it('detects time-based blind SQL injection (pg_sleep)', () => {
      const payload = "1'; SELECT pg_sleep(5); --";
      const sqliResult = detectSqlInjection(payload);
      expect(sqliResult.isSuspicious).toBe(true);
      expect(sqliResult.reason).toContain('Time-Based');
    });

    it('sanitizes PostgREST filter delimiter injection', () => {
      const dangerousFilter = 'title.ilike.%test%,role.eq.admin';
      const cleanFilter = sanitizeSqlFilter(dangerousFilter);
      expect(cleanFilter).not.toContain(',');
      expect(cleanFilter).not.toContain('%');
    });

    it('rejects SQL injection in email inputs', () => {
      const malformedEmail = "admin' OR 1=1--@neomanhwa.internal";
      const result = validateEmail(malformedEmail);
      expect(result.valid).toBe(false);
    });
  });

  // ─── 2. Cross-Site Scripting (XSS) Sanitization Tests ──────────────────────
  describe('Cross-Site Scripting (XSS) Vector Audits', () => {
    it('strips direct script tags completely', () => {
      const payload = "<script>alert('XSS')</script>";
      const sanitized = sanitizeText(payload);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('neutralizes recursive nested tags (CWE-182 evasion)', () => {
      // Single-pass regexes fail this test; multi-pass recursive sanitizer must pass
      const payload = '<<SCRIPT>alert(1);//<</SCRIPT>';
      const sanitized = sanitizeText(payload);
      expect(sanitized.toLowerCase()).not.toContain('script');
      expect(sanitized).not.toContain('<');
    });

    it('strips inline event handlers (onerror, onload, onclick)', () => {
      const payload = '<img src="x" onerror="alert(document.cookie)">';
      const sanitized = sanitizeText(payload);
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('<img');
    });

    it('neutralizes dangerous pseudo-protocols (javascript:, data:)', () => {
      const payload = "javascript:alert('pwned')";
      const sanitized = sanitizeText(payload);
      expect(sanitized.toLowerCase()).not.toContain('javascript:');
    });

    it('escapes HTML special characters for safe DOM insertion', () => {
      const raw = '<h1>Solo Leveling & "Omniscient"</h1>';
      const escaped = escapeHtml(raw);
      expect(escaped).toBe('&lt;h1&gt;Solo Leveling &amp; &quot;Omniscient&quot;&lt;&#x2F;h1&gt;');
    });
  });

  // ─── 3. RBAC & Broken Object-Level Authorization Tests ─────────────────────
  describe('RBAC Privilege Matrix & BOLA Audits', () => {
    it('enforces least-privilege for guest users', () => {
      expect(isAuthenticated('guest')).toBe(false);
      expect(canModerate('guest')).toBe(false);
      expect(canContribute('guest')).toBe(false);
      expect(hasMinimumRole('guest', 'user')).toBe(false);
    });

    it('restricts moderation actions to moderators and admins', () => {
      expect(canModerate('user')).toBe(false);
      expect(canModerate('contributor')).toBe(false);
      expect(canModerate('moderator')).toBe(true);
      expect(canModerate('admin')).toBe(true);
    });

    it('enforces that only admin possesses top rank', () => {
      expect(hasMinimumRole('moderator', 'admin')).toBe(false);
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
    });
  });

  // ─── 4. Rate Limiting & Anti-Brute-Force Tests ──────────────────────────────
  describe('Rate Limiting & Anti-Brute-Force Audits', () => {
    it('throttles rapid sequential requests over the limit', () => {
      const testKey = `test-key-${Date.now()}`;
      resetRateLimit(testKey);

      // Threshold: 3 requests per 60 seconds
      expect(checkRateLimit(testKey, 3, 60_000)).toBe(true);
      expect(checkRateLimit(testKey, 3, 60_000)).toBe(true);
      expect(checkRateLimit(testKey, 3, 60_000)).toBe(true);
      // 4th request must be rejected
      expect(checkRateLimit(testKey, 3, 60_000)).toBe(false);

      resetRateLimit(testKey);
    });
  });

  // ─── 5. Comprehensive DevOps Security Audit Scanner ────────────────────────
  describe('DevOps Security Scanner Automated Audit', () => {
    it('runs full scan and achieves an A+ security posture grade', async () => {
      const report = await DevOpsSecurityScanner.runFullAudit();
      expect(report.totalTests).toBeGreaterThanOrEqual(20);
      expect(report.failedCount).toBe(0);
      expect(report.securityScore).toBe(100);
      expect(report.letterGrade).toBe('A+');
      expect(report.cvssEstimatedScore).toBe(0.0);
    });
  });
});
