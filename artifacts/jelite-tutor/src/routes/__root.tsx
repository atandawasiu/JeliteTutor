import { Outlet, Link, createRootRoute, useLocation, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SiteAnnouncementBanner } from "@/components/SiteAnnouncementBanner";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient-hero">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-lg bg-gradient-hero px-5 py-2.5 text-sm font-medium text-white shadow-hero hover:opacity-90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function RouteErrorComponent({ error }: { error: unknown }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Something unexpected happened.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Jelite Tutor</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">We couldn&apos;t load this page</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => router.invalidate()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Try again</button>
          <Link to="/" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Go home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RouteErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const location = useLocation();
  const isCBT = location.pathname.startsWith("/cbt/");

  return (
    <ThemeProvider>
      <AuthProvider>
        {!isCBT && <SiteAnnouncementBanner />}
        {!isCBT && <Header />}
        <main className="page-shell">
          <Outlet />
        </main>
        {!isCBT && <Footer />}
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
