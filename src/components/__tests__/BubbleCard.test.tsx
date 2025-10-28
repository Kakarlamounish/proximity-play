import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BubbleCard } from '../BubbleCard';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user1', email: 'john@example.com' } }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Users: () => <div data-testid="users-icon">Users</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  MessageCircle: () => <div data-testid="message-circle-icon">MessageCircle</div>,
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({ count: 'exact', eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null, count: 1 })) })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ error: null, data: [{ id: 'membership1' }] })) })),
    })),
  },
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
  is_member: false,
};

describe('BubbleCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bubble information correctly', () => {
    render(<BubbleCard bubble={mockBubble} />);

    expect(screen.getByText('Test Bubble')).toBeInTheDocument();
    expect(screen.getByText('technology')).toBeInTheDocument();
    expect(screen.getByText('25 members')).toBeInTheDocument();
  });

  it('displays join button for non-member bubbles', () => {
    render(<BubbleCard bubble={mockBubble} />);

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeInTheDocument();
  });

  it('displays leave button and additional buttons for member bubbles', () => {
    const memberBubble = { ...mockBubble, is_member: true };
    render(<BubbleCard bubble={memberBubble} />);

    const leaveButton = screen.getByRole('button', { name: /leave/i });
    expect(leaveButton).toBeInTheDocument();

    // Should show message and calendar buttons for members
    expect(screen.getByTestId('message-circle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
  });

  it('shows distance when provided', () => {
    const bubbleWithDistance = { ...mockBubble, distance: 5.2 };
    render(<BubbleCard bubble={bubbleWithDistance} />);

    expect(screen.getByText('5.2km away')).toBeInTheDocument();
  });

  it('shows distance in meters for short distances', () => {
    const bubbleWithShortDistance = { ...mockBubble, distance: 0.8 };
    render(<BubbleCard bubble={bubbleWithShortDistance} />);

    expect(screen.getByText('800m away')).toBeInTheDocument();
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
    const memberBubble = { ...mockBubble, is_member: true };
    const mockOnLeave = vi.fn();
    render(<BubbleCard bubble={memberBubble} onLeave={mockOnLeave} />);

    const leaveButton = screen.getByRole('button', { name: /leave/i });
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(mockOnLeave).toHaveBeenCalledWith(memberBubble.id);
    });
  });

  it('calls onChat when chat button is clicked', () => {
    const memberBubble = { ...mockBubble, is_member: true };
    const mockOnChat = vi.fn();
    render(<BubbleCard bubble={memberBubble} onChat={mockOnChat} />);

    const chatButton = screen.getByTestId('message-circle-icon').closest('button');
    if (chatButton) {
      fireEvent.click(chatButton);
      expect(mockOnChat).toHaveBeenCalledWith(memberBubble.id);
    }
  });

  it('displays trending badge when trending is true', () => {
    const trendingBubble = { ...mockBubble, trending: true };
    render(<BubbleCard bubble={trendingBubble} />);

    expect(screen.getByText('🔥 Hot')).toBeInTheDocument();
  });

  it('displays member count correctly', () => {
    const singleMemberBubble = { ...mockBubble, member_count: 1 };
    const { rerender } = render(<BubbleCard bubble={singleMemberBubble} />);

    expect(screen.getByText('1 members')).toBeInTheDocument();

    const multipleMembersBubble = { ...mockBubble, member_count: 25 };
    rerender(<BubbleCard bubble={multipleMembersBubble} />);

    expect(screen.getByText('25 members')).toBeInTheDocument();
  });

  it('handles missing description gracefully', () => {
    const bubbleWithoutDescription = { ...mockBubble, description: undefined };
    render(<BubbleCard bubble={bubbleWithoutDescription} />);

    // Should not crash and should still render the bubble name
    expect(screen.getByText('Test Bubble')).toBeInTheDocument();
  });
});
