import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────
let mockUser: object | null = {
  id: 'user-abc',
  email: 'mouni@example.com',
  created_at: '2024-01-01T00:00:00Z',
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

vi.mock('@/hooks/useSnapScore', () => ({
  useSnapScore: () => ({ score: { total_score: 120, snaps_sent: 50, snaps_received: 40, stories_posted: 30 } }),
}));

vi.mock('@/hooks/useSnapStreaks', () => ({
  useSnapStreaks: () => ({ streaks: [] }),
}));

const mockProfile = {
  id: 'user-abc',
  first_name: 'Mouni',
  age: 22,
  bio: 'Loves exploring',
  interests: ['music', 'travel'],
  profile_photo_url: null,
  created_at: '2024-01-01T00:00:00Z',
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: table === 'profiles' ? mockProfile : null, error: null }),
          data: [],
        }),
      }),
    }),
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/components/EditProfileDialog', () => ({
  EditProfileDialog: () => <div data-testid="edit-profile-dialog" />,
}));

vi.mock('@/components/UserBadges', () => ({
  UserBadges: () => <div data-testid="user-badges" />,
}));

vi.mock('@/components/SnapScoreDisplay', () => ({
  SnapScoreDisplay: ({ totalScore }: { totalScore: number }) => (
    <div data-testid="snap-score">{totalScore}</div>
  ),
}));

vi.mock('@/components/SnapStreakBadge', () => ({
  SnapStreakBadge: () => <div data-testid="streak-badge" />,
}));

vi.mock('@/components/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
  default: () => <nav data-testid="navigation" />,
}));

// ── Tests ────────────────────────────────────────────────────────────────────
import Profile from '@/pages/Profile';

describe('Profile Page', () => {
  beforeEach(() => {
    mockUser = { id: 'user-abc', email: 'mouni@example.com', created_at: '2024-01-01T00:00:00Z' };
  });

  it('redirects to /auth when no user is present', () => {
    mockUser = null;
    render(<BrowserRouter><Profile /></BrowserRouter>);
    expect(screen.queryByRole('heading', { name: /interests/i })).not.toBeInTheDocument();
  });

  it('renders profile name from database', async () => {
    render(<BrowserRouter><Profile /></BrowserRouter>);
    await waitFor(() => {
      expect(screen.getByText('Mouni')).toBeInTheDocument();
    });
  });

  it('renders interests section', async () => {
    render(<BrowserRouter><Profile /></BrowserRouter>);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /interests/i })).toBeInTheDocument();
    });
  });

  it('renders SnapScore display', async () => {
    render(<BrowserRouter><Profile /></BrowserRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('snap-score')).toBeInTheDocument();
    });
  });

  it('renders edit profile dialog', async () => {
    render(<BrowserRouter><Profile /></BrowserRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-dialog')).toBeInTheDocument();
    });
  });
});
