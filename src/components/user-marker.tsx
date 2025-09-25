import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserLocation {
  user_id: string;
  avatar_url?: string;
  username?: string;
  latitude: number;
  longitude: number;
}

interface UserMarkerProps {
  users: UserLocation[];
  className?: string;
}

export function UserMarker({ users, className }: UserMarkerProps) {
  const displayUsers = users.slice(0, 3);
  const remainingCount = users.length - 3;

  return (
    <div
      className={cn(
        "flex -space-x-3 rtl:space-x-reverse",
        "bg-background/50 backdrop-blur-sm rounded-full p-1",
        className
      )}
    >
      {displayUsers.map((user, i) => (
        <Avatar
          key={user.user_id}
          className="w-8 h-8 border-2 border-background inline-block"
        >
          <AvatarImage src={user.avatar_url} alt={user.username} />
          <AvatarFallback>{user.username?.[0] || '?'}</AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/80 border-2 border-background text-xs text-white">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}