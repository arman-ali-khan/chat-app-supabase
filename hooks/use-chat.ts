'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, generateChatRoomKey } from '@/lib/encryption';
import { offlineMessageQueue } from '@/lib/offline-queue';
import { Database } from '@/lib/supabase';
import { toast } from 'sonner';

type ChatRoom = Database['public']['Tables']['chat_rooms']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Process queued messages when coming back online
      await offlineMessageQueue.processQueue(async (queuedMessage) => {
        try {
          const { error } = await supabase
            .from('messages')
            .insert({
              chat_room_id: queuedMessage.chatRoomId,
              sender_id: queuedMessage.senderId,
              encrypted_content: encryptMessage(queuedMessage.content),
              message_type: queuedMessage.messageType,
              image_url: queuedMessage.imageUrl,
            });

          if (error) {
            console.error('Error sending queued message:', error);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error processing queued message:', error);
          return false;
        }
      });

      const queueLength = offlineMessageQueue.getQueueLength();
      if (queueLength === 0) {
        toast.success('All messages sent successfully');
      } else {
        toast.warning(`${queueLength} messages failed to send`);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    // If offline, queue the message
    if (!isOnline) {
      const queueId = offlineMessageQueue.addMessage({
        chatRoomId,
        senderId,
        content,
        messageType,
        imageUrl,
      });
      
      toast.info('Message queued - will send when online');
      return { message: null, error: null, queued: true };
    }

    try {
      const encryptedContent = encryptMessage(content);
      
      console.log('Sending message:', {
        chatRoomId,
        senderId,
        content: content.substring(0, 50) + '...',
        messageType
      });
      
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

      if (error) {
        console.error('Error sending message:', error);
        
        // If it's a network error, queue the message
        if (error.message.includes('network') || error.message.includes('fetch')) {
          const queueId = offlineMessageQueue.addMessage({
            chatRoomId,
            senderId,
            content,
            messageType,
            imageUrl,
          });
          
          toast.info('Network error - message queued');
          return { message: null, error: null, queued: true };
        }
        
        throw error;
      }
      
      console.log('Message sent successfully:', data);
      return { message: data, error: null };
    } catch (error) {
      console.error('Error sending message:', error);
      return { message: null, error: error as Error };
    }
  }, [isOnline]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!isOnline) {
      toast.error('Cannot edit messages while offline');
      return { message: null, error: new Error('Offline') };
    }

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
  }, [isOnline]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!isOnline) {
      toast.error('Cannot delete messages while offline');
      return { error: new Error('Offline') };
    }

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
  }, [isOnline]);

  const setTypingStatus = useCallback(async (chatRoomId: string, userId: string, isTyping: boolean) => {
    if (!isOnline) return; // Don't try to set typing status when offline

    try {
      console.log('Setting typing status:', { chatRoomId, userId, isTyping });
      
      const { error } = await supabase
        .from('typing_status')
        .upsert({
          chat_room_id: chatRoomId,
          user_id: userId,
          is_typing: isTyping,
        }, {
          onConflict: 'chat_room_id,user_id'
        });

      if (error) {
        console.error('Error setting typing status:', error);
        throw error;
      }
      
      console.log('Typing status set successfully');
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  }, [isOnline]);

  return {
    isLoading,
    isOnline,
    findOrCreateChatRoom,
    sendMessage,
    editMessage,
    deleteMessage,
    setTypingStatus,
  };
}