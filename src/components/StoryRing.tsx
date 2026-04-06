import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface StoryRingProps {
  name: string;
  avatarUrl?: string | null;
  hasUnwatched?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function StoryRing({ name, avatarUrl, hasUnwatched = false, size = 'md', onClick }: StoryRingProps) {
  const sizeMap = {
    sm: { ring: 'w-12 h-12', avatar: 'w-10 h-10', text: 'text-[10px]', border: 'p-[2px]' },
    md: { ring: 'w-16 h-16', avatar: 'w-14 h-14', text: 'text-xs', border: 'p-[2.5px]' },
    lg: { ring: 'w-20 h-20', avatar: 'w-[72px] h-[72px]', text: 'text-sm', border: 'p-[3px]' },
  };
  const s = sizeMap[size];

  // Gradient colors for story ring
  const gradientColors = [
    'from-purple-500 via-pink-500 to-orange-400',
    'from-green-400 via-emerald-500 to-teal-500',
    'from-blue-400 via-indigo-500 to-purple-500',
    'from-yellow-400 via-orange-500 to-red-500',
  ];
  const gradient = gradientColors[name.charCodeAt(0) % gradientColors.length];

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 group">
      <div className={`${s.ring} rounded-full ${s.border} ${
        hasUnwatched
          ? `bg-gradient-to-br ${gradient}`
          : 'bg-muted'
      }`}>
        <Avatar className={`${s.avatar} border-2 border-background`}>
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground font-bold">
            {name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      </div>
      <span className={`${s.text} font-medium text-muted-foreground group-hover:text-foreground truncate max-w-[64px] text-center`}>
        {name}
      </span>
    </button>
  );
}
