/*
  # Fix user creation RLS policies

  1. Changes
    - Update RLS policy for users table to allow public user creation
    - This enables the signup flow to work properly by allowing unauthenticated users to create their profile
    
  2. Security
    - Still maintains security by ensuring users can only update their own profiles
    - Public can insert but authenticated users can only update their own data
*/

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Create a new policy that allows public user creation
CREATE POLICY "Allow public user creation" ON users
  FOR INSERT TO public WITH CHECK (true);

-- Ensure the update policy remains restrictive (users can only update their own profile)
-- This policy should already exist, but we'll recreate it to be sure
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);