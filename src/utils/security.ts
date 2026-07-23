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

// Secure local storage wrapper.
//
// Encrypts values at rest with AES-GCM before writing to localStorage, so a
// plaintext dump of localStorage (e.g. via an XSS payload reading storage, or
// someone inspecting devtools) doesn't hand over the raw value. This is
// defence-in-depth, not a substitute for keeping real secrets server-side —
// the key still lives in the page's JS, so anything that can execute script
// on the page can also derive the key and decrypt. It stops casual/offline
// inspection of the storage, which the previous plaintext implementation did
// not.
const SALT_STORAGE_KEY = 'secure_storage_salt';
const PBKDF2_ITERATIONS = 100_000;

function getOrCreateSalt(): Uint8Array {
  const existing = localStorage.getItem(SALT_STORAGE_KEY);
  if (existing) {
    return new Uint8Array(existing.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_STORAGE_KEY, Array.from(salt, b => b.toString(16).padStart(2, '0')).join(''));
  return salt;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

export class SecureStorage {
  private static instance: SecureStorage;
  private keyPromise: Promise<CryptoKey> | null = null;

  private constructor() {}

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  private async getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = (async () => {
        const passphrase = import.meta.env.VITE_STORAGE_KEY ?? window.location.origin;
        const salt = getOrCreateSalt();
        const baseKey = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(passphrase),
          'PBKDF2',
          false,
          ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
      })();
    }
    return this.keyPromise;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const cryptoKey = await this.getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(value));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
      const payload = `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
      localStorage.setItem(`secure_${key}`, payload);
    } catch (error) {
      console.error('Error storing secure item:', error);
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(`secure_${key}`);
      if (!item) return null;
      const [ivB64, ciphertextB64] = item.split('.');
      if (!ivB64 || !ciphertextB64) return null;
      const cryptoKey = await this.getKey();
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(ivB64) as BufferSource },
        cryptoKey,
        base64ToBytes(ciphertextB64) as BufferSource,
      );
      return JSON.parse(new TextDecoder().decode(plaintext));
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