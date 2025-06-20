import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: false, // Disable Supabase auth session since we're using custom auth
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          phone_number: string | null;
          avatar_url: string | null;
          last_seen: string;
          is_online: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          display_name: string;
          phone_number?: string | null;
          avatar_url?: string | null;
          last_seen?: string;
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          phone_number?: string | null;
          avatar_url?: string | null;
          last_seen?: string;
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_rooms: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user1_id: string;
          user2_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user1_id?: string;
          user2_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          chat_room_id: string;
          sender_id: string;
          encrypted_content: string;
          message_type: 'text' | 'image';
          image_url: string | null;
          reply_to_id: string | null;
          is_edited: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chat_room_id: string;
          sender_id: string;
          encrypted_content: string;
          message_type?: 'text' | 'image';
          image_url?: string | null;
          reply_to_id?: string | null;
          is_edited?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chat_room_id?: string;
          sender_id?: string;
          encrypted_content?: string;
          message_type?: 'text' | 'image';
          image_url?: string | null;
          reply_to_id?: string | null;
          is_edited?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      typing_status: {
        Row: {
          id: string;
          chat_room_id: string;
          user_id: string;
          is_typing: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chat_room_id: string;
          user_id: string;
          is_typing?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chat_room_id?: string;
          user_id?: string;
          is_typing?: boolean;
          updated_at?: string;
        };
      };
    };
  };
};