import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle, Plus, Loader2, Pin, Lock, Heart, MessageSquareReply,
  Users, ExternalLink, Crown, CheckCircle2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { awardPoints, awardBadge } from "@/lib/gamification";
import { cn } from "@/lib/utils";

type Thread = {
  id: string; title: string; body: string; category: string;
  pinned: boolean; locked: boolean; view_count: number;
  author_id: string; created_at: string;
  reply_count?: number; like_count?: number; liked_by_me?: boolean; author_name?: string;
};

type WAGroup = {
  id: string; title: string; body: string;
  pinned: boolean; author_id: string; created_at: string;
  author_name?: string;
  link?: string; description?: string; examFocus?: string;
};

const CATEGORIES = ["general", "JAMB", "WAEC", "NECO", "IELTS", "SAT", "Schools", "Help"];
const EXAM_FOCUSES = ["General", "JAMB", "WAEC", "NECO", "IELTS", "SAT", "GRE", "All Exams"];

const PLAN_FEATURES = {
  free: ["View all discussions", "Reply to any thread", "Like posts", "View WhatsApp groups"],
  premium: ["Everything in Free", "Start new discussions", "Submit WhatsApp study groups", "Priority leaderboard ranking", "Unlimited AI help"],
};

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Crown className="h-2.5 w-2.5" /> PREMIUM
    </span>
  );
}

function UpgradeNudge({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-center dark:border-amber-900 dark:bg-amber-950/30">
      <Crown className="mx-auto mb-2 h-6 w-6 text-amber-500" />
      <p className="text-sm font-semibold text-foreground">{feature}</p>
      <p className="mt-1 text-xs text-muted-foreground">This feature requires a Premium plan.</p>
      <Link to="/pricing">
        <Button size="sm" className="mt-3 gap-1.5 bg-gradient-hero text-white">
          <Crown className="h-3.5 w-3.5" /> Upgrade to Premium
        </Button>
      </Link>
    </div>
  );
}

function CommunityPage() {
  const { user, profile } = useAuth();
  const isPremium = profile?.plan === "premium";

  /* ── Discussions ─────────────────────────── */
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  /* ── WhatsApp Groups ─────────────────────── */
  const [waGroups, setWaGroups] = useState<WAGroup[]>([]);
  const [waLoading, setWaLoading] = useState(true);
  const [waOpen, setWaOpen] = useState(false);
  const [waForm, setWaForm] = useState({ name: "", link: "", description: "", examFocus: "General" });
  const [waSubmitting, setWaSubmitting] = useState(false);

  /* ── Load discussions ─────────────────────── */
  const load = async () => {
    let q = supabase
      .from("forum_threads")
      .select("*")
      .neq("category", "WhatsApp")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    if (filter !== "all") q = q.eq("category", filter);
    const { data } = await q;
    const list = (data ?? []) as Thread[];

    const ids = list.map((t) => t.id);
    const authorIds = Array.from(new Set(list.map((t) => t.author_id)));

    const [{ data: replies }, { data: likes }, { data: profs }] = await Promise.all([
      ids.length ? supabase.from("forum_replies").select("thread_id").in("thread_id", ids) : Promise.resolve({ data: [] as { thread_id: string }[] }),
      ids.length ? supabase.from("forum_likes").select("thread_id, user_id").in("thread_id", ids) : Promise.resolve({ data: [] as { thread_id: string | null; user_id: string }[] }),
      authorIds.length
        ? (supabase.from("profiles_public" as never).select("id, full_name").in("id", authorIds) as unknown as Promise<{ data: { id: string; full_name: string | null }[] }>)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ]);

    const replyMap = new Map<string, number>();
    (replies ?? []).forEach((r) => replyMap.set(r.thread_id, (replyMap.get(r.thread_id) ?? 0) + 1));
    const likeMap = new Map<string, number>();
    const likedBy = new Set<string>();
    (likes ?? []).forEach((l) => {
      if (!l.thread_id) return;
      likeMap.set(l.thread_id, (likeMap.get(l.thread_id) ?? 0) + 1);
      if (user && l.user_id === user.id) likedBy.add(l.thread_id);
    });
    const profMap = new Map(profs?.map((p) => [p.id, p.full_name ?? "Anonymous"]) ?? []);

    setThreads(list.map((t) => ({
      ...t,
      reply_count: replyMap.get(t.id) ?? 0,
      like_count: likeMap.get(t.id) ?? 0,
      liked_by_me: likedBy.has(t.id),
      author_name: profMap.get(t.author_id) ?? "Anonymous",
    })));
    setLoading(false);
  };

  /* ── Load WhatsApp groups ─────────────────── */
  const loadWaGroups = async () => {
    setWaLoading(true);
    const { data } = await supabase
      .from("forum_threads")
      .select("id, title, body, pinned, author_id, created_at")
      .eq("category", "WhatsApp")
      .eq("pinned", true)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as { id: string; title: string; body: string; pinned: boolean; author_id: string; created_at: string }[];
    const authorIds = Array.from(new Set(rows.map((g) => g.author_id)));
    let profMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: profs } = await (supabase.from("profiles_public" as never).select("id, full_name").in("id", authorIds) as unknown as Promise<{ data: { id: string; full_name: string | null }[] }>);
      profMap = new Map((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Anonymous"]));
    }

    setWaGroups(rows.map((g) => {
      let link = "", description = "", examFocus = "General";
      try {
        const j = JSON.parse(g.body) as { link?: string; description?: string; examFocus?: string };
        link = j.link ?? "";
        description = j.description ?? "";
        examFocus = j.examFocus ?? "General";
      } catch {
        link = g.body;
      }
      return { ...g, author_name: profMap.get(g.author_id) ?? "Anonymous", link, description, examFocus };
    }));
    setWaLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`forum_realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_likes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user?.id]);

  useEffect(() => { loadWaGroups(); }, []);

  const create = async () => {
    if (!user) { toast.error("Log in to start a discussion"); return; }
    if (!isPremium) { toast.error("Premium plan required to start new discussions"); return; }
    if (title.trim().length < 5 || body.trim().length < 10) { toast.error("Title 5+ chars, body 10+ chars"); return; }
    setCreating(true);
    const { error } = await supabase.from("forum_threads").insert({
      author_id: user.id, title: title.trim(), body: body.trim(), category,
    });
    if (error) { toast.error(error.message); setCreating(false); return; }
    await awardPoints(user.id, 5, "Started a discussion");
    await awardBadge(user.id, "first_thread");
    toast.success("Discussion posted! +5 pts");
    setTitle(""); setBody(""); setCategory("general"); setOpen(false); setCreating(false);
  };

  const toggleLike = async (e: React.MouseEvent, t: Thread) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Log in to like"); return; }
    const { error } = t.liked_by_me
      ? await supabase.from("forum_likes").delete().eq("user_id", user.id).eq("thread_id", t.id)
      : await supabase.from("forum_likes").insert({ user_id: user.id, thread_id: t.id });
    if (error) toast.error("Your like couldn't be updated. Please try again.");
    else toast.success(t.liked_by_me ? "Like removed" : "Discussion liked");
  };

  const submitWaGroup = async () => {
    if (!user) { toast.error("Log in to submit a group"); return; }
    if (!isPremium) { toast.error("Premium plan required to submit WhatsApp groups"); return; }
    if (!waForm.name.trim()) { toast.error("Group name is required"); return; }
    if (!waForm.link.trim()) { toast.error("WhatsApp link is required"); return; }
    if (!waForm.link.includes("chat.whatsapp.com") && !waForm.link.includes("wa.me")) {
      toast.error("Please enter a valid WhatsApp group or invite link"); return;
    }
    setWaSubmitting(true);
    const body = JSON.stringify({
      link: waForm.link.trim(),
      description: waForm.description.trim(),
      examFocus: waForm.examFocus,
    });
    const { error } = await supabase.from("forum_threads").insert({
      author_id: user.id,
      title: waForm.name.trim(),
      body,
      category: "WhatsApp",
    });
    setWaSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Group submitted for review! Admin will approve it shortly.");
    setWaForm({ name: "", link: "", description: "", examFocus: "General" });
    setWaOpen(false);
  };

  const filtered = threads.filter((t) =>
    !search ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Community</h1>
        <p className="text-sm text-muted-foreground">Ask, share and discuss with thousands of students.</p>
      </div>

      {/* Plan info banner */}
      <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        {(["free", "premium"] as const).map((plan) => (
          <div key={plan} className={cn("rounded-xl p-3", plan === "premium" ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 col-span-2" : "bg-secondary col-span-2 sm:col-span-2")}>
            <p className={cn("text-xs font-bold uppercase tracking-wide mb-2", plan === "premium" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
              {plan === "premium" ? "👑 Premium" : "🆓 Free"}
              {profile?.plan === plan && <span className="ml-2 text-primary">← your plan</span>}
            </p>
            <ul className="space-y-1">
              {PLAN_FEATURES[plan].map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                  <CheckCircle2 className={cn("h-3 w-3 flex-none", plan === "premium" ? "text-amber-500" : "text-primary")} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Tabs defaultValue="discussions">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="discussions" className="flex-1 gap-1.5">
            <MessageCircle className="h-4 w-4" /> Discussions
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1 gap-1.5">
            <Users className="h-4 w-4" /> WhatsApp Groups
          </TabsTrigger>
        </TabsList>

        {/* ── DISCUSSIONS TAB ───────────────────── */}
        <TabsContent value="discussions">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              {!user ? "Log in to participate" : isPremium ? "You can start discussions & reply" : "Free plan — you can reply to discussions"}
            </p>
            <div className="flex items-center gap-2">
              {!user && (
                <Link to="/login">
                  <Button variant="outline" size="sm">Log in to reply</Button>
                </Link>
              )}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="gap-2 bg-gradient-hero text-white"
                    onClick={() => {
                      if (!user) { toast.error("Log in to start a discussion"); return; }
                      if (!isPremium) { toast.error("Premium plan required to start discussions"); return; }
                    }}
                  >
                    <Plus className="h-4 w-4" /> New thread
                    {!isPremium && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                  </Button>
                </DialogTrigger>
                {user && isPremium && (
                  <DialogContent>
                    <DialogHeader><DialogTitle>Start a discussion</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Title (be specific!)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <Textarea placeholder="Share your question or insight…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={3000} />
                      <Button onClick={create} disabled={creating} className="w-full bg-gradient-hero text-white">
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post discussion"}
                      </Button>
                    </div>
                  </DialogContent>
                )}
              </Dialog>
            </div>
          </div>

          {/* Search + filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search discussions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 max-w-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No discussions yet</p>
              {isPremium ? (
                <p className="text-xs text-muted-foreground">Be the first to start one!</p>
              ) : (
                <p className="text-xs text-muted-foreground">Premium users can start discussions.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card transition-colors hover:border-primary/40 hover:shadow-sm">
                  <Link to="/community/$threadId" params={{ threadId: t.id }} className="block p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.pinned && <Pin className="h-3.5 w-3.5 text-accent flex-none" />}
                          {t.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground flex-none" />}
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{t.category}</span>
                        </div>
                        <h3 className="mt-1.5 font-semibold leading-snug hover:text-primary">{t.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium">{t.author_name}</span>
                          <span>·</span>
                          <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 flex-none">
                        <button
                          onClick={(e) => toggleLike(e, t)}
                          className={cn("flex flex-col items-center gap-0.5 rounded-lg p-2 transition-colors",
                            t.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive")}
                        >
                          <Heart className={cn("h-4 w-4", t.liked_by_me && "fill-current")} />
                          <span className="text-xs font-semibold">{t.like_count}</span>
                        </button>
                        <div className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs font-semibold">{t.reply_count}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
                    <span className="text-xs text-muted-foreground">
                      {t.locked ? "🔒 Thread locked" : t.reply_count === 0 ? "Be the first to reply!" : `${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"}`}
                    </span>
                    <Link
                      to="/community/$threadId"
                      params={{ threadId: t.id }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        t.locked
                          ? "text-muted-foreground"
                          : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                      )}
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      {t.locked ? "View thread" : user ? "Reply" : "View & Reply"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── WHATSAPP GROUPS TAB ───────────────── */}
        <TabsContent value="whatsapp">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <span className="text-xl">💬</span> Study WhatsApp Groups
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Join student-run WhatsApp groups for your exam. All groups are reviewed by admins before appearing here.
              </p>
            </div>
            <Dialog open={waOpen} onOpenChange={setWaOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gap-2 bg-gradient-hero text-white"
                  onClick={() => {
                    if (!user) { toast.error("Log in to submit a group"); return; }
                    if (!isPremium) { toast.error("Premium plan required to submit WhatsApp groups"); return; }
                  }}
                >
                  <Plus className="h-4 w-4" /> Submit a Group
                  <PremiumBadge />
                </Button>
              </DialogTrigger>
              {user && isPremium ? (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit a WhatsApp Study Group</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground -mt-2">Your group will be reviewed by an admin before it appears publicly.</p>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Group Name</label>
                      <Input
                        placeholder="e.g. JAMB 2025 Chemistry Prep"
                        value={waForm.name}
                        onChange={(e) => setWaForm((f) => ({ ...f, name: e.target.value }))}
                        maxLength={100}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">WhatsApp Group Link</label>
                      <Input
                        placeholder="https://chat.whatsapp.com/..."
                        value={waForm.link}
                        onChange={(e) => setWaForm((f) => ({ ...f, link: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Exam Focus</label>
                      <Select value={waForm.examFocus} onValueChange={(v) => setWaForm((f) => ({ ...f, examFocus: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{EXAM_FOCUSES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                      <Textarea
                        placeholder="What topics does this group cover? Any rules?"
                        value={waForm.description}
                        onChange={(e) => setWaForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        maxLength={500}
                        className="mt-1"
                      />
                    </div>
                    <Button onClick={submitWaGroup} disabled={waSubmitting} className="w-full bg-gradient-hero text-white">
                      {waSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit for Review
                    </Button>
                  </div>
                </DialogContent>
              ) : user && !isPremium ? (
                <DialogContent>
                  <UpgradeNudge feature="Submit a WhatsApp Study Group" />
                </DialogContent>
              ) : null}
            </Dialog>
          </div>

          {!isPremium && user && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center gap-3 dark:border-amber-900 dark:bg-amber-950/20">
              <Crown className="h-4 w-4 text-amber-500 flex-none" />
              <p className="text-xs text-foreground">
                <span className="font-semibold">Upgrade to Premium</span> to submit your own WhatsApp study group.{" "}
                <Link to="/pricing" className="text-primary underline">See plans →</Link>
              </p>
            </div>
          )}

          {waLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : waGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No WhatsApp groups yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isPremium ? "Be the first to submit one!" : "Upgrade to Premium to submit a group."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {waGroups.map((g) => (
                <div key={g.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug line-clamp-2">{g.title}</h3>
                      {g.examFocus && g.examFocus !== "General" && (
                        <Badge variant="secondary" className="mt-1.5 text-[10px]">{g.examFocus}</Badge>
                      )}
                    </div>
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 text-lg">
                      💬
                    </div>
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{g.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">Shared by {g.author_name} · {new Date(g.created_at).toLocaleDateString()}</p>
                    {g.link && (
                      <a
                        href={g.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        Join Group <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">📋 WhatsApp Group Rules</p>
            <p className="mt-1 text-xs">All groups must be study-focused. No spam or unrelated links. Groups violating these rules will be removed.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
