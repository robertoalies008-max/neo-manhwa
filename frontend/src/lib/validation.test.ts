import { describe, it, expect } from 'vitest';
import { 
  validateTitle, 
  validateSynopsis,
  validatePassword, 
  hasMinimumRole, 
  canContribute,
  detectSqlInjection
} from './validation';

describe('Validation Library', () => {
  describe('validateTitle', () => {
    it('should reject empty titles', () => {
      const result = validateTitle('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Title is required.');
    });

    it('should reject short titles', () => {
      const result = validateTitle('A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Title must be at least 2 characters.');
    });

    it('should accept valid titles', () => {
      const result = validateTitle('Solo Leveling');
      expect(result.valid).toBe(true);
    });

    it('should reject SQL injection in title', () => {
      const result = validateTitle("Solo Leveling'; DROP TABLE manhwa; --");
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SQL commands detected');
    });
  });

  describe('validateSynopsis (Anti-Spam & SQLi Edge Cases)', () => {
    it('should reject synopsis shorter than 20 characters', () => {
      const result = validateSynopsis('Too short');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Synopsis must be at least 20 characters.');
    });

    it('should reject synopsis exceeding 3000 characters', () => {
      const longText = 'A'.repeat(3001);
      const result = validateSynopsis(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should accept legitimate synopsis with markdown dashes (--- Links:)', () => {
      const realSynopsisWithDashes = 
        '10 years ago, after "the Gate" that connected the real world with the monster world opened. ' +
        'Having no skills whatsoever to display, I barely earned the required money. ' +
        '--- Links: - Official English Translation | 15227640605485101) | - Alternate Official Raw - Kakao Webtoon';
      
      const sqliCheck = detectSqlInjection(realSynopsisWithDashes);
      expect(sqliCheck.isSuspicious).toBe(false);

      const result = validateSynopsis(realSynopsisWithDashes);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect and reject genuine SQL comment truncation in synopsis', () => {
      const maliciousSynopsis = "10 years ago, after the Gate opened'; DROP TABLE manhwa; -- comment out rest";
      const result = validateSynopsis(maliciousSynopsis);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid format or SQL commands detected in synopsis.');
    });

    it('should detect union-based exfiltration in synopsis', () => {
      const attack = "Valid looking synopsis but UNION SELECT * FROM users --";
      const result = validateSynopsis(attack);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid format or SQL commands detected in synopsis.');
    });
  });

  describe('validatePassword', () => {
    it('should enforce complexity rules', () => {
      // Missing uppercase
      expect(validatePassword('lowercase1').valid).toBe(false);
      // Missing lowercase
      expect(validatePassword('UPPERCASE1').valid).toBe(false);
      // Missing number
      expect(validatePassword('NoNumberHere').valid).toBe(false);
      // Valid
      expect(validatePassword('StrongPass123').valid).toBe(true);
    });
  });

  describe('RBAC Authorization', () => {
    it('hasMinimumRole correctly evaluates hierarchy', () => {
      expect(hasMinimumRole('moderator', 'user')).toBe(true);
      expect(hasMinimumRole('user', 'moderator')).toBe(false);
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
    });

    it('canContribute correctly allows authorized roles', () => {
      expect(canContribute('guest')).toBe(false);
      expect(canContribute('user')).toBe(false);
      expect(canContribute('contributor')).toBe(true);
      expect(canContribute('moderator')).toBe(true);
      expect(canContribute('admin')).toBe(true);
    });
  });
});

