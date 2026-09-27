import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, BookOpen, Users, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jeliteTutorLogo from "@/assets/jelite-tutor-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const STATS = [
  { icon: Users, value: "100K+", label: "Active Students" },
  { icon: FileText, value: "500K+", label: "Practice Questions" },
  { icon: BookOpen, value: "12+", label: "Exams Covered" },
];

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast.error(error.message.includes("Invalid") ? "Incorrect email or password. Please try again." : error.message);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    let isAdmin = false;
    let isOnboarded = false;
    if (user) {
      const { data: account } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
      isAdmin = user.app_metadata?.role === "admin";
      isOnboarded = account?.onboarded ?? false;
    }
    setLoading(false);
    toast.success(isAdmin ? "Welcome back, Admin!" : "Welcome back!");
    navigate({ to: isAdmin ? "/admin" : isOnboarded ? "/dashboard" : "/welcome" });
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error("Enter your email address"); return; }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your inbox for a password reset link!");
    setForgotMode(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between bg-gradient-to-br from-[#0a3d2e] via-[#0d5c41] to-[#1a7a55] p-10 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/[0.02]" />

        <div className="relative">
          <Link to="/" className="flex items-center gap-3">
            <img src={jeliteTutorLogo} alt="Jelite Tutor" className="h-10 w-10 rounded-xl" />
            <span className="font-display text-2xl font-bold">Jelite Tutor</span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
              Your Path to <br />
              <span className="text-green-300">Exam Success</span>
            </h1>
            <p className="mt-4 text-lg text-white/70">
              Africa's leading platform for JAMB, WAEC, NECO, IELTS, SAT and 12+ exams. Practice smarter, score higher.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {STATS.map(s => (
              <div key={s.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <s.icon className="h-5 w-5 text-green-300 mb-2" />
                <p className="font-display text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              "AI-powered explanations for every question",
              "Timed mock exams that simulate real conditions",
              "Track your progress and weak areas",
              "Community support from fellow students",
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3 text-white/80">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Jelite Tutor. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <img src={jeliteTutorLogo} alt="Jelite Tutor" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-xl font-bold">Jelite Tutor</span>
          </Link>

          {forgotMode ? (
            <>
              <div className="mb-8">
                <h2 className="font-display text-2xl font-bold">Reset your password</h2>
                <p className="mt-2 text-sm text-muted-foreground">We'll send a reset link to your email address.</p>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email">Email Address</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reset-email" type="email" required placeholder="you@example.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="pl-10 h-11" />
                  </div>
                </div>
                <Button type="submit" disabled={resetting} className="w-full h-11 bg-gradient-hero text-white shadow-hero">
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                </Button>
                <button type="button" onClick={() => setForgotMode(false)} className="w-full text-center text-sm text-muted-foreground hover:text-primary">
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="font-display text-2xl font-bold">Welcome back</h2>
                <p className="mt-2 text-sm text-muted-foreground">Sign in to continue your exam preparation journey</p>
              </div>

              <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={loading} className="h-11 w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-semibold text-[#4285F4]">G</span>}
                Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or use email</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 gap-2 bg-gradient-hero text-white shadow-hero hover:opacity-90 text-base font-semibold"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">secure login</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>Your data is encrypted and protected</span>
              </div>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-semibold text-primary hover:underline">
                  Create one free
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
