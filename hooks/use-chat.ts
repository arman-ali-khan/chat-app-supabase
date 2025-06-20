'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, generateChatRoomKey } from '@/lib/encryption';
import { Database } from '@/lib/supabase';

type ChatRoom = Database['public']['Tables']['chat_rooms']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);

  const findOrCreateChatRoom = useCallback(async (user1Id: string, user2Id: string) => {
    setIsLoading(true);
    try {
      // Sort user IDs to ensure consistent chat room lookup
      const [firstUserId, secondUserId] = [user1Id, user2Id].sort();

      // Check if chat room exists
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(user1_id.eq.${firstUserId},user2_id.eq.${secondUserId}),and(user1_id.eq.${secondUserId},user2_id.eq.${firstUserId})`)
        .single();

      if (existingRoom) {
        return { chatRoom: existingRoom, error: null };
      }

      // Create new chat room
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          user1_id: firstUserId,
          user2_id: secondUserId,
        })
        .select()
        .single();

      if (error) throw error;

      return { chatRoom: newRoom, error: null };
    } catch (error) {
      return { chatRoom: null, error: error as Error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (
    chatRoomId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' = 'text',
    imageUrl?: string,
    replyToId?: string
  ) => {
    try {
      const encryptedContent = encryptMessage(content);
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_room_id: chatRoomId,
          sender_id: senderId,
          encrypted_content: encryptedContent,
          message_type: messageType,
          image_url: imageUrl,
          reply_to_id: replyToId,
        })
        .select()
        .single();

      if (error) throw error;
      return { message: data, error: null };
    } catch (error) {
      return { message: null, error: error as Error };
    }
  }, []);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const encryptedContent = encryptMessage(newContent);
      
      const { data, error } = await supabase
        .from('messages')
        .update({
          encrypted_content: encryptedContent,
          is_edited: true,
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return { message: data, error: null };
    } catch (error) {
      return { message: null, error: error as Error };
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const setTypingStatus = useCallback(async (chatRoomId: string, userId: string, isTyping: boolean) => {
    try {
      const { error } = await supabase
        .from('typing_status')
        .upsert({
          chat_room_id: chatRoomId,
          user_id: userId,
          is_typing: isTyping,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  }, []);

  return {
    isLoading,
    findOrCreateChatRoom,
    sendMessage,
    editMessage,
    deleteMessage,
    setTypingStatus,
  };
}