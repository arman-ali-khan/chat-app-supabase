'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/supabase';

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender?: Database['public']['Tables']['users']['Row'];
};
type User = Database['public']['Tables']['users']['Row'];
type TypingStatus = Database['public']['Tables']['typing_status']['Row'];

export function useRealtimeMessages(chatRoomId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatRoomId) {
      setMessages([]);
      return;
    }

    // Fetch initial messages with sender information
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(*)
        `)
        .eq('chat_room_id', chatRoomId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      
      if (data) {
        setMessages(data as Message[]);
      }
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
        async (payload) => {
          console.log('New message received:', payload);
          
          // Fetch the complete message with sender info
          const { data: messageWithSender } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(*)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (messageWithSender) {
            setMessages((prev) => [...prev, messageWithSender as Message]);
          }
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
        async (payload) => {
          console.log('Message updated:', payload);
          
          // Fetch the updated message with sender info
          const { data: messageWithSender } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(*)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (messageWithSender) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (messageWithSender as Message) : msg
              )
            );
          }
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
          console.log('Message deleted:', payload);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from messages channel');
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  return messages;
}

export function useRealtimeTyping(chatRoomId: string | null, currentUserId: string | null) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!chatRoomId || !currentUserId) {
      setTypingUsers([]);
      return;
    }

    // Fetch initial typing status
    const fetchTypingStatus = async () => {
      const { data } = await supabase
        .from('typing_status')
        .select('*')
        .eq('chat_room_id', chatRoomId)
        .eq('is_typing', true)
        .neq('user_id', currentUserId);
      
      if (data) {
        setTypingUsers(data.map(status => status.user_id));
      }
    };

    fetchTypingStatus();

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
          console.log('Typing status change:', payload);
          
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
            if (typing.user_id !== currentUserId) {
              setTypingUsers((prev) => prev.filter((id) => id !== typing.user_id));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Typing subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from typing channel');
      supabase.removeChannel(channel);
    };
  }, [chatRoomId, currentUserId]);

  return typingUsers;
}

export function useRealtimePresence() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

  useEffect(() => {
    // Fetch initial online users
    const fetchOnlineUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('is_online', true);
      
      if (data) {
        setOnlineUsers(data);
      }
    };

    fetchOnlineUsers();

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
          console.log('User presence update:', payload);
          const user = payload.new as User;
          setOnlineUsers((prev) => {
            const filtered = prev.filter((u) => u.id !== user.id);
            return user.is_online ? [...filtered, user] : filtered;
          });
        }
      )
      .subscribe((status) => {
        console.log('Presence subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from presence channel');
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}