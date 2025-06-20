'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface EnhancedTypingIndicatorProps {
  typingUsers: Array<{
    id: string;
    username: string;
    displayName: string;
  }>;
  className?: string;
}

export function EnhancedTypingIndicator({ typingUsers, className }: EnhancedTypingIndicatorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (typingUsers.length === 0) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [typingUsers.length]);

  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].displayName} is typing${dots}`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing${dots}`;
    } else {
      return `${typingUsers[0].displayName} and ${typingUsers.length - 1} others are typing${dots}`;
    }
  };

  return (
    <div className={cn("flex items-center space-x-2 mb-4 animate-in fade-in-0 slide-in-from-bottom-2", className)}>
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((user) => (
          <Avatar key={user.id} className="w-6 h-6 border-2 border-white dark:border-gray-800">
            <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs">
              {user.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {getTypingText()}
          </span>
        </div>
      </div>
    </div>
  );
}