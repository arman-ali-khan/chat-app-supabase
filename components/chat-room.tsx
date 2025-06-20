'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Image, MoreVertical, ArrowLeft, Circle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getCurrentUser, logoutUser, updateUserPresence } from '@/lib/auth';
import { useChat } from '@/hooks/use-chat';
import { useRealtimeMessages, useRealtimeTyping } from '@/hooks/use-realtime';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { UserList } from './user-list';
import { ImageUpload } from './image-upload';
import { EmojiPicker } from './emoji-picker';
import { decryptMessage } from '@/lib/encryption';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ChatRoomProps {
  targetUsername: string;
}

export function ChatRoom({ targetUsername }: ChatRoomProps) {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [targetUser, setTargetUser] = useState<any>(null);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUserList, setShowUserList] = useState(true);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionRetries, setConnectionRetries] = useState(0);
  
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionCheckRef = useRef<NodeJS.Timeout>();
  
  const { findOrCreateChatRoom, sendMessage, setTypingStatus } = useChat();
  const messages = useRealtimeMessages(chatRoom?.id);
  const typingUsers = useRealtimeTyping(chatRoom?.id, currentUser?.id);

  // Connection monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionRetries(0);
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check Supabase connection periodically
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        
        if (!isOnline) {
          setIsOnline(true);
          setConnectionRetries(0);
        }
      } catch (error) {
        console.error('Connection check failed:', error);
        if (connectionRetries < 3) {
          setConnectionRetries(prev => prev + 1);
          setTimeout(checkConnection, 5000 * (connectionRetries + 1));
        } else {
          setIsOnline(false);
          toast.error('Unable to connect to server');
        }
      }
    };

    connectionCheckRef.current = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
    };
  }, [connectionRetries, isOnline]);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      router.push('/');
      return;
    }
    
    // Update presence when entering chat room
    updateUserPresence(currentUser.id, true);
  }, [currentUser, router]);

  // Find target user and create/find chat room
  useEffect(() => {
    const initializeChat = async () => {
      if (!currentUser || !targetUsername) return;

      try {
        console.log('Initializing chat with:', targetUsername);
        
        // Find target user
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('username', targetUsername.toLowerCase())
          .single();

        if (userError || !user) {
          console.error('User not found:', userError);
          toast.error('User not found');
          router.push('/chat');
          return;
        }

        console.log('Target user found:', user);
        setTargetUser(user);

        // Create or find chat room
        const { chatRoom: room, error: roomError } = await findOrCreateChatRoom(
          currentUser.id,
          user.id
        );

        if (roomError) {
          console.error('Failed to create chat room:', roomError);
          toast.error('Failed to create chat room');
          return;
        }

        console.log('Chat room ready:', room);
        setChatRoom(room);
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast.error('Something went wrong');
      }
    };

    initializeChat();
  }, [currentUser, targetUsername, findOrCreateChatRoom, router]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Subscribe to target user updates for real-time presence
  useEffect(() => {
    if (!targetUser) return;

    console.log('Setting up presence subscription for target user:', targetUser.id);

    const channel = supabase
      .channel(`user-presence-${targetUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${targetUser.id}`,
        },
        (payload) => {
          console.log('Target user presence update:', payload);
          setTargetUser((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe((status) => {
        console.log('Target user presence subscription status:', status);
      });

    return () => {
      console.log('Cleaning up target user presence subscription');
      supabase.removeChannel(channel);
    };
  }, [targetUser?.id]);

  // Handle typing indicator with improved debouncing
  const handleTyping = useCallback((typing: boolean) => {
    if (!chatRoom || !currentUser || !isOnline) return;
    
    console.log('Handling typing status:', typing);
    
    if (typing) {
      setIsTyping(true);
      setTypingStatus(chatRoom.id, currentUser.id, true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout
      typingTimeoutRef.current = setTimeout(() => {
        console.log('Typing timeout reached, setting to false');
        setIsTyping(false);
        setTypingStatus(chatRoom.id, currentUser.id, false);
      }, 3000);
    } else {
      setIsTyping(false);
      setTypingStatus(chatRoom.id, currentUser.id, false);
      
      // Clear timeout when explicitly stopping typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [chatRoom, currentUser, setTypingStatus, isOnline]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatRoom || !currentUser) return;

    if (!isOnline) {
      toast.error('Cannot send message while offline');
      return;
    }

    const messageContent = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX
    handleTyping(false); // Stop typing indicator

    console.log('Sending message:', messageContent);

    const { error } = await sendMessage(
      chatRoom.id,
      currentUser.id,
      messageContent
    );

    if (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setMessageText(messageContent); // Restore message on error
      return;
    }
  };

  const handleImageSend = async (imageUrl: string, caption?: string) => {
    if (!chatRoom || !currentUser) return;

    if (!isOnline) {
      toast.error('Cannot send image while offline');
      return;
    }

    const { error } = await sendMessage(
      chatRoom.id,
      currentUser.id,
      caption || 'Image',
      'image',
      imageUrl
    );

    if (error) {
      toast.error('Failed to send image');
      return;
    }

    setShowImageUpload(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };

  const handleLogout = () => {
    logoutUser();
    router.push('/');
  };

  const decryptedMessages = messages.map(msg => ({
    ...msg,
    decrypted_content: msg.is_deleted ? 'This message was deleted' : decryptMessage(msg.encrypted_content),
  }));

  if (!currentUser) return null;

  const isTargetOnline = targetUser && (
    targetUser.is_online && 
    new Date().getTime() - new Date(targetUser.last_seen).getTime() < 60000 // 1 minute threshold
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* User List Sidebar */}
      {showUserList && (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <UserList 
            currentUser={currentUser}
            onUserSelect={(username) => {
              if (username !== targetUsername) {
                router.push(`/chat/${username}`);
              }
              setShowUserList(false);
            }}
            onLogout={handleLogout}
            selectedUsername={targetUsername}
          />
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUserList(!showUserList)}
            className="mr-3 lg:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          {/* Connection Status */}
          <div className="mr-3">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
          </div>
          
          {targetUser && (
            <div className="flex items-center flex-1">
              <Avatar className="w-10 h-10 mr-3">
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  {targetUser.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {targetUser.display_name}
                </h2>
                <div className="flex items-center text-sm">
                  <Circle 
                    className={`w-2 h-2 mr-1 ${
                      isTargetOnline ? 'text-green-500 fill-current' : 'text-gray-400'
                    }`} 
                  />
                  <span className="text-gray-500 dark:text-gray-400">
                    {isTargetOnline ? 'Online' : 'Offline'}
                  </span>
                  {typingUsers.length > 0 && (
                    <span className="ml-2 text-blue-500">typing...</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {decryptedMessages.map((message) => (
              <MessageBubble 
                key={message.id}
                message={message}
                currentUserId={currentUser.id}
                onEdit={(id, content) => {
                  // Handle edit
                }}
                onDelete={(id) => {
                  // Handle delete
                }}
                onReply={(id) => {
                  // Handle reply
                }}
              />
            ))}
            {typingUsers.length > 0 && <TypingIndicator />}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {!isOnline && (
            <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm rounded">
              You're offline. Messages will be sent when connection is restored.
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageUpload(true)}
              disabled={!isOnline}
            >
              <Image className="w-4 h-4" />
            </Button>
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            <Input
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                if (e.target.value && !isTyping) {
                  handleTyping(true);
                } else if (!e.target.value && isTyping) {
                  handleTyping(false);
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isOnline ? "Type a message..." : "Offline - messages will be sent when connected"}
              className="flex-1"
              disabled={!isOnline}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!messageText.trim() || !isOnline}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <ImageUpload
          onUpload={handleImageSend}
          onClose={() => setShowImageUpload(false)}
        />
      )}
    </div>
  );
}