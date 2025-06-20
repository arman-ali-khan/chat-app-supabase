/*
  # Create chat application schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique, lowercase)
      - `display_name` (text, original case username)
      - `phone_number` (text, optional)
      - `avatar_url` (text, optional)
      - `last_seen` (timestamp)
      - `is_online` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `chat_rooms`
      - `id` (uuid, primary key)
      - `user1_id` (uuid, foreign key)
      - `user2_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `messages`
      - `id` (uuid, primary key)
      - `chat_room_id` (uuid, foreign key)
      - `sender_id` (uuid, foreign key)
      - `encrypted_content` (text)
      - `message_type` (enum: text, image)
      - `image_url` (text, optional)
      - `reply_to_id` (uuid, optional, foreign key)
      - `is_edited` (boolean)
      - `is_deleted` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `typing_status`
      - `id` (uuid, primary key)
      - `chat_room_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `is_typing` (boolean)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for chat room participants to access messages
    
  3. Indexes
    - Add indexes for performance on frequently queried columns
*/

-- Create custom types
CREATE TYPE message_type_enum AS ENUM ('text', 'image');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  phone_number text,
  avatar_url text,
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content text NOT NULL,
  message_type message_type_enum DEFAULT 'text',
  image_url text,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create typing_status table
CREATE TABLE IF NOT EXISTS typing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_typing boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_room_id, user_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view all users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- RLS Policies for chat_rooms
CREATE POLICY "Users can view their chat rooms" ON chat_rooms
  FOR SELECT TO authenticated USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

CREATE POLICY "Users can create chat rooms" ON chat_rooms
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

CREATE POLICY "Users can update their chat rooms" ON chat_rooms
  FOR UPDATE TO authenticated USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their chat rooms" ON messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = messages.chat_room_id 
      AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their chat rooms" ON messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = messages.chat_room_id 
      AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE TO authenticated USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- RLS Policies for typing_status
CREATE POLICY "Users can view typing status in their chat rooms" ON typing_status
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = typing_status.chat_room_id 
      AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage their own typing status" ON typing_status
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_users ON chat_rooms(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_room ON messages(chat_room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_chat_room ON typing_status(chat_room_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_typing_status_updated_at BEFORE UPDATE ON typing_status
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();