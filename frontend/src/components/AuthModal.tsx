import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { UserRole } from '../types';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  checkRateLimit,
  getRateLimitCooldown,
} from '../lib/validation';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'signin' | 'signup';
  onClose: () => void;
  onSubmit: (mode: 'signin' | 'signup', selectedRole?: UserRole) => void;
}

/** Password strength indicator */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '#334155' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 4) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 5) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#10b981' };
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSubmit,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState('');

  // Reset form when mode or isOpen changes
  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setErrors({});
    setTouched({});
    setRateLimitError('');
    setShowPassword(false);
    setShowConfirm(false);
  }, [mode, isOpen]);

  if (!isOpen) return null;

  const passwordStrength = getPasswordStrength(password);

  // Validate a specific field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'email': {
        const r = validateEmail(value);
        return r.valid ? '' : (r.error || '');
      }
      case 'password': {
        const r = validatePassword(value);
        return r.valid ? '' : (r.error || '');
      }
      case 'username': {
        if (mode === 'signup') {
          const r = validateUsername(value);
          return r.valid ? '' : (r.error || '');
        }
        return '';
      }
      case 'confirmPassword': {
        if (mode === 'signup' && value !== password) {
          return 'Passwords do not match.';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const handleChange = (field: string, value: string) => {
    // Clear error when user starts typing if field was already touched
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: err }));
    }
  };

  const validateAll = (): boolean => {
    const fields: Record<string, string> = { email, password };
    if (mode === 'signup') {
      fields.username = username;
      fields.confirmPassword = confirmPassword;
    }

    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};

    for (const [field, value] of Object.entries(fields)) {
      newTouched[field] = true;
      const err = validateField(field, value);
      if (err) newErrors[field] = err;
    }

    setTouched(newTouched);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side rate limiting: max 5 attempts per 60 seconds
    const rateLimitKey = `auth-${mode}`;
    if (!checkRateLimit(rateLimitKey, 5, 60_000)) {
      const cooldown = getRateLimitCooldown(rateLimitKey, 60_000);
      setRateLimitError(`Too many attempts. Please wait ${cooldown}s before trying again.`);
      return;
    }
    setRateLimitError('');

    if (!validateAll()) return;

    setIsSubmitting(true);
    
    // Auto-detect role based on specific emails for demo purposes
    let finalRole: UserRole = 'user';
    if (mode === 'signin') {
      if (email === 'admin@neomanhwa.internal') finalRole = 'admin';
      else if (email === 'mod@neomanhwa.org') finalRole = 'moderator';
      else if (email === 'scribe@neomanhwa.org') finalRole = 'contributor';
    }
    
    setTimeout(() => {
      onSubmit(mode, finalRole);
      setIsSubmitting(false);
    }, 300);
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    paddingLeft: '2.4rem',
    paddingRight: ['password', 'confirmPassword'].includes(field) ? '2.8rem' : '0.8rem',
    borderColor: touched[field] && errors[field] ? '#ef4444' : (touched[field] && !errors[field] ? '#10b981' : undefined),
  });

  const FieldError = ({ field }: { field: string }) =>
    touched[field] && errors[field] ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', fontSize: '0.75rem', color: '#ef4444' }}>
        <AlertCircle size={12} />
        {errors[field]}
      </div>
    ) : null;

  const FieldSuccess = ({ field }: { field: string }) =>
    touched[field] && !errors[field] && (field === 'email' ? email : field === 'username' ? username : true) ? (
      <CheckCircle2 size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
    ) : null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'Sign In' : 'Create Account'}>
      <div
        className="modal-content"
        style={{ maxWidth: '460px', padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
              {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {mode === 'signin' ? 'Sign in to access your manhwa library & reviews' : 'Join thousands of manhwa and webtoon enthusiasts'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ borderRadius: '50%', padding: '0.4rem' }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>



        {/* Rate limit error banner */}
        {rateLimitError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem 0.8rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            color: '#f87171'
          }}>
            <AlertCircle size={14} />
            {rateLimitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Username (signup only) */}
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-username" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                Reader Alias <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  id="auth-username"
                  type="text"
                  placeholder="e.g. SungJinWoo"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); handleChange('username', e.target.value); }}
                  onBlur={(e) => handleBlur('username', e.target.value)}
                  style={inputStyle('username')}
                  autoComplete="username"
                  maxLength={30}
                  aria-describedby="username-error"
                  aria-invalid={!!(touched.username && errors.username)}
                />
                {!errors.username && <FieldSuccess field="username" />}
              </div>
              <FieldError field="username" />
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="auth-email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                id="auth-email"
                type="email"
                placeholder="reader@neomanhwa.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); handleChange('email', e.target.value); }}
                onBlur={(e) => handleBlur('email', e.target.value)}
                style={inputStyle('email')}
                autoComplete="email"
                maxLength={254}
                aria-describedby="email-error"
                aria-invalid={!!(touched.email && errors.email)}
              />
              {!errors.email && <FieldSuccess field="email" />}
            </div>
            <FieldError field="email" />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="auth-password" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
              Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 chars, upper, lower, number"
                value={password}
                onChange={(e) => { setPassword(e.target.value); handleChange('password', e.target.value); }}
                onBlur={(e) => handleBlur('password', e.target.value)}
                style={{ paddingLeft: '2.4rem', paddingRight: '2.8rem', borderColor: touched.password && errors.password ? '#ef4444' : undefined }}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                maxLength={128}
                aria-describedby="password-error password-hint"
                aria-invalid={!!(touched.password && errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <FieldError field="password" />

            {/* Password strength indicator (signup only) */}
            {mode === 'signup' && password && (
              <div style={{ marginTop: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '0.25rem' }}>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '3px',
                        borderRadius: '2px',
                        backgroundColor: i <= passwordStrength.score ? passwordStrength.color : '#1e2433',
                        transition: 'background-color 0.2s ease',
                      }}
                    />
                  ))}
                </div>
                {passwordStrength.label && (
                  <span style={{ fontSize: '0.72rem', color: passwordStrength.color, fontWeight: 600 }}>
                    {passwordStrength.label} password
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-confirm" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c3cbd9', marginBottom: '0.35rem' }}>
                Confirm Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  id="auth-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); handleChange('confirmPassword', e.target.value); }}
                  onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
                  style={{ paddingLeft: '2.4rem', paddingRight: '2.8rem', borderColor: touched.confirmPassword && errors.confirmPassword ? '#ef4444' : (touched.confirmPassword && confirmPassword === password && confirmPassword ? '#10b981' : undefined) }}
                  autoComplete="new-password"
                  maxLength={128}
                  aria-describedby="confirm-error"
                  aria-invalid={!!(touched.confirmPassword && errors.confirmPassword)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <FieldError field="confirmPassword" />
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Mode Toggle */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#828fa6' }}>
          {mode === 'signin' ? (
            <>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
