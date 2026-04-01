import DOMPurify from 'dompurify';

// Content Security Policy configuration
export const CSP_CONFIG = {
  directives: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://maps.googleapis.com',
      'https://api.supabase.co',
      'https://js.stripe.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net',
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'https://cdn.jsdelivr.net',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*',
      'https://maps.googleapis.com',
      'https://api.supabase.co',
    ],
    'connect-src': [
      "'self'",
      'https://api.supabase.co',
      'https://maps.googleapis.com',
      'https://nominatim.openstreetmap.org',
      'https://router.project-osrm.org',
      'https://api.openweathermap.org',
      'wss://api.supabase.co',
      'https://o4500000000000000.ingest.sentry.io',
    ],
    'frame-src': [
      "'self'",
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  },
};

// Generate CSP header string
export const generateCSPHeader = (): string => {
  const directives = Object.entries(CSP_CONFIG.directives)
    .map(([directive, values]) => {
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');

  return directives;
};

// Input sanitization functions
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove potential script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:[^"']*/gi, '');

  // Remove data: URLs that might contain scripts
  sanitized = sanitized.replace(/data:text\/html[^"']*/gi, '');

  return sanitized.trim();
};

// HTML sanitization
export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
};

// URL validation
export const isValidUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?/]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  return {
    isValid: score >= 4 && password.length >= 8,
    score,
    feedback,
  };
};

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);

    this.attempts.set(key, validAttempts);

    return validAttempts.length < this.maxAttempts;
  }

  recordAttempt(key: string): void {
    const attempts = this.attempts.get(key) || [];
    attempts.push(Date.now());
    this.attempts.set(key, attempts);
  }

  getRemainingAttempts(key: string): number {
    const attempts = this.attempts.get(key) || [];
    const validAttempts = attempts.filter(timestamp => Date.now() - timestamp < this.windowMs);
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// XSS protection for React components
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// CSRF token generation (client-side)
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Input validation schemas
export const validationRules = {
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens',
  },
  displayName: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[^\x00-\x1F\x7F]*$/u,
    message: 'Display name must be 1-50 characters and not contain control characters',
  },
  bio: {
    maxLength: 500,
    message: 'Bio must be less than 500 characters',
  },
  message: {
    maxLength: 2000,
    message: 'Message must be less than 2000 characters',
  },
  bubbleName: {
    minLength: 3,
    maxLength: 100,
    message: 'Bubble name must be 3-100 characters',
  },
  bubbleDescription: {
    minLength: 10,
    maxLength: 1000,
    message: 'Description must be 10-1000 characters',
  },
};

// Validate input against rules
export const validateInput = (value: string, rules: typeof validationRules.username): boolean => {
  if (rules.minLength && value.length < rules.minLength) return false;
  if (rules.maxLength && value.length > rules.maxLength) return false;
  if (rules.pattern && !rules.pattern.test(value)) return false;
  return true;
};

// Generate a single CSRF token per session.
// Note: Supabase handles its own auth; this header is a defence-in-depth
// measure for any custom endpoints. Generating a new token per-call would
// be meaningless because the server can't validate against a changing value.
const SESSION_CSRF_TOKEN = generateCSRFToken();

// Security headers for fetch requests
export const secureFetchOptions = (options: RequestInit = {}): RequestInit => {
  return {
    ...options,
    headers: {
      ...options.headers,
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': SESSION_CSRF_TOKEN,
    },
    credentials: 'same-origin',
  };
};

// Detect potential security threats
export const detectSecurityThreats = (input: string): string[] => {
  const threats: string[] = [];

  // SQL injection patterns
  if (/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i.test(input)) {
    threats.push('Potential SQL injection detected');
  }

  // XSS patterns
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(input)) {
    threats.push('Potential XSS script tag detected');
  }

  // Command injection patterns
  if (/[;&|`$()]/g.test(input)) {
    threats.push('Potential command injection detected');
  }

  // Path traversal
  if (/\.\.[\/\\]/g.test(input)) {
    threats.push('Potential path traversal detected');
  }

  return threats;
};

// Secure local storage wrapper
export class SecureStorage {
  private static instance: SecureStorage;
  private encryptionKey: string;

  private constructor() {
    // TODO: Replace with a proper key management solution (e.g., env var or
    // Web Crypto API key derivation). This plaintext key in source code
    // provides no real security — it is readable by anyone with access to
    // the compiled bundle.
    this.encryptionKey = import.meta.env.VITE_STORAGE_KEY ?? 'proximity-play-secure-key';
  }

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  setItem<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value);
      // In a real implementation, you would encrypt the value here
      localStorage.setItem(`secure_${key}`, serializedValue);
    } catch (error) {
      console.error('Error storing secure item:', error);
    }
  }

  getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`secure_${key}`);
      if (item) {
        // In a real implementation, you would decrypt the value here
        return JSON.parse(item);
      }
      return null;
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      return null;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  clear(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });
  }
}