'use client';

import { useState, useEffect } from 'react';
import { Search, LogOut, MessageCircle, Circle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface UserListProps {
  currentUser: any;
  onUserSelect: (username: string) => void;
  onLogout: () => void;
  selectedUsername?: string;
}

export function UserList({ currentUser, onUserSelect, onLogout, selectedUsername }: UserListProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
    
    // Subscribe to user updates for real-time presence
    const channel = supabase
      .channel('user-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('User update received in user list:', payload);
          setUsers((prev) =>
            prev.map((user) =>
              user.id === payload.new.id ? { ...user, ...payload.new } : user
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('New user added:', payload);
          setUsers((prev) => [...prev, payload.new]);
        }
      )
      .subscribe((status) => {
        console.log('User list subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.id !== currentUser?.id &&
      (user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       user.username.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredUsers(filtered);
  }, [users, searchQuery, currentUser]);

  const fetchUsers = async () => {
    console.log('Fetching users for user list');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_seen', { ascending: false });
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    if (data) {
      console.log('Users fetched:', data.length);
      setUsers(data);
    }
  };

  const isUserOnline = (user: any) => {
    if (!user.is_online) return false;
    
    // Consider user online if they were active within the last 1 minute
    const lastSeen = new Date(user.last_seen).getTime();
    const now = new Date().getTime();
    const timeDiff = now - lastSeen;
    
    return timeDiff < 60000; // 1 minute
  };

  const getLastSeenText = (user: any) => {
    if (isUserOnline(user)) return 'Online';
    
    const lastSeen = new Date(user.last_seen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeen.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                {currentUser?.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {currentUser?.display_name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{currentUser?.username}
              </p>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => {
                const isOnline = isUserOnline(user);
                const lastSeenText = getLastSeenText(user);
                
                return (
                  <button
                    key={user.id}
                    onClick={() => onUserSelect(user.username)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700",
                      selectedUsername === user.username && "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
                            {user.display_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Circle 
                          className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white dark:border-gray-800 rounded-full",
                            isOnline ? "text-green-500 fill-current" : "text-gray-400 fill-current"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.display_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          @{user.username}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-xs",
                          isOnline ? "text-green-500" : "text-gray-400"
                        )}>
                          {lastSeenText}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}