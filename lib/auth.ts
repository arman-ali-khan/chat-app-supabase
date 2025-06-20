import { supabase } from './supabase';
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  phoneNumber: z.string().optional(),
});

export type LoginData = z.infer<typeof loginSchema>;

export async function loginUser(data: LoginData) {
  const { username, phoneNumber } = data;
  const normalizedUsername = username.toLowerCase().trim();

  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let user;
    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          phone_number: phoneNumber || existingUser.phone_number,
          last_seen: new Date().toISOString(),
          is_online: true,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          username: normalizedUsername,
          display_name: username, // Keep original case for display
          phone_number: phoneNumber,
          is_online: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    }

    // Store user in localStorage
    localStorage.setItem('currentUser', JSON.stringify(user));
    return { user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem('currentUser');
  return userData ? JSON.parse(userData) : null;
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  const user = getCurrentUser();
  if (user) {
    // Update online status
    supabase
      .from('users')
      .update({ 
        is_online: false, 
        last_seen: new Date().toISOString() 
      })
      .eq('id', user.id);
  }
  localStorage.removeItem('currentUser');
}

export async function updateUserPresence(userId: string, isOnline: boolean) {
  const { error } = await supabase
    .from('users')
    .update({
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    })
    .eq('id', userId);

  return { error };
}