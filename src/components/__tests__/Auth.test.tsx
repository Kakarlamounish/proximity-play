import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────
let mockUser: object | null = null;
let mockLoading = false;
const mockToast = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────
import Auth from '@/pages/Auth';

describe('Auth Page', () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
    vi.clearAllMocks();
  });

  it('renders the sign in screen with email, password fields and Google sign-in button', () => {
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );

    expect(screen.getByText('Proximity Play')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Sign In with Google')).toBeInTheDocument();
  });

  it('toggles to sign up mode when sign up tab is clicked', () => {
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );

    const signUpTab = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(signUpTab);

    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument(); // Full Name field
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays a toast warning when trying to submit empty fields', async () => {
    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Missing fields',
        variant: 'destructive',
      })
    );
  });

  it('calls supabase signInWithPassword on valid submit in signin mode', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });

    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'mouni@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'mouni@example.com',
        password: 'password123',
      });
    });
  });

  it('calls supabase signUp on valid submit in signup mode', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    render(
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    );

    // Switch to sign up
    const signUpTab = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(signUpTab);

    // Fill fields
    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Mouni K' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'mouni@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'mouni@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'Mouni K',
          },
        },
      });
    });
  });
});
