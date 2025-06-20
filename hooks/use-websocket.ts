'use client';

import { useEffect, useRef, useCallback } from 'react';
import { wsManager, WebSocketMessage, MessageData, TypingData } from '@/lib/websocket';

interface UseWebSocketOptions {
  userId?: string;
  chatRoomId?: string;
  onMessage?: (data: MessageData) => void;
  onTyping?: (data: TypingData) => void;
  onEdit?: (data: { messageId: string; newContent: string }) => void;
  onError?: (error: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    userId,
    chatRoomId,
    onMessage,
    onTyping,
    onEdit,
    onError,
    onConnectionChange,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!userId) return;

    // Connect to WebSocket
    wsManager.connect(userId, chatRoomId);

    // Set up event listeners
    const handleMessage = (data: MessageData) => {
      optionsRef.current.onMessage?.(data);
    };

    const handleTyping = (data: TypingData) => {
      optionsRef.current.onTyping?.(data);
    };

    const handleEdit = (data: { messageId: string; newContent: string }) => {
      optionsRef.current.onEdit?.(data);
    };

    const handleError = (error: any) => {
      optionsRef.current.onError?.(error);
    };

    const handleConnection = (data: { connected: boolean }) => {
      optionsRef.current.onConnectionChange?.(data.connected);
    };

    wsManager.on('message', handleMessage);
    wsManager.on('typing', handleTyping);
    wsManager.on('edit', handleEdit);
    wsManager.on('error', handleError);
    wsManager.on('connection', handleConnection);

    return () => {
      wsManager.off('message', handleMessage);
      wsManager.off('typing', handleTyping);
      wsManager.off('edit', handleEdit);
      wsManager.off('error', handleError);
      wsManager.off('connection', handleConnection);
    };
  }, [userId, chatRoomId]);

  const sendMessage = useCallback((data: MessageData) => {
    const message: WebSocketMessage = {
      type: 'message',
      data,
      timestamp: Date.now(),
      messageId: data.id,
    };
    wsManager.sendMessage(message);
  }, []);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!userId || !chatRoomId) return;

    const message: WebSocketMessage = {
      type: 'typing',
      data: {
        chatRoomId,
        userId,
        username: '', // Will be filled by the system
        isTyping,
      },
      timestamp: Date.now(),
    };
    wsManager.sendMessage(message);
  }, [userId, chatRoomId]);

  const editMessage = useCallback((messageId: string, newContent: string, editHistory: any[] = []) => {
    const message: WebSocketMessage = {
      type: 'edit',
      data: {
        messageId,
        newContent,
        editHistory: [...editHistory, { content: newContent, editedAt: Date.now() }],
      },
      timestamp: Date.now(),
      messageId,
    };
    wsManager.sendMessage(message);
  }, []);

  const updatePresence = useCallback((isOnline: boolean) => {
    if (!userId) return;

    const message: WebSocketMessage = {
      type: 'presence',
      data: {
        userId,
        isOnline,
      },
      timestamp: Date.now(),
    };
    wsManager.sendMessage(message);
  }, [userId]);

  const getConnectionStatus = useCallback(() => {
    return wsManager.getConnectionStatus();
  }, []);

  return {
    sendMessage,
    sendTypingStatus,
    editMessage,
    updatePresence,
    getConnectionStatus,
  };
}