import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Megaphone, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: string;
  active: boolean;
  expires_at: string | null;
  sort_order: number;
};

const TYPES = [
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "promo", label: "Promo" },
];

const empty = { title: "", body: "", type: "info", active: true, expires_at: "", sort_order: 0 };

// datetime-local helpers
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function AnnouncementsManagerFull() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, type, active, expires_at, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`admin-announcements-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    if (!form.title || !form.body) { toast.error("Title and body required"); return; }
    const payload = {
      title: form.title, body: form.body, type: form.type, active: form.active,
      sort_order: form.sort_order, expires_at: fromLocalInput(form.expires_at),
    };
    if (editingId) {
      const { error } = await supabase.from("announcements").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement updated — live now");
    } else {
      const { error } = await supabase.from("announcements").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement created — live now");
    }
    setForm(empty); setEditingId(null);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title, body: a.body, type: a.type, active: a.active,
      expires_at: toLocalInput(a.expires_at), sort_order: a.sort_order,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const toggle = async (a: Announcement) => {
    const active = !a.active;
    const { error } = await supabase.from("announcements").update({ active }).eq("id", a.id);
    if (error) toast.error(error.message);
    else toast.success(active ? "Announcement activated" : "Announcement paused");
  };

  const move = async (a: Announcement, dir: number) => {
    const idx = items.findIndex(i => i.id === a.id);
    const swap = items[idx + dir];
    if (!swap) return;
    const results = await Promise.all([
      supabase.from("announcements").update({ sort_order: swap.sort_order }).eq("id", a.id),
      supabase.from("announcements").update({ sort_order: a.sort_order }).eq("id", swap.id),
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) toast.error(error.message);
    else toast.success("Announcement order updated");
  };

  const isExpired = (a: Announcement) => a.expires_at && new Date(a.expires_at).getTime() < Date.now();

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display font-semibold flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> {editingId ? "Edit announcement" : "New announcement"}
        </h3>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
          <div><Label>Body</Label><Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="mt-1" rows={3} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value || 0 })} className="mt-1" /></div>
          </div>
          <div>
            <Label>Schedule expiry (optional)</Label>
            <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="mt-1" />
            <p className="mt-1 text-[11px] text-muted-foreground">Banner auto-hides after this moment. Leave empty to run forever.</p>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Published (active)</Label></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 bg-gradient-hero text-white">{editingId ? "Save changes" : "Publish announcement"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setForm(empty); setEditingId(null); }}>Cancel</Button>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display font-semibold">Announcements ({items.length})</h3>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {items.map((a, idx) => (
              <div key={a.id} className="rounded-lg bg-secondary p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.type === 'warning' ? 'bg-destructive/10 text-destructive' : a.type === 'success' ? 'bg-success/10 text-success' : a.type === 'promo' ? 'bg-gradient-hero text-white' : 'bg-primary/10 text-primary'}`}>{a.type}</span>
                      {!a.active && <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">unpublished</span>}
                      {isExpired(a) && <span className="text-[10px] px-1.5 rounded bg-destructive/10 text-destructive">expired</span>}
                      <span className="text-[10px] text-muted-foreground">order {a.sort_order}</span>
                    </div>
                    <p className="font-medium text-sm mt-1">{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                    {a.expires_at && <p className="text-[10px] text-muted-foreground mt-1">⏱ expires {new Date(a.expires_at).toLocaleString()}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => move(a, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(a, 1)} disabled={idx === items.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => toggle(a)} title={a.active ? "Unpublish" : "Publish"}>{a.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
