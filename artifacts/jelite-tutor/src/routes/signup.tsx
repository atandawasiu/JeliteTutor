import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, Phone, GraduationCap, MapPin, CheckCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { recordActivity } from "@/lib/activity";
import { toast } from "sonner";
import jeliteTutorLogo from "@/assets/jelite-tutor-logo.png";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const FEATURES = [
  "Unlimited practice for JAMB, WAEC, NECO & more",
  "AI-powered step-by-step explanations",
  "Real-time CBT exam simulator",
  "Track progress and identify weak areas",
  "Community of 100,000+ exam students",
  "Free forever — no credit card needed",
];

function SignupPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [targetExam, setTargetExam] = useState("jamb");
  const [targetCourse, setTargetCourse] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const { signUp, signInWithGoogle } = useAuth();

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };
  const navigate = useNavigate();

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { toast.error("Name and email are required"); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setLoading(true);
  const { error } = await signUp(email, password, name);
  if (error) {
      setLoading(false);
      toast.error(error.message.includes("already") ? "An account with this email already exists. Please log in." : error.message);
      return;
    }
    try {
      await new Promise(r => setTimeout(r, 500));
      const { data: { user } } = await supabase.auth.getUser();
  if (user) {
  await recordActivity("account_created", { country, targetCourse });
  await supabase.from("profiles").update({
          whatsapp: whatsapp || null,
          country,
          target_course: targetCourse || null,
        }).eq("id", user.id);

        if (newsletter) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("newsletter_subscribers") as any).upsert({
            email: email.trim().toLowerCase(),
            user_id: user.id,
          }, { onConflict: "email" });
        }
      }
    } catch { /* non-blocking */ }
    setLoading(false);
    toast.success("Account created! Welcome to Jelite Tutor.");
    navigate({ to: "/welcome" });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] flex-col justify-between bg-gradient-to-br from-[#0a3d2e] via-[#0d5c41] to-[#1a7a55] p-10 text-white relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative">
          <Link to="/" className="flex items-center gap-3">
            <img src={jeliteTutorLogo} alt="Jelite Tutor" className="h-10 w-10 rounded-xl" />
            <span className="font-display text-2xl font-bold">Jelite Tutor</span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight xl:text-4xl">
              Join 100,000+ students <br />
              <span className="text-green-300">achieving their dreams</span>
            </h1>
            <p className="mt-4 text-white/70">
              Start your free account today and access Africa's most comprehensive exam preparation platform.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
                <span className="text-sm text-white/85">{f}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm italic text-white/80">"Jelite Tutor helped me score 312 in JAMB. The practice questions are exactly like the real exam!"</p>
            <p className="mt-3 text-xs font-semibold text-green-300">— Chinedu O., University of Lagos (2024)</p>
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Jelite Tutor. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <img src={jeliteTutorLogo} alt="Jelite Tutor" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-xl font-bold">Jelite Tutor</span>
          </Link>

          {/* Progress indicator */}
          <div className="mb-8 flex items-center gap-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= i ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                  {step > i ? <CheckCircle className="h-4 w-4" /> : i}
                </div>
                <span className={`text-sm ${step >= i ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {i === 1 ? "Your Info" : "Set Password"}
                </span>
                {i < 2 && <div className={`h-px w-8 ${step > i ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold">Create your account</h2>
                <p className="mt-1 text-sm text-muted-foreground">Free forever — no credit card required</p>
              </div>

              <Button type="button" variant="outline" onClick={handleGoogleSignUp} disabled={loading} className="mb-5 h-11 w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-semibold text-[#4285F4]">G</span>}
                Continue with Google
              </Button>

              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or create with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="name" required placeholder="e.g. Adaeze Okafor" value={name} onChange={e => setName(e.target.value)} className="pl-10 h-11" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="whatsapp" type="tel" placeholder="+234..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="pl-10 h-11" />
                    </div>
                  </div>
                  <div>
                    <Label>Country</Label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="pl-10 h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Nigeria", "Ghana", "Kenya", "South Africa", "Cameroon", "Uganda", "Tanzania", "Ethiopia", "Rwanda", "Other"].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Exam</Label>
                    <Select value={targetExam} onValueChange={setTargetExam}>
                      <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[
                          ["jamb", "JAMB UTME"], ["waec", "WAEC SSCE"], ["neco", "NECO"],
                          ["gce", "WAEC GCE"], ["ielts", "IELTS"], ["sat", "SAT"], ["gre", "GRE"],
                        ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="course">Course Interest</Label>
                    <div className="relative mt-1.5">
                      <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="course" placeholder="e.g. Medicine" value={targetCourse} onChange={e => setTargetCourse(e.target.value)} className="pl-10 h-11" />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                  <input
                    type="checkbox"
                    id="newsletter"
                    checked={newsletter}
                    onChange={e => setNewsletter(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <label htmlFor="newsletter" className="text-xs text-muted-foreground cursor-pointer">
                    Subscribe to Jelite Tutor updates — exam tips, news, and study resources. Unsubscribe anytime.
                  </label>
                </div>

                <Button type="submit" className="w-full h-11 bg-gradient-hero text-white shadow-hero text-base font-semibold">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold">Set your password</h2>
                <p className="mt-1 text-sm text-muted-foreground">For <span className="font-medium text-foreground">{email}</span></p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                    />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= (i + 1) * 3 ? (password.length >= 12 ? "bg-success" : password.length >= 8 ? "bg-chart-4" : "bg-destructive") : "bg-secondary"
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Re-type your password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={`pl-10 h-11 ${confirm && confirm !== password ? "border-destructive" : confirm && confirm === password ? "border-success" : ""}`}
                    />
                    {confirm && confirm === password && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-secondary/50 px-3 py-2">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>By creating an account, you agree to our <Link to="/terms" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link></span>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-11 px-5">
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 h-11 bg-gradient-hero text-white shadow-hero text-base font-semibold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Account <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </div>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
