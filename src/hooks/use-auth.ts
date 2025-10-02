import { useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { createUserProfile } from '@/lib/profile';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        error,
      });
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Create user profile if it doesn't exist
          try {
            await createUserProfile(session.user.id, session.user.user_metadata?.full_name);
          } catch (error) {
            console.error('Error creating user profile:', error);
            // Don't fail auth if profile creation fails
          }
        }
        
        // Handle all auth events properly
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        } else if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery initiated');
        }
        
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    // Don't update global loading state here - let the auth state change listener handle it
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Don't update global loading state here - let the auth state change listener handle it
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
    console.log('🔑 Calling Supabase OAuth with Google...', {
      provider: 'google',
      redirectTo: redirectUrl,
      currentUrl: window.location.href
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      },
    });

    console.log('Supabase OAuth response:', {
      hasData: !!data,
      hasError: !!error,
      provider: data?.provider,
      url: data?.url ? 'URL generated' : 'No URL',
      error: error
    });

    // Don't update global loading state here - let the auth state change listener handle it
    return { data, error };
  };

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    const { error } = await supabase.auth.signOut();
    
    setAuthState({
      user: null,
      session: null,
      loading: false,
      error,
    });

    return { error };
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    // Don't update global loading state here - this is a one-time operation
    return { data, error };
  };

  // Helper function to validate session with retry
  const validateSession = async (retries = 3): Promise<{ user: User | null; error: AuthError | null }> => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
          return { user: data.user, error: null };
        }
        if (i === retries - 1) {
          return { user: null, error };
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      } catch (err) {
        if (i === retries - 1) {
          return { user: null, error: err };
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    return { user: null, error: { message: 'Session validation failed after retries' } as AuthError };
  };

  return {
    ...authState,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    validateSession,
  };
}
