import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff, ArrowUp, ArrowDown, LayoutTemplate, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ContentBlock } from "@/hooks/useContentBlocks";

const BLOCK_TYPES = [
  { value: "hero", label: "Hero section" },
  { value: "faq", label: "FAQ item" },
  { value: "category", label: "Category" },
  { value: "widget", label: "Widget" },
  { value: "section", label: "Page section" },
  { value: "page", label: "Standalone page" },
];

const PAGES = ["home", "about", "pricing", "exams", "schools", "blog", "tools", "community"];

const empty = {
  block_key: "",
  block_type: "section",
  page_slug: "home",
  title: "",
  subtitle: "",
  body: "",
  image_url: "",
  link_url: "",
  link_label: "",
  icon: "",
  sort_order: 0,
  visible: true,
};

export function ContentBlocksManager() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPage, setFilterPage] = useState("home");
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_blocks")
      .select("*")
      .order("page_slug").order("block_type").order("sort_order");
    setBlocks((data ?? []) as ContentBlock[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`admin-content-blocks-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_blocks" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    if (!form.block_key || !form.title) { toast.error("Block key and title are required"); return; }
    const payload = {
      ...form,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      link_label: form.link_label || null,
      icon: form.icon || null,
    };
    if (editingId) {
      const { error } = await supabase.from("content_blocks").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Block updated");
    } else {
      const { error } = await supabase.from("content_blocks").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Block created");
    }
    setForm(empty); setEditingId(null);
  };

  const startEdit = (b: ContentBlock) => {
    setEditingId(b.id);
    setForm({
      block_key: b.block_key, block_type: b.block_type, page_slug: b.page_slug,
      title: b.title, subtitle: b.subtitle, body: b.body,
      image_url: b.image_url ?? "", link_url: b.link_url ?? "",
      link_label: b.link_label ?? "", icon: b.icon ?? "",
      sort_order: b.sort_order, visible: b.visible,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this content block?")) return;
    const { error } = await supabase.from("content_blocks").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const toggleVisible = async (b: ContentBlock) => {
    const visible = !b.visible;
    const { error } = await supabase.from("content_blocks").update({ visible }).eq("id", b.id);
    if (error) toast.error(error.message);
    else toast.success(visible ? "Content block published" : "Content block hidden");
  };

  const move = async (b: ContentBlock, dir: number) => {
    const peers = blocks.filter(x => x.page_slug === b.page_slug && x.block_type === b.block_type);
    const idx = peers.findIndex(p => p.id === b.id);
    const swap = peers[idx + dir];
    if (!swap) return;
    const results = await Promise.all([
      supabase.from("content_blocks").update({ sort_order: swap.sort_order }).eq("id", b.id),
      supabase.from("content_blocks").update({ sort_order: b.sort_order }).eq("id", swap.id),
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) toast.error(error.message);
    else toast.success("Content block order updated");
  };

  const filtered = blocks.filter(b =>
    b.page_slug === filterPage && (filterType === "all" || b.block_type === filterType)
  );

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold">Content Blocks (CMS)</h3>
          <span className="text-xs text-muted-foreground">— pages, hero, FAQ, categories, widgets</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Live preview
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h4 className="mb-4 font-display text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" /> {editingId ? "Edit block" : "New block"}
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Page</Label>
                <Select value={form.page_slug} onValueChange={v => setForm({ ...form, page_slug: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={form.block_type} onValueChange={v => setForm({ ...form, block_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{BLOCK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Block key (unique slug)</Label><Input value={form.block_key} onChange={e => setForm({ ...form, block_key: e.target.value })} className="mt-1" placeholder="home_faq_3" /></div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
            <div><Label>Subtitle</Label><Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className="mt-1" /></div>
            <div><Label>Body</Label><Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="mt-1" rows={4} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="mt-1" placeholder="https://..." /></div>
              <div><Label>Icon</Label><Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="mt-1" placeholder="Sparkles" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Link URL</Label><Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} className="mt-1" placeholder="/exams" /></div>
              <div><Label>Link label</Label><Input value={form.link_label} onChange={e => setForm({ ...form, link_label: e.target.value })} className="mt-1" placeholder="Learn more" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value || 0 })} className="mt-1" /></div>
              <div className="flex items-center gap-2 mb-1.5"><Switch checked={form.visible} onCheckedChange={v => setForm({ ...form, visible: v })} /><Label>Visible on site</Label></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="flex-1 bg-gradient-hero text-white">{editingId ? "Save changes" : "Create block"}</Button>
              {editingId && <Button variant="outline" onClick={() => { setForm(empty); setEditingId(null); }}>Cancel</Button>}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <h4 className="font-display text-sm font-semibold">Blocks</h4>
            <Select value={filterPage} onValueChange={setFilterPage}>
              <SelectTrigger className="ml-auto h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {BLOCK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.map((b, idx) => (
                <div key={b.id} className="rounded-lg bg-secondary p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{b.block_type}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{b.block_key}</span>
                        {!b.visible && <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">hidden</span>}
                      </div>
                      <p className="font-medium text-sm mt-1">{b.title || <em className="text-muted-foreground">(no title)</em>}</p>
                      {b.body && <p className="text-xs text-muted-foreground line-clamp-2">{b.body}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => move(b, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => move(b, 1)} disabled={idx === filtered.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleVisible(b)}>{b.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">No blocks for this page/type yet.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Live preview */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="font-display font-semibold text-sm">Live preview — homepage</span>
              <span className="text-xs text-muted-foreground">edits apply in real time</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)} className="gap-1.5">
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
          <iframe src="/" title="Live homepage preview" className="flex-1 w-full border-0" />
        </div>
      )}
    </div>
  );
}
