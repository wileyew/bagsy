import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingDots } from "@/components/ui/loading-dots";

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('🔄 Auth callback page loaded');
      console.log('Current URL:', window.location.href);
      console.log('URL params:', window.location.search);
      
      try {
        // Check for error in URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (errorParam) {
          console.error('❌ OAuth error in URL:', { errorParam, errorDescription });
          setError(errorDescription || errorParam);
          return;
        }

        console.log('Getting session from Supabase...');
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Session response:', {
          hasSession: !!data.session,
          hasError: !!sessionError,
          userId: data.session?.user?.id,
          email: data.session?.user?.email,
          error: sessionError
        });
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (data.session) {
          console.log('✅ Session found! Redirecting to home...');
          // Successfully authenticated, redirect to home
          navigate("/", { replace: true });
        } else {
          console.warn('⚠️ No session found after OAuth. Redirecting home...');
          // No session found, redirect to home
          navigate("/", { replace: true });
        }
      } catch (err: any) {
        console.error('❌ Auth callback exception:', err);
        setError(err.message || "Authentication failed");
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="apple-button-primary px-6 py-2"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <LoadingDots size="lg" className="text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Completing sign in...</h1>
        <p className="text-muted-foreground">Please wait while we authenticate your account.</p>
      </div>
    </div>
  );
}
