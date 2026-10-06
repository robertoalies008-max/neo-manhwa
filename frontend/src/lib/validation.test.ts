import { describe, it, expect } from 'vitest';
import { 
  validateTitle, 
  validatePassword, 
  hasMinimumRole, 
  canContribute 
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
