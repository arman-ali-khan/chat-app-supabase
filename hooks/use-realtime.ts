'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/supabase';

type Message = Database['public']['Tables']['messages']['Row'];
type User = Database['public']['Tables']['users']['Row'];
type TypingStatus = Database['public']['Tables']['typing_status']['Row'];

export function useRealtimeMessages(chatRoomId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatRoomId) return;

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', chatRoomId)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
    };

    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`messages:${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? (payload.new as Message) : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  return messages;
}

export function useRealtimeTyping(chatRoomId: string | null, currentUserId: string | null) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!chatRoomId || !currentUserId) return;

    const channel = supabase
      .channel(`typing:${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const typing = payload.new as TypingStatus;
            if (typing.user_id !== currentUserId) {
              setTypingUsers((prev) => {
                const filtered = prev.filter((id) => id !== typing.user_id);
                return typing.is_typing ? [...filtered, typing.user_id] : filtered;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const typing = payload.old as TypingStatus;
            setTypingUsers((prev) => prev.filter((id) => id !== typing.user_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatRoomId, currentUserId]);

  return typingUsers;
}

export function useRealtimePresence() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('users:presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const user = payload.new as User;
          setOnlineUsers((prev) => {
            const filtered = prev.filter((u) => u.id !== user.id);
            return user.is_online ? [...filtered, user] : filtered;
          });
        }
      )
      .subscribe();

    // Fetch initial online users
    const fetchOnlineUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('is_online', true);
      
      if (data) setOnlineUsers(data);
    };

    fetchOnlineUsers();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}