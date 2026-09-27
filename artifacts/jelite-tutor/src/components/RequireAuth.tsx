import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function RequireAuth({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    else if (!loading && requireAdmin && !isAdmin) return;
  }, [user, loading, isAdmin, requireAdmin, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Checking your account</span>
      </div>
    );
  }

  if (!user || (requireAdmin && !isAdmin)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold">{user ? "Administrator access required" : "Sign in required"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user ? "Your account is signed in, but it is not authorized for the Jelite Tutor Admin Dashboard." : "Sign in with an authorized Jelite Tutor administrator account to continue."}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
