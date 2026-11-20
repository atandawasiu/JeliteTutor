import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Loader2, MessageCircle, Send, Trash2, Pin, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { awardPoints } from "@/lib/gamification";
import { cn } from "@/lib/utils";

type Thread = {
  id: string; title: string; body: string; category: string; author_id: string;
  pinned: boolean; locked: boolean; created_at: string; view_count: number;
  author_name?: string; like_count?: number; liked_by_me?: boolean;
};
type Reply = { id: string; body: string; author_id: string; created_at: string; author_name?: string };

export const Route = createFileRoute("/community/$threadId")({
  component: ThreadPage,
});

function AiHelpBox({ question }: { question: string }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const PROJECT_ID = "xdkmreqkkcwujimdhbrq";

  const ask = async () => {
    if (!user) { toast.error("Log in to use AI help"); return; }
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token ?? ANON_KEY}`, "apikey": ANON_KEY },
        body: JSON.stringify({ messages: [{ role: "user", content: `Explain this question clearly with a step-by-step solution:\n\n${question}` }] }),
      });
      if (!res.ok) { setAnswer("AI is temporarily unavailable. Try again later."); return; }
      const data = await res.json();
      setAnswer(data.choices?.[0]?.message?.content ?? data.content ?? "No response");
    } catch { setAnswer("Could not reach AI service."); }
    finally { setLoading(false); }
  };

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-primary">AI Assistant</p>
        </div>
        {open && <button onClick={() => { setOpen(false); setAnswer(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Get a step-by-step AI explanation of this thread topic</p>
          <Button size="sm" onClick={() => { setOpen(true); ask(); }} className="bg-gradient-hero text-white gap-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </Button>
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating explanation…
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">{answer}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const [{ data: t }, { data: rs }, { data: likes }] = await Promise.all([
      supabase.from("forum_threads").select("*").eq("id", threadId).maybeSingle(),
      supabase.from("forum_replies").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }),
      supabase.from("forum_likes").select("user_id").eq("thread_id", threadId),
    ]);
    if (!t) { setLoading(false); return; }
    const authorIds = Array.from(new Set([t.author_id, ...(rs ?? []).map((r) => r.author_id)]));
    const { data: profs } = await supabase.from("profiles_public" as never).select("id, full_name").in("id", authorIds) as { data: { id: string; full_name: string | null }[] | null };
    const m = new Map(profs?.map((p) => [p.id, p.full_name ?? "Anonymous"]) ?? []);
    setThread({
      ...t,
      author_name: m.get(t.author_id),
      like_count: likes?.length ?? 0,
      liked_by_me: !!user && (likes ?? []).some((l) => l.user_id === user.id),
    } as Thread);
    setReplies((rs ?? []).map((r) => ({ ...r, author_name: m.get(r.author_id) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`thread_${threadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies", filter: `thread_id=eq.${threadId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_likes", filter: `thread_id=eq.${threadId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads", filter: `id=eq.${threadId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, user?.id]);

  const reply = async (): Promise<void> => {
    if (!user) {
      toast.error("Log in to reply");
      return;
    }
    if (body.trim().length < 2) return;
    if (thread?.locked) {
      toast.error("This thread is locked");
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("forum_replies").insert({ thread_id: threadId, author_id: user.id, body: body.trim() });
    if (error) { toast.error(error.message); setPosting(false); return; }
    await awardPoints(user.id, 2, "Replied to a discussion");
    if (thread && thread.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: thread.author_id,
        title: "New reply on your thread",
        body: `${user.user_metadata?.full_name ?? "Someone"} replied to "${thread.title}"`,
        link: `/community/${threadId}`,
      });
    }
    setBody(""); setPosting(false); toast.success("+2 pts");
  };

  const toggleLike = async (): Promise<void> => {
    if (!user || !thread) {
      toast.error("Log in to like");
      return;
    }
    const { error } = thread.liked_by_me
      ? await supabase.from("forum_likes").delete().eq("user_id", user.id).eq("thread_id", thread.id)
      : await supabase.from("forum_likes").insert({ user_id: user.id, thread_id: thread.id });
    if (error) toast.error("Your like couldn't be updated. Please try again.");
    else toast.success(thread.liked_by_me ? "Like removed" : "Discussion liked");
  };

  const deleteThread = async () => {
    if (!confirm("Delete this thread?")) return;
    const { error } = await supabase.from("forum_threads").delete().eq("id", threadId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    navigate({ to: "/community" });
  };

  const deleteReply = async (id: string) => {
    const { error } = await supabase.from("forum_replies").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Reply deleted");
  };

  const toggleLock = async () => {
    if (!thread) return;
    const nextLocked = !thread.locked;
    const { error } = await supabase.from("forum_threads").update({ locked: nextLocked }).eq("id", thread.id);
    if (error) toast.error(error.message);
    else toast.success(nextLocked ? "Thread locked" : "Thread unlocked");
  };
  const togglePin = async () => {
    if (!thread) return;
    const nextPinned = !thread.pinned;
    const { error } = await supabase.from("forum_threads").update({ pinned: nextPinned }).eq("id", thread.id);
    if (error) toast.error(error.message);
    else toast.success(nextPinned ? "Thread pinned" : "Thread unpinned");
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!thread) return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <p className="text-muted-foreground">Thread not found.</p>
      <Link to="/community"><Button variant="outline" className="mt-4">Back to community</Button></Link>
    </div>
  );

  const canMod = user && (user.id === thread.author_id || isAdmin);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/community" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to discussions
      </Link>

      <article className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {thread.pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
          {thread.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{thread.category}</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{thread.author_name}</span>
          <span>·</span>
          <span>{new Date(thread.created_at).toLocaleString()}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{thread.body}</p>

        <AiHelpBox question={`${thread.title}\n\n${thread.body}`} />

        <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
          <button onClick={toggleLike} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
            thread.liked_by_me ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-secondary")}>
            <Heart className={cn("h-4 w-4", thread.liked_by_me && "fill-current")} /> {thread.like_count}
          </button>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={togglePin}>{thread.pinned ? "Unpin" : "Pin"}</Button>
                <Button size="sm" variant="ghost" onClick={toggleLock}>{thread.locked ? "Unlock" : "Lock"}</Button>
              </>
            )}
            {canMod && (
              <Button size="sm" variant="ghost" onClick={deleteThread} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </article>

      <h2 className="mt-8 mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <MessageCircle className="h-5 w-5" /> Replies ({replies.length})
      </h2>

      <div className="space-y-3">
        {replies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No replies yet — be the first.</p>
        ) : replies.map((r) => {
          const canDelete = user && (user.id === r.author_id || isAdmin);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{r.author_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                {canDelete && (
                  <button onClick={() => deleteReply(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
            </div>
          );
        })}
      </div>

      {!thread.locked && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={user ? "Write a reply…" : "Log in to reply"} disabled={!user} rows={3} maxLength={2000} />
          <div className="mt-2 flex justify-end">
            <Button onClick={reply} disabled={!user || posting || body.trim().length < 2} className="gap-2 bg-gradient-hero text-white">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
