import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const { signIn, signUp, signInWithGoogle, resetPassword, error } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (mode === "signin") {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        onOpenChange(false);
      } else if (mode === "signup") {
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
        setMode("signin");
      } else if (mode === "forgot") {
        const { error } = await resetPassword(formData.email);
        if (error) throw error;
        toast({
          title: "Reset email sent!",
          description: "Check your email for password reset instructions.",
        });
        setMode("signin");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({
        title: "Authentication error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🔐 Initiating Google sign-in...');
    console.log('Current origin:', window.location.origin);
    console.log('Expected redirect:', `${window.location.origin}/auth/callback`);
    
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      
      console.log('Google sign-in response:', {
        hasData: !!data,
        hasError: !!error,
        data,
        error
      });
      
      if (error) {
        console.error('❌ Google sign-in error:', error);
        throw error;
      }
      
      console.log('✅ Google sign-in initiated successfully');
      console.log('Redirecting to Google OAuth...');
      
      // Note: User will be redirected to Google, then back to /auth/callback
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign in with Google.";
      console.error('❌ Google sign-in exception:', err);
      
      toast({
        title: "Google sign-in error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false); // Only set to false on error, redirect will happen on success
    }
  };

  const resetForm = () => {
    setFormData({ email: "", password: "", fullName: "" });
    setShowPassword(false);
    setIsLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case "signin":
        return "Sign In";
      case "signup":
        return "Create Account";
      case "forgot":
        return "Reset Password";
      default:
        return "Sign In";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "signin":
        return "Welcome back to Bagsy";
      case "signup":
        return "Join Bagsy to start booking spaces";
      case "forgot":
        return "Enter your email to reset your password";
      default:
        return "Welcome back to Bagsy";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-md w-[calc(100%-1rem)] sm:w-full mx-2 sm:mx-4">
        <DialogHeader className="text-center space-y-3 sm:space-y-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
              {getTitle()}
            </DialogTitle>
            <p className="text-sm sm:text-base text-muted-foreground">
              {getDescription()}
            </p>
          </DialogHeader>

        {isLoading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div>
                <p className="font-medium">Signing you in...</p>
                <p className="text-xs mt-1 text-blue-700">
                  💡 Taking too long? Try: Sign in with <strong>incognito mode</strong>, clear cookies, or restart your browser
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full apple-button-secondary h-12"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Full Name Field (only for signup) */}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="apple-input pl-10 h-12"
                  required={mode === "signup"}
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="apple-input pl-10 h-12"
                required
              />
            </div>
          </div>

          {/* Password Field (not for forgot password) */}
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="apple-input pl-10 pr-10 h-12"
                  required={mode === "signin" || mode === "signup"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full apple-button-primary h-12"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Send Reset Email"
            )}
          </Button>

          {/* Mode Switching Links */}
          <div className="text-center space-y-2">
            {mode === "signin" && (
              <>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setMode("forgot");
                    resetForm();
                  }}
                  className="text-sm"
                >
                  Forgot your password?
                </Button>
                <div className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setMode("signup");
                      resetForm();
                    }}
                    className="p-0 h-auto font-medium"
                  >
                    Sign up
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && (
              <div className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setMode("signin");
                    resetForm();
                  }}
                  className="p-0 h-auto font-medium"
                >
                  Sign in
                </Button>
              </div>
            )}

            {mode === "forgot" && (
              <div className="text-sm text-muted-foreground">
                Remember your password?{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setMode("signin");
                    resetForm();
                  }}
                  className="p-0 h-auto font-medium"
                >
                  Sign in
                </Button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
