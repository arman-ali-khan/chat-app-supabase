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
        console.log('Initial messages loaded:', data.length);
        setMessages(data as Message[]);
      }
    };

    fetchMessages();

    // Subscribe to realtime changes with a unique channel name
    const channelName = `messages-${chatRoomId}-${Date.now()}`;
    console.log('Subscribing to channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        async (payload) => {
          console.log('New message received via realtime:', payload);
          
          // Fetch the complete message with sender info
          const { data: messageWithSender, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(*)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (error) {
            console.error('Error fetching message with sender:', error);
            return;
          }
          
          if (messageWithSender) {
            console.log('Adding new message to state:', messageWithSender);
            setMessages((prev) => {
              // Check if message already exists to prevent duplicates
              const exists = prev.some(msg => msg.id === messageWithSender.id);
              if (exists) {
                console.log('Message already exists, skipping duplicate');
                return prev;
              }
              return [...prev, messageWithSender as Message];
            });
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
          console.log('Message updated via realtime:', payload);
          
          // Fetch the updated message with sender info
          const { data: messageWithSender, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(*)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (error) {
            console.error('Error fetching updated message:', error);
            return;
          }
          
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
          console.log('Message deleted via realtime:', payload);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe((status, err) => {
        console.log('Messages subscription status:', status, err);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to messages channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error:', err);
        }
      });

    return () => {
      console.log('Unsubscribing from messages channel:', channelName);
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

    const channelName = `typing-${chatRoomId}-${Date.now()}`;
    console.log('Subscribing to typing channel:', channelName);

    const channel = supabase
      .channel(channelName)
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
      .subscribe((status, err) => {
        console.log('Typing subscription status:', status, err);
      });

    return () => {
      console.log('Unsubscribing from typing channel:', channelName);
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

    const channelName = `users-presence-${Date.now()}`;
    console.log('Subscribing to presence channel:', channelName);

    const channel = supabase
      .channel(channelName)
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
      .subscribe((status, err) => {
        console.log('Presence subscription status:', status, err);
      });

    return () => {
      console.log('Unsubscribing from presence channel:', channelName);
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}