import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────
let mockUser: object | null = { id: 'user-123', email: 'snap@example.com' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false, signOut: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => ({ data: null }) }),
        in: () => ({ data: [] }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useSnapScore', () => ({ useSnapScore: () => ({ incrementScore: vi.fn() }) }));
vi.mock('@/hooks/useLocation', () => ({ useLocation: () => ({ latitude: 17.3, longitude: 78.4, loading: false, error: null }) }));

// MediaDevices mock (browser API not available in test env)
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// ── Tests ────────────────────────────────────────────────────────────────────
import CameraPage from '@/pages/Camera';

describe('Camera Page', () => {
  beforeEach(() => {
    mockUser = { id: 'user-123', email: 'snap@example.com' };
  });

  it('renders the camera interface for authenticated users', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );
    // CameraScreen renders a video element
    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });
  });

  it('redirects to /auth when no user', () => {
    mockUser = null;
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });
});
