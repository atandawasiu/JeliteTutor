import { useEffect, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Comment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

export function BlogComments({ postId }: { postId: string }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_comments")
        .select("id, author_id, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((c) => c.author_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles_public" as never).select("id, full_name, avatar_url").in("id", ids) as { data: { id: string; full_name: string | null; avatar_url: string | null }[] | null }
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      const profMap = new Map(profs?.map((p) => [p.id, p]) ?? []);
      setComments((data ?? []).map((c) => ({ ...c, profiles: profMap.get(c.author_id) ?? null })) as Comment[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`blog_comments_${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "blog_comments", filter: `post_id=eq.${postId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  const submit = async (): Promise<void> => {
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }
    if (body.trim().length < 2) return;
    setPosting(true);
    const { error } = await supabase.from("blog_comments").insert({ post_id: postId, author_id: user.id, body: body.trim() });
    if (error) toast.error(error.message);
    else { setBody(""); toast.success("Comment posted"); }
    setPosting(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("blog_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Comment deleted");
  };

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-xl font-semibold">Comments ({comments.length})</h2>

      {user ? (
        <div className="mt-4 space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your thoughts…" rows={3} maxLength={1000} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={posting || body.trim().length < 2} className="gap-2 bg-gradient-hero text-white">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Log in</Link> to join the conversation.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Be the first to comment.</p>
        ) : (
          comments.map((c) => {
            const initial = (c.profiles?.full_name?.[0] ?? "?").toUpperCase();
            const canDelete = user && (user.id === c.author_id || isAdmin);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initial}</div>
                    <div>
                      <p className="text-sm font-medium">{c.profiles?.full_name ?? "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
