import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    signOut: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => ({ data: { first_name: 'Mouni', profile_photo_url: null }, error: null }) }),
        count: 0,
        head: true,
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/components/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));

vi.mock('@/components/SearchDialog', () => ({
  SearchDialog: () => <div data-testid="search-dialog" />,
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

// ── Tests ────────────────────────────────────────────────────────────────────
import { Navigation } from '../Navigation';

describe('Navigation', () => {
  it('renders the Proximity Play brand name', () => {
    render(<BrowserRouter><Navigation /></BrowserRouter>);
    expect(screen.getByText(/Proximity Play/i)).toBeInTheDocument();
  });

  it('renders key navigation links', () => {
    render(<BrowserRouter><Navigation /></BrowserRouter>);
    expect(screen.getByText(/Snap Map/i)).toBeInTheDocument();
    expect(screen.getByText(/Chat/i)).toBeInTheDocument();
  });

  it('renders the mobile menu toggle button', () => {
    render(<BrowserRouter><Navigation /></BrowserRouter>);
    const menuBtn = screen.getByRole('button', { name: /menu/i });
    expect(menuBtn).toBeInTheDocument();
  });
});
