'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Edit, Trash2, Reply, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: any;
  currentUserId: string;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (messageId: string) => void;
}

export function MessageBubble({ 
  message, 
  currentUserId, 
  onEdit, 
  onDelete, 
  onReply 
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.decrypted_content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const isOwn = message.sender_id === currentUserId;
  const isDeleted = message.is_deleted;

  const handleEdit = () => {
    if (editText.trim() && editText !== message.decrypted_content) {
      onEdit(message.id, editText);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.decrypted_content);
    setIsEditing(false);
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
    <div className={cn("flex mb-4", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-xs lg:max-w-md", isOwn ? "flex-row-reverse" : "flex-row")}>
        {!isOwn && (
          <Avatar className="w-8 h-8 mr-2">
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">
              {message.sender?.display_name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={cn(
          "px-4 py-2 rounded-2xl relative group",
          isOwn 
            ? "bg-blue-500 text-white rounded-br-md" 
            : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-600"
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
              {message.decrypted_content !== 'Image' && (
                <p className="mt-2">{message.decrypted_content}</p>
              )}
            </div>
          ) : (
            <div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1 bg-transparent border-gray-300 dark:border-gray-600"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleEdit} className="p-1">
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="p-1">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {message.decrypted_content}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <p className={cn(
              "text-xs",
              isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
            )}>
              {format(new Date(message.created_at), 'HH:mm')}
              {message.is_edited && (
                <span className="ml-1">(edited)</span>
              )}
            </p>

            {isOwn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 p-1 ml-2"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onReply(message.id)}>
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(message.id);
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}