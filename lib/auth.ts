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
    console.log('Attempting to login user:', normalizedUsername);
    
    // First, try to find existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      throw fetchError;
    }

    let user;
    if (existingUser) {
      console.log('User exists, updating status');
      // Update existing user's online status and last seen
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

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
      user = updatedUser;
    } else {
      console.log('Creating new user');
      // Create new user - try with explicit ID first
      const userId = crypto.randomUUID();
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          username: normalizedUsername,
          display_name: username, // Keep original case for display
          phone_number: phoneNumber,
          is_online: true,
          last_seen: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        throw insertError;
      }
      user = newUser;
    }

    console.log('Login successful:', user);
    // Store user in localStorage
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Start presence heartbeat
    startPresenceHeartbeat(user.id);
    
    return { user, error: null };
  } catch (error) {
    console.error('Login error:', error);
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
    // Stop presence heartbeat
    stopPresenceHeartbeat();
    
    // Update online status
    supabase
      .from('users')
      .update({ 
        is_online: false, 
        last_seen: new Date().toISOString() 
      })
      .eq('id', user.id)
      .then(() => {
        console.log('User logged out successfully');
      })
      .catch((error) => {
        console.error('Error updating logout status:', error);
      });
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

// Presence heartbeat functionality
let presenceInterval: NodeJS.Timeout | null = null;

function startPresenceHeartbeat(userId: string) {
  // Clear any existing interval
  if (presenceInterval) {
    clearInterval(presenceInterval);
  }
  
  // Update presence every 10 seconds
  presenceInterval = setInterval(async () => {
    try {
      await updateUserPresence(userId, true);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, 10000);
  
  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden, mark as offline
      updateUserPresence(userId, false);
    } else {
      // Page is visible, mark as online
      updateUserPresence(userId, true);
    }
  };
  
  // Handle page unload
  const handleBeforeUnload = () => {
    updateUserPresence(userId, false);
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Store cleanup functions
  (window as any).cleanupPresence = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

function stopPresenceHeartbeat() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  
  // Cleanup event listeners
  if ((window as any).cleanupPresence) {
    (window as any).cleanupPresence();
  }
}