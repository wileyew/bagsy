import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingDots } from "@/components/ui/loading-dots";

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          return;
        }

        if (data.session) {
          // Successfully authenticated, redirect to home
          navigate("/", { replace: true });
        } else {
          // No session found, redirect to home
          navigate("/", { replace: true });
        }
      } catch (err: any) {
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
