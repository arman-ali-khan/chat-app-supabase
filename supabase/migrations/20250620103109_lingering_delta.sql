/*
  # Completely disable RLS and ensure public access
  
  This migration ensures that RLS is completely disabled and all necessary
  permissions are granted for the custom authentication system.
  
  1. Force disable RLS on all tables
  2. Grant all necessary permissions to public/anon role
  3. Ensure sequences are accessible
*/

-- Force disable RLS on all tables (in case previous migration didn't work)
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS typing_status DISABLE ROW LEVEL SECURITY;

-- Drop any remaining policies that might be causing issues
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users';
    END LOOP;
    
    -- Drop all policies on chat_rooms table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'chat_rooms') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON chat_rooms';
    END LOOP;
    
    -- Drop all policies on messages table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'messages') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON messages';
    END LOOP;
    
    -- Drop all policies on typing_status table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'typing_status') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON typing_status';
    END LOOP;
END $$;

-- Grant all permissions to public role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO public;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO public;

-- Specifically grant permissions on our tables
GRANT ALL ON users TO public;
GRANT ALL ON chat_rooms TO public;
GRANT ALL ON messages TO public;
GRANT ALL ON typing_status TO public;

-- Grant usage and select on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO public;

-- Ensure anon role has the same permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon;

GRANT ALL ON users TO anon;
GRANT ALL ON chat_rooms TO anon;
GRANT ALL ON messages TO anon;
GRANT ALL ON typing_status TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;