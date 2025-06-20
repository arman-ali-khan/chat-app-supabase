'use client';

import { supabase } from './supabase';
import { toast } from 'sonner';

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'edit' | 'presence' | 'error';
  data: any;
  timestamp: number;
  messageId?: string;
}

export interface TypingData {
  chatRoomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface MessageData {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image';
  imageUrl?: string;
  timestamp: number;
  isEdited?: boolean;
  editHistory?: Array<{ content: string; editedAt: number }>;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentUserId: string | null = null;
  private currentChatRoomId: string | null = null;

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    if (typeof window === 'undefined') return;

    try {
      // Use Supabase realtime for WebSocket connection
      this.setupSupabaseRealtime();
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private setupSupabaseRealtime() {
    // Set up Supabase realtime channels for different message types
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.processMessageQueue();
    this.emit('connection', { connected: true });
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.currentUserId) {
        // Send heartbeat to maintain connection
        this.sendPresenceUpdate(this.currentUserId, true);
      }
    }, 30000); // 30 seconds
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      toast.error('Connection failed. Please refresh the page.');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.initializeConnection();
    }, delay);
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  public connect(userId: string, chatRoomId?: string) {
    this.currentUserId = userId;
    this.currentChatRoomId = chatRoomId || null;
    
    if (!this.isConnected) {
      this.initializeConnection();
    }
  }

  public disconnect() {
    this.isConnected = false;
    this.currentUserId = null;
    this.currentChatRoomId = null;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.listeners.clear();
  }

  public sendMessage(message: WebSocketMessage) {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      return;
    }

    try {
      // Use Supabase to send the message
      this.handleMessageSend(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      this.messageQueue.push(message);
    }
  }

  private async handleMessageSend(message: WebSocketMessage) {
    switch (message.type) {
      case 'message':
        await this.sendChatMessage(message.data);
        break;
      case 'typing':
        await this.sendTypingStatus(message.data);
        break;
      case 'edit':
        await this.sendMessageEdit(message.data);
        break;
      case 'presence':
        await this.sendPresenceUpdate(message.data.userId, message.data.isOnline);
        break;
    }
  }

  private async sendChatMessage(data: MessageData) {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          id: data.id,
          chat_room_id: data.chatRoomId,
          sender_id: data.senderId,
          encrypted_content: data.content,
          message_type: data.messageType,
          image_url: data.imageUrl,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending chat message:', error);
      this.emit('error', { error: 'Failed to send message' });
    }
  }

  private async sendTypingStatus(data: TypingData) {
    try {
      const { error } = await supabase
        .from('typing_status')
        .upsert({
          chat_room_id: data.chatRoomId,
          user_id: data.userId,
          is_typing: data.isTyping,
        }, {
          onConflict: 'chat_room_id,user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending typing status:', error);
    }
  }

  private async sendMessageEdit(data: { messageId: string; newContent: string; editHistory: any[] }) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          encrypted_content: data.newContent,
          is_edited: true,
        })
        .eq('id', data.messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error editing message:', error);
      this.emit('error', { error: 'Failed to edit message' });
    }
  }

  private async sendPresenceUpdate(userId: string, isOnline: boolean) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  public getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.messageQueue.length,
    };
  }
}

export const wsManager = new WebSocketManager();