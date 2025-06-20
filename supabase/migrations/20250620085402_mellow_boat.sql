/*
  # Disable RLS for custom authentication system
  
  Since this application uses a custom authentication system instead of Supabase's built-in auth,
  we need to disable RLS entirely to allow public access to all tables.
  
  1. Disable RLS on all tables
  2. Remove all existing policies
  3. Allow public access to all operations
*/

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (they're no longer needed)
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow public user creation" ON users;
DROP POLICY IF EXISTS "Allow public user updates" ON users;
DROP POLICY IF EXISTS "Allow public access to chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Allow public access to messages" ON messages;
DROP POLICY IF EXISTS "Allow public access to typing status" ON typing_status;

-- Grant necessary permissions to the anon role
GRANT ALL ON users TO anon;
GRANT ALL ON chat_rooms TO anon;
GRANT ALL ON messages TO anon;
GRANT ALL ON typing_status TO anon;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;