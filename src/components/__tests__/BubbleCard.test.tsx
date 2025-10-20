import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BubbleCard } from '../BubbleCard';
import { useAppStore } from '@/stores/useAppStore';

// Mock the store
vi.mock('@/stores/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Users: () => <div data-testid="users-icon">Users</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const mockBubble = {
  id: '1',
  name: 'Test Bubble',
  description: 'A test bubble for testing',
  interest_tag: 'technology',
  member_count: 25,
  latitude: 40.7128,
  longitude: -74.0060,
  created_at: '2024-01-01T00:00:00Z',
  creator_id: 'user1',
  is_private: false,
  updated_at: '2024-01-01T00:00:00Z',
};

const mockUser = {
  id: 'user1',
  first_name: 'John',
  email: 'john@example.com',
};

describe('BubbleCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it('renders bubble information correctly', () => {
    render(<BubbleCard bubble={mockBubble} />);

    expect(screen.getByText('Test Bubble')).toBeInTheDocument();
    expect(screen.getByText('A test bubble for testing')).toBeInTheDocument();
    expect(screen.getByText('technology')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('displays join button for non-member bubbles', () => {
    render(<BubbleCard bubble={mockBubble} />);

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeInTheDocument();
  });

  it('displays member button for joined bubbles', () => {
    (useAppStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      userBubbles: [mockBubble],
    });

    render(<BubbleCard bubble={mockBubble} />);

    const memberButton = screen.getByRole('button', { name: /member/i });
    expect(memberButton).toBeInTheDocument();
  });

  it('shows distance when user location is available', () => {
    (useAppStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      userLocation: { lat: 40.7589, lng: -73.9851 }, // Times Square
    });

    render(<BubbleCard bubble={mockBubble} />);

    // Should show distance (approximately 8-9 km from Times Square to NYC center)
    expect(screen.getByText(/\d+(\.\d+)?\s*(km|mi)/)).toBeInTheDocument();
  });

  it('calls onJoin when join button is clicked', async () => {
    const mockOnJoin = vi.fn();
    render(<BubbleCard bubble={mockBubble} onJoin={mockOnJoin} />);

    const joinButton = screen.getByRole('button', { name: /join/i });
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(mockOnJoin).toHaveBeenCalledWith(mockBubble.id);
    });
  });

  it('calls onLeave when leave button is clicked', async () => {
    (useAppStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      userBubbles: [mockBubble],
    });

    const mockOnLeave = vi.fn();
    render(<BubbleCard bubble={mockBubble} onLeave={mockOnLeave} />);

    const leaveButton = screen.getByRole('button', { name: /leave/i });
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(mockOnLeave).toHaveBeenCalledWith(mockBubble.id);
    });
  });

  it('displays private badge for private bubbles', () => {
    const privateBubble = { ...mockBubble, is_private: true };
    render(<BubbleCard bubble={privateBubble} />);

    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<BubbleCard bubble={mockBubble} isLoading={true} />);

    expect(screen.getByText('Joining...')).toBeInTheDocument();
  });

  it('displays member count with correct pluralization', () => {
    const singleMemberBubble = { ...mockBubble, member_count: 1 };
    const { rerender } = render(<BubbleCard bubble={singleMemberBubble} />);

    expect(screen.getByText('1')).toBeInTheDocument();

    const multipleMembersBubble = { ...mockBubble, member_count: 25 };
    rerender(<BubbleCard bubble={multipleMembersBubble} />);

    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('handles missing description gracefully', () => {
    const bubbleWithoutDescription = { ...mockBubble, description: undefined };
    render(<BubbleCard bubble={bubbleWithoutDescription} />);

    // Should not crash and should still render the bubble name
    expect(screen.getByText('Test Bubble')).toBeInTheDocument();
  });

  it('applies correct CSS classes based on props', () => {
    const { container } = render(<BubbleCard bubble={mockBubble} className="custom-class" />);

    const cardElement = container.firstChild;
    expect(cardElement).toHaveClass('custom-class');
  });
});