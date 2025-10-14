import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Navigation } from '../Navigation';

// Mock the AuthContext to avoid dependency on Supabase and auth setup
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe('Navigation', () => {
  it('renders navigation', () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    // Check for the "Home" text in the navigation
    expect(screen.getByText(/Home/i)).toBeInTheDocument();
  });
});
