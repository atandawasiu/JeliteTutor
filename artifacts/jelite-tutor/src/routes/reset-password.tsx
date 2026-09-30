import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jeliteTutorLogo from "@/assets/jelite-tutor-logo.png";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setReady(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === "PASSWORD_RECOVERY" || session)) setReady(true);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error("We could not update your password. Please request a new link."); return; }
    toast.success("Password updated. Welcome back to Jelite Tutor.");
    navigate({ to: "/login" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-card p-7 shadow-sm sm:p-9">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <img src={jeliteTutorLogo} alt="Jelite Tutor" className="h-11 w-11 rounded-xl" />
          <span className="font-display text-2xl font-bold">Jelite Tutor</span>
        </Link>
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Lock className="h-5 w-5" /></div>
          <h1 className="font-display text-2xl font-bold">Create a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Secure your Jelite Tutor account and continue learning.</p>
        </div>
        {!ready ? (
          <div className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">This reset link is invalid or has expired. Request a new link from the login page.</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="mt-2" /></div>
            <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" className="mt-2" /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password</Button>
          </form>
        )}
        <p className="mt-7 text-center text-sm text-muted-foreground"><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </section>
    </main>
  );
}
