'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Edit, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface EnhancedMessageBubbleProps {
  message: any;
  currentUserId: string;
  onEdit: (messageId: string, newContent: string) => void;
  onReply?: (messageId: string) => void;
  isDelivered?: boolean;
  deliveryTimestamp?: number;
}

export function EnhancedMessageBubble({ 
  message, 
  currentUserId, 
  onEdit, 
  onReply,
  isDelivered = true,
  deliveryTimestamp
}: EnhancedMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.decrypted_content || message.encrypted_content);
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isOwn = message.sender_id === currentUserId;
  const isDeleted = message.is_deleted;

  // Animation for new messages
  useEffect(() => {
    if (message.created_at) {
      const messageTime = new Date(message.created_at).getTime();
      const now = Date.now();
      
      // If message is less than 1 second old, animate it
      if (now - messageTime < 1000) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
    }
  }, [message.created_at]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (editText.trim() && editText !== (message.decrypted_content || message.encrypted_content)) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.decrypted_content || message.encrypted_content);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isDeleted) {
    return (
      <div className={cn("flex mb-4", isOwn ? "justify-end" : "justify-start")}>
        <div className={cn(
          "max-w-xs lg:max-w-md px-4 py-2 rounded-2xl",
          "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic"
        )}>
          <p className="text-sm">This message was deleted</p>
          <p className="text-xs text-gray-400 mt-1">
            {format(new Date(message.created_at), 'HH:mm')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex mb-4 transition-all duration-300",
      isOwn ? "justify-end" : "justify-start",
      isAnimating && "animate-in slide-in-from-bottom-2 fade-in-0"
    )}>
      <div className={cn("flex max-w-xs lg:max-w-md", isOwn ? "flex-row-reverse" : "flex-row")}>
        {!isOwn && (
          <Avatar className="w-8 h-8 mr-2">
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">
              {message.sender?.display_name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={cn(
          "px-4 py-2 rounded-2xl relative group transition-all duration-200",
          isOwn 
            ? "bg-blue-500 text-white rounded-br-md hover:bg-blue-600" 
            : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-600 hover:shadow-md"
        )}>
          {message.reply_to_id && (
            <div className="mb-2 p-2 bg-black/10 rounded text-sm opacity-75">
              <p>Replying to message...</p>
            </div>
          )}

          {message.message_type === 'image' && message.image_url ? (
            <div className="mb-2">
              <img 
                src={message.image_url} 
                alt="Shared image" 
                className="max-w-full rounded-lg"
              />
              {(message.decrypted_content || message.encrypted_content) !== 'Image' && (
                <p className="mt-2">{message.decrypted_content || message.encrypted_content}</p>
              )}
            </div>
          ) : (
            <div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <Input
                    ref={inputRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className={cn(
                      "flex-1 bg-transparent border-gray-300 dark:border-gray-600 text-sm",
                      isOwn ? "text-white placeholder-blue-100" : "text-gray-900 dark:text-white"
                    )}
                    placeholder="Edit message..."
                  />
                  <Button 
                    size="sm" 
                    onClick={handleEdit} 
                    className="p-1 h-6 w-6"
                    variant={isOwn ? "secondary" : "default"}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCancelEdit} 
                    className="p-1 h-6 w-6"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {message.decrypted_content || message.encrypted_content}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center space-x-1">
              <p className={cn(
                "text-xs",
                isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
              )}>
                {format(new Date(message.created_at), 'HH:mm')}
              </p>
              
              {message.is_edited && (
                <span className={cn(
                  "text-xs",
                  isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                )}>
                  (edited)
                </span>
              )}
              
              {isOwn && (
                <div className="flex items-center space-x-1">
                  {!isDelivered ? (
                    <Clock className="w-3 h-3 text-blue-200 animate-pulse" />
                  ) : (
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-blue-200 rounded-full"></div>
                      <div className="w-1 h-1 bg-blue-200 rounded-full"></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isOwn && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 p-1 ml-2 h-6 w-6 transition-opacity"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}