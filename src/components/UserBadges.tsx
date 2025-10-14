import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';

interface BadgeData {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  earned_at: string;
}

interface UserBadgesProps {
  userId: string;
}

export const UserBadges = ({ userId }: UserBadgesProps) => {
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, [userId]);

  const fetchBadges = async () => {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          earned_at,
          badge:badges(
            id,
            name,
            icon,
            description
          )
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;

      const formattedBadges = data?.map(item => ({
        ...item.badge,
        earned_at: item.earned_at,
      })) || [];

      setBadges(formattedBadges as BadgeData[]);
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || badges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Award className="w-4 h-4" />
        Achievements
      </h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge
            key={badge.id}
            variant="secondary"
            className="bg-gradient-to-r from-secondary to-primary text-white"
            title={badge.description}
          >
            {badge.icon && <span className="mr-1">{badge.icon}</span>}
            {badge.name}
          </Badge>
        ))}
      </div>
    </div>
  );
};
