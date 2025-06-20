'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Image, Smile, MoreVertical, ArrowLeft, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getCurrentUser, logoutUser } from '@/lib/auth';
import { useChat } from '@/hooks/use-chat';
import { useRealtimeMessages, useRealtimeTyping } from '@/hooks/use-realtime';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { UserList } from './user-list';
import { ImageUpload } from './image-upload';
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
  
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  const { findOrCreateChatRoom, sendMessage, setTypingStatus } = useChat();
  const messages = useRealtimeMessages(chatRoom?.id);
  const typingUsers = useRealtimeTyping(chatRoom?.id, currentUser?.id);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      router.push('/');
      return;
    }
  }, [currentUser, router]);

  // Find target user and create/find chat room
  useEffect(() => {
    const initializeChat = async () => {
      if (!currentUser || !targetUsername) return;

      try {
        // Find target user
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('username', targetUsername.toLowerCase())
          .single();

        if (userError || !user) {
          toast.error('User not found');
          router.push('/chat');
          return;
        }

        setTargetUser(user);

        // Create or find chat room
        const { chatRoom: room, error: roomError } = await findOrCreateChatRoom(
          currentUser.id,
          user.id
        );

        if (roomError) {
          toast.error('Failed to create chat room');
          return;
        }

        setChatRoom(room);
      } catch (error) {
        toast.error('Something went wrong');
      }
    };

    initializeChat();
  }, [currentUser, targetUsername, findOrCreateChatRoom, router]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleTyping = useCallback((typing: boolean) => {
    if (!chatRoom || !currentUser) return;
    
    setTypingStatus(chatRoom.id, currentUser.id, typing);
    
    if (typing) {
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setTypingStatus(chatRoom.id, currentUser.id, false);
      }, 3000);
    } else {
      setIsTyping(false);
    }
  }, [chatRoom, currentUser, setTypingStatus]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatRoom || !currentUser) return;

    const { error } = await sendMessage(
      chatRoom.id,
      currentUser.id,
      messageText
    );

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    setMessageText('');
    handleTyping(false);
  };

  const handleImageSend = async (imageUrl: string, caption?: string) => {
    if (!chatRoom || !currentUser) return;

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

  const handleLogout = () => {
    logoutUser();
    router.push('/');
  };

  const decryptedMessages = messages.map(msg => ({
    ...msg,
    decrypted_content: msg.is_deleted ? 'This message was deleted' : decryptMessage(msg.encrypted_content),
  }));

  if (!currentUser) return null;

  const isOnline = targetUser && (
    targetUser.is_online && 
    new Date().getTime() - new Date(targetUser.last_seen).getTime() < 15000
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
                      isOnline ? 'text-green-500 fill-current' : 'text-gray-400'
                    }`} 
                  />
                  <span className="text-gray-500 dark:text-gray-400">
                    {isOnline ? 'Online' : 'Offline'}
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
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageUpload(true)}
            >
              <Image className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Smile className="w-4 h-4" />
            </Button>
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
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
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