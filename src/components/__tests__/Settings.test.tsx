import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockSignOut = vi.fn();
let mockUser: object | null = { id: 'test-user', email: 'test@example.com' };
let mockLoading = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading, signOut: mockSignOut }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ data: null, error: null }) }),
      delete: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
    storage: { from: () => ({ list: () => ({ data: [], error: null }) }) },
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/UpdateLocationDialog', () => ({
  UpdateLocationDialog: () => <div data-testid="update-location-dialog" />,
}));

// ── Tests ────────────────────────────────────────────────────────────────────
import Settings from '@/pages/Settings';

const renderSettings = () =>
  render(
    <BrowserRouter>
      <Settings />
    </BrowserRouter>
  );

describe('Settings Page', () => {
  beforeEach(() => {
    mockUser = { id: 'test-user', email: 'test@example.com' };
    mockLoading = false;
    mockSignOut.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders the settings page title', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });
  });

  it('renders the Sign Out button', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });

  it('shows a confirmation dialog before signing out', async () => {
    renderSettings();
    await waitFor(() => {
      const signOutBtn = screen.getByRole('button', { name: /sign out/i });
      fireEvent.click(signOutBtn);
    });
    
    expect(screen.getByText(/Are you sure you want to sign out\?/i)).toBeInTheDocument();
    
    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut when user confirms', async () => {
    renderSettings();
    await waitFor(() => {
      const signOutBtn = screen.getByRole('button', { name: /sign out/i });
      fireEvent.click(signOutBtn);
    });
    
    // Click Yes, Sign Out
    const confirmBtn = screen.getByRole('button', { name: /yes, sign out/i });
    fireEvent.click(confirmBtn);
    
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows a confirmation dialog before deleting account', async () => {
    renderSettings();
    await waitFor(() => {
      const deleteBtn = screen.getByRole('button', { name: /delete account/i });
      fireEvent.click(deleteBtn);
    });
    
    expect(screen.getByText(/Are you sure you want to delete your account\? This action is permanent/i)).toBeInTheDocument();
    
    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
  });

  it('shows a confirmation dialog before deleting all data', async () => {
    renderSettings();
    await waitFor(() => {
      const deleteBtn = screen.getByRole('button', { name: /delete location history/i });
      fireEvent.click(deleteBtn);
    });
    
    expect(screen.getByText(/Are you sure you want to delete ALL your location history, trips, and dead drops\?/i)).toBeInTheDocument();
    
    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
  });

  it('redirects to /auth when no user is present', () => {
    mockUser = null;
    renderSettings();
    // Navigate component is rendered — no Settings heading
    expect(screen.queryByRole('heading', { name: /settings/i })).not.toBeInTheDocument();
  });
});
