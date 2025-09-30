import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';

export async function createUserProfile(userId: string, fullName?: string) {
  try {
    // First check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      console.log('User profile already exists:', userId);
      return { error: null };
    }

    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        full_name: fullName || null,
      });

    if (error) {
      // Handle specific error cases
      if (error.code === '23505') {
        // Duplicate key - profile already exists
        console.log('Profile already exists (duplicate key):', userId);
        return { error: null };
      }
      console.error('Error creating user profile:', error);
      return { error };
    }

    console.log('User profile created successfully:', userId);
    return { error: null };
  } catch (err) {
    console.error('Error creating user profile:', err);
    return { error: err };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return { data: null, error: err };
  }
}

export async function updateUserProfile(
  userId: string, 
  updates: Partial<TablesInsert<'profiles'>>
) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error updating user profile:', err);
    return { data: null, error: err };
  }
}
