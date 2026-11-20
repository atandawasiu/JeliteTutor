import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type FL = { id: string; column_title: string; label: string; url: string; sort_order: number; visible: boolean };

export function FooterLinksManager() {
  const [items, setItems] = useState<FL[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ column_title: "", label: "", url: "/" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("footer_links").select("*").order("column_title").order("sort_order");
    setItems((data ?? []) as FL[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin-footer-links-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "footer_links" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const add = async () => {
    if (!form.column_title || !form.label) { toast.error("Column and label required"); return; }
    const colItems = items.filter((i) => i.column_title === form.column_title);
    const maxOrder = colItems.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error } = await supabase.from("footer_links").insert({ ...form, sort_order: maxOrder + 1 });
    if (error) toast.error(error.message); else { toast.success("Footer link added"); setForm({ ...form, label: "", url: "/" }); }
  };

  const update = async (id: string, patch: Partial<FL>) => {
    const { error } = await supabase.from("footer_links").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this footer link?")) return;
    const { error } = await supabase.from("footer_links").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const move = async (id: string, dir: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const siblings = items.filter((i) => i.column_title === item.column_title).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((s) => s.id === id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    const results = await Promise.all([
      supabase.from("footer_links").update({ sort_order: swap.sort_order }).eq("id", id),
      supabase.from("footer_links").update({ sort_order: item.sort_order }).eq("id", swap.id),
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) toast.error(error.message);
    else toast.success("Footer link order updated");
  };

  const grouped = new Map<string, FL[]>();
  for (const i of items) {
    const arr = grouped.get(i.column_title) ?? [];
    arr.push(i);
    grouped.set(i.column_title, arr);
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add Footer Link</h3>
        <div className="space-y-3">
          <div><Label>Column title</Label><Input value={form.column_title} onChange={(e) => setForm({ ...form, column_title: e.target.value })} className="mt-1" placeholder="e.g. Resources" /></div>
          <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-1" /></div>
          <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="mt-1" /></div>
          <Button onClick={add} className="w-full bg-gradient-hero text-white">Add</Button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : Array.from(grouped.entries()).map(([col, links]) => (
          <div key={col} className="rounded-2xl border border-border bg-card p-5">
            <h4 className="mb-3 font-display text-sm font-semibold flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> {col}</h4>
            <div className="space-y-2">
              {links.sort((a, b) => a.sort_order - b.sort_order).map((l, idx, arr) => (
                <div key={l.id} className={`flex items-center gap-2 rounded-lg p-2 ${l.visible ? "bg-secondary" : "bg-secondary/40 opacity-60"}`}>
                  <div className="flex flex-col">
                    <button disabled={idx === 0} onClick={() => move(l.id, -1)} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                    <button disabled={idx === arr.length - 1} onClick={() => move(l.id, 1)} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <Input value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} className="h-8 flex-1" />
                  <Input value={l.url} onChange={(e) => update(l.id, { url: e.target.value })} className="h-8 flex-1 font-mono text-xs" />
                  <Button size="icon" variant="ghost" onClick={() => update(l.id, { visible: !l.visible })}>
                    {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
