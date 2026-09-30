import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, BookOpen, BarChart3, FileText, Plus, Trash2, Loader2, School as SchoolIcon, Megaphone, Newspaper, Layers, Wifi, MenuIcon, ArrowUp, ArrowDown, Pencil, Eye, EyeOff, Shield, ShieldOff, Activity, LayoutTemplate, CheckSquare, Square, Copy, Check, FileSpreadsheet, RefreshCw, Pin, Lock, Mail, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { SiteSettingsManager } from "@/components/admin/SiteSettingsManager";
import { FooterLinksManager } from "@/components/admin/FooterLinksManager";
import { HealthCheck } from "@/components/admin/HealthCheck";
import { ContentBlocksManager } from "@/components/admin/ContentBlocksManager";
import { AnnouncementsManagerFull } from "@/components/admin/AnnouncementsManagerFull";
import { BulkQuestionImporter } from "@/components/admin/BulkQuestionImporter";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: () => <RequireAuth requireAdmin><AdminPanel /></RequireAuth>,
});

function useRealtime(table: string, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`admin-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}

function AdminPanel() {
  const [stats, setStats] = useState({ users: 0, exams: 0, questions: 0, attempts: 0, posts: 0, schools: 0, subscribers: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; event_type: string; metadata: Record<string, unknown>; created_at: string }>>([]);

  const reload = async () => {
    setStatsLoading(true);
    const [u, e, q, a, p, s, n] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("exams").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("*", { count: "exact", head: true }),
      supabase.from("attempts").select("*", { count: "exact", head: true }),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }),
      supabase.from("schools").select("*", { count: "exact", head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("newsletter_subscribers") as any).select("*", { count: "exact", head: true }),
    ]);
    const failed = [u, e, q, a, p, s, n].find(result => result.error);
    setDatabaseError(failed?.error?.message ?? null);
    const { data: activity } = await (supabase.from("user_activity") as any)
      .select("id,event_type,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    setRecentActivity((activity ?? []) as typeof recentActivity);
    setStats({
      users: u.count ?? 0, exams: e.count ?? 0, questions: q.count ?? 0,
      attempts: a.count ?? 0, posts: p.count ?? 0, schools: s.count ?? 0,
      subscribers: n.count ?? 0,
    });
    setLastUpdated(new Date());
    setStatsLoading(false);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("profiles", reload);
  useRealtime("exams", reload);
  useRealtime("questions", reload);
  useRealtime("attempts", reload);
  useRealtime("blog_posts", reload);
  useRealtime("schools", reload);
  useRealtime("newsletter_subscribers", reload);
  useRealtime("user_activity", reload);
  
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage every aspect of Jelite Tutor in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading overview"}
          </span>
          <Button variant="outline" size="sm" onClick={reload} disabled={statsLoading} aria-label="Refresh dashboard statistics">
            <RefreshCw className={cn("h-3.5 w-3.5", statsLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Wifi className="h-3.5 w-3.5" /> Live
          </span>
        </div>
      </div>

      {databaseError && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Database read failed</p>
          <p className="mt-1 text-muted-foreground">The dashboard was showing zeros because Supabase returned an error instead of a count.</p>
          <code className="mt-2 block overflow-x-auto rounded bg-background p-2 text-xs">{databaseError}</code>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>Retry database connection</Button>
        </div>
      )}

      <div className="mb-8 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Users", value: stats.users, icon: Users, color: "text-primary bg-primary/10" },
          { label: "Exams", value: stats.exams, icon: BookOpen, color: "text-accent bg-accent/10" },
          { label: "Questions", value: stats.questions, icon: FileText, color: "text-chart-3 bg-chart-3/10" },
          { label: "Attempts", value: stats.attempts, icon: BarChart3, color: "text-success bg-success/10" },
          { label: "Posts", value: stats.posts, icon: Newspaper, color: "text-chart-4 bg-chart-4/10" },
          { label: "Schools", value: stats.schools, icon: SchoolIcon, color: "text-chart-5 bg-chart-5/10" },
          { label: "Subscribers", value: stats.subscribers, icon: Mail, color: "text-purple-500 bg-purple-500/10" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}><s.icon className="h-4.5 w-4.5" /></div>
            <p className="mt-2 font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5" aria-labelledby="recent-activity-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="recent-activity-heading" className="font-display text-lg font-semibold">Recent user activity</h2>
            <p className="text-sm text-muted-foreground">Registrations and actions appear here as users use the platform.</p>
          </div>
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        {recentActivity.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentActivity.map(item => (
              <div key={item.id} className="rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium">{item.event_type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <Tabs defaultValue="questions">
        <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1 lg:flex-wrap">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="cms"><LayoutTemplate className="h-3.5 w-3.5 mr-1" />CMS Blocks</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="community_mod">Community</TabsTrigger>
          <TabsTrigger value="menu">Site Menu</TabsTrigger>
          <TabsTrigger value="site">Site Settings</TabsTrigger>
          <TabsTrigger value="footer">Footer Links</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-3.5 w-3.5 mr-1" />Health</TabsTrigger>
        </TabsList>
        <TabsContent value="questions"><QuestionsManager /></TabsContent>
        <TabsContent value="exams"><ExamsManager /></TabsContent>
        <TabsContent value="subjects"><SubjectsManager /></TabsContent>
        <TabsContent value="schools"><SchoolsManager /></TabsContent>
        <TabsContent value="blog"><BlogManager /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsManagerFull /></TabsContent>
        <TabsContent value="testimonials"><TestimonialsManager /></TabsContent>
        <TabsContent value="cms"><ContentBlocksManager /></TabsContent>
        <TabsContent value="users"><UsersManager /></TabsContent>
        <TabsContent value="newsletter"><NewsletterManager /></TabsContent>
        <TabsContent value="community_mod"><CommunityModManager /></TabsContent>
        <TabsContent value="menu"><SiteMenuManager /></TabsContent>
        <TabsContent value="site"><SiteSettingsManager /></TabsContent>
        <TabsContent value="footer"><FooterLinksManager /></TabsContent>
        <TabsContent value="audit"><AuditLogViewer /></TabsContent>
        <TabsContent value="health"><HealthCheck /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- QUESTIONS ---------- */
type QRow = { id: string; question: string; correct_answer: string; options: string[] | null; explanation: string | null; difficulty: string | null; year: number | null; topic: string | null; subject_id: string | null; subjects: { name: string } | null };
type EditQ = { id: string; question: string; optA: string; optB: string; optC: string; optD: string; correct: string; explanation: string; difficulty: string; year: string; topic: string; subject_id: string };

function QuestionsManager() {
  const [subjects, setSubjects] = useState<{ id: string; name: string; exams: { name: string } | null }[]>([]);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject_id: "", question: "", optA: "", optB: "", optC: "", optD: "", correct: "", explanation: "", difficulty: "medium", year: "", topic: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editQ, setEditQ] = useState<EditQ | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    const [{ data: s }, { data: q }] = await Promise.all([
      supabase.from("subjects").select("id, name, exams(name)").order("name"),
      supabase.from("questions").select("id, question, correct_answer, options, explanation, difficulty, year, topic, subject_id, subjects(name)").order("created_at", { ascending: false }).limit(100),
    ]);
    setSubjects((s ?? []) as never);
    setQuestions((q ?? []) as never);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("questions", reload);
  useRealtime("subjects", reload);

  const create = async () => {
    if (!form.subject_id || !form.question || !form.correct) { toast.error("Fill required fields"); return; }
    const options = [form.optA, form.optB, form.optC, form.optD].filter(Boolean);
    const { error } = await supabase.from("questions").insert({
      subject_id: form.subject_id, question: form.question, options,
      correct_answer: form.correct, explanation: form.explanation || null,
      difficulty: form.difficulty as "easy" | "medium" | "hard", year: form.year ? Number(form.year) : null, topic: form.topic || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Question added"); setForm({ subject_id: "", question: "", optA: "", optB: "", optC: "", optD: "", correct: "", explanation: "", difficulty: "medium", year: "", topic: "" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected question(s)?`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("questions").delete().in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`Deleted ${ids.length} questions`); setSelected(new Set()); }
    setBulkDeleting(false);
  };

  const startEdit = (q: QRow) => {
    const opts = q.options ?? [];
    setEditQ({ id: q.id, question: q.question, optA: opts[0] ?? "", optB: opts[1] ?? "", optC: opts[2] ?? "", optD: opts[3] ?? "", correct: q.correct_answer, explanation: q.explanation ?? "", difficulty: q.difficulty ?? "medium", year: q.year?.toString() ?? "", topic: q.topic ?? "", subject_id: q.subject_id ?? "" });
  };

  const saveEdit = async () => {
    if (!editQ) return;
    setSaving(true);
    const opts = [editQ.optA, editQ.optB, editQ.optC, editQ.optD].filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { question: editQ.question, options: opts, correct_answer: editQ.correct, explanation: editQ.explanation || null, difficulty: editQ.difficulty, year: editQ.year ? Number(editQ.year) : null, topic: editQ.topic || null, subject_id: editQ.subject_id || null };
    const { error } = await supabase.from("questions").update(payload).eq("id", editQ.id);
    if (error) toast.error(error.message); else { toast.success("Question updated"); setEditQ(null); }
    setSaving(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const selectAll = () => setSelected(new Set(filtered.map(q => q.id)));
  const clearAll = () => setSelected(new Set());

  const filtered = questions.filter(q =>
    (filterSubject === "all" || q.subject_id === filterSubject) &&
    (!search || q.question.toLowerCase().includes(search.toLowerCase()) || q.topic?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mt-4 space-y-6">
      <BulkQuestionImporter onDone={reload} />

      {/* Edit Modal */}
      {editQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Question</h3>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Select value={editQ.subject_id} onValueChange={v => setEditQ({ ...editQ, subject_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.exams?.name} — {s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Question</Label><Textarea value={editQ.question} onChange={e => setEditQ({ ...editQ, question: e.target.value })} className="mt-1" rows={3} /></div>
              <div className="grid grid-cols-2 gap-2">
                {(["A", "B", "C", "D"] as const).map(l => (
                  <div key={l}><Label>Option {l}</Label><Input value={editQ[`opt${l}` as keyof EditQ] as string} onChange={e => setEditQ({ ...editQ, [`opt${l}`]: e.target.value })} className="mt-1" /></div>
                ))}
              </div>
              <div><Label>Correct Answer</Label><Input value={editQ.correct} onChange={e => setEditQ({ ...editQ, correct: e.target.value })} className="mt-1" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Difficulty</Label>
                  <Select value={editQ.difficulty} onValueChange={v => setEditQ({ ...editQ, difficulty: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Year</Label><Input type="number" value={editQ.year} onChange={e => setEditQ({ ...editQ, year: e.target.value })} className="mt-1" placeholder="e.g. 2023" /></div>
                <div><Label>Topic</Label><Input value={editQ.topic} onChange={e => setEditQ({ ...editQ, topic: e.target.value })} className="mt-1" /></div>
              </div>
              <div><Label>Explanation</Label><Textarea value={editQ.explanation} onChange={e => setEditQ({ ...editQ, explanation: e.target.value })} className="mt-1" rows={2} /></div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving} className="flex-1 bg-gradient-hero text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
                <Button variant="outline" onClick={() => setEditQ(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> Add Question Manually</h3>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.exams?.name} — {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Question</Label><Textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} className="mt-1" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B", "C", "D"] as const).map(l => (
                <div key={l}><Label>Option {l}</Label><Input value={form[`opt${l}` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`opt${l}`]: e.target.value })} className="mt-1" /></div>
              ))}
            </div>
            <div><Label>Correct Answer (must match an option exactly)</Label><Input value={form.correct} onChange={e => setForm({ ...form, correct: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="mt-1" placeholder="2024" /></div>
              <div><Label>Topic</Label><Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Explanation (optional)</Label><Textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} className="mt-1" rows={2} /></div>
            <Button onClick={create} className="w-full bg-gradient-hero text-white">Add Question</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">Questions ({filtered.length}/{questions.length})</h3>
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 w-32 text-xs ml-auto" />
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selected.size > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
              <span className="text-xs font-medium text-destructive flex-1">{selected.size} selected</span>
              <Button size="sm" variant="ghost" onClick={clearAll} className="h-6 text-xs">Clear</Button>
              <Button size="sm" onClick={bulkDelete} disabled={bulkDeleting} className="h-6 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />} Delete {selected.size}
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2 px-1">
            <button onClick={selected.size === filtered.length ? clearAll : selectAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
              Select all
            </button>
          </div>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filtered.map(q => (
                <div key={q.id} className={`flex items-start gap-2 rounded-lg p-3 transition-colors ${selected.has(q.id) ? "bg-primary/10 border border-primary/20" : "bg-secondary"}`}>
                  <button onClick={() => toggleSelect(q.id)} className="mt-0.5 flex-none text-muted-foreground hover:text-primary">
                    {selected.has(q.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{q.subjects?.name}{q.year ? ` · ${q.year}` : ""}{q.difficulty ? ` · ${q.difficulty}` : ""}</p>
                    <p className="text-sm line-clamp-2 mt-0.5">{q.question}</p>
                    <p className="text-xs text-success mt-1">✓ {q.correct_answer}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-none">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(q.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No questions found.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- EXAMS ---------- */
function ExamsManager() {
  type E = { id: string; name: string; slug: string; region: string; duration_minutes: number };
  const [exams, setExams] = useState<E[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", region: "africa", duration_minutes: 60 });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<E | null>(null);

  const reload = async () => {
    const { data } = await supabase.from("exams").select("id, name, slug, region, duration_minutes").order("name");
    setExams((data ?? []) as E[]);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("exams", reload);

  const create = async () => {
    if (!form.name || !form.slug) { toast.error("Name and slug required"); return; }
    const { error } = await supabase.from("exams").insert({ ...form, region: form.region as "africa" | "international" });
    if (error) toast.error(error.message); else { toast.success("Exam added"); setForm({ name: "", slug: "", region: "africa", duration_minutes: 60 }); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete exam? This removes all subjects and questions too.")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };
  const saveEdit = async () => {
    if (!editForm) return;
    const { id, ...patch } = editForm;
    const { error } = await supabase.from("exams").update({ ...patch, region: patch.region as "africa" | "international" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Exam updated"); setEditId(null); setEditForm(null); }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Add Exam</h3>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1" /></div>
          <div><Label>Region</Label>
            <Select value={form.region} onValueChange={v => setForm({ ...form, region: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="africa">Africa</SelectItem>
                <SelectItem value="international">International</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} className="mt-1" /></div>
          <Button onClick={create} className="w-full bg-gradient-hero text-white">Add Exam</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Existing Exams ({exams.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {exams.map(e => (
            <div key={e.id} className="rounded-lg bg-secondary p-3">
              {editId === e.id && editForm ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={editForm.name} onChange={ev => setEditForm({ ...editForm, name: ev.target.value })} placeholder="Name" />
                    <Input value={editForm.slug} onChange={ev => setEditForm({ ...editForm, slug: ev.target.value })} placeholder="Slug" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={editForm.region} onValueChange={v => setEditForm({ ...editForm, region: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="africa">Africa</SelectItem>
                        <SelectItem value="international">International</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={editForm.duration_minutes} onChange={ev => setEditForm({ ...editForm, duration_minutes: +ev.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="flex-1 bg-gradient-hero text-white">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditId(null); setEditForm(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">{e.name}</p><p className="text-xs text-muted-foreground capitalize">{e.region} · {e.duration_minutes}min</p></div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(e.id); setEditForm(e); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- SUBJECTS ---------- */
function SubjectsManager() {
  type Sub = { id: string; name: string; slug: string; exam_id?: string; exams: { name: string } | null };
  const [exams, setExams] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<Sub[]>([]);
  const [form, setForm] = useState({ exam_id: "", name: "", slug: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; slug: string; exam_id: string } | null>(null);

  const reload = async () => {
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase.from("exams").select("id, name").order("name"),
      supabase.from("subjects").select("id, name, slug, exam_id, exams(name)").order("name"),
    ]);
    setExams(e ?? []);
    setSubjects((s ?? []) as never);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("subjects", reload);

  const create = async () => {
    if (!form.exam_id || !form.name || !form.slug) { toast.error("All fields required"); return; }
    const { error } = await supabase.from("subjects").insert(form);
    if (error) toast.error(error.message); else { toast.success("Subject added"); setForm({ exam_id: "", name: "", slug: "" }); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete subject and all its questions?")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };
  const startEdit = (s: Sub) => { setEditId(s.id); setEditForm({ name: s.name, slug: s.slug, exam_id: s.exam_id ?? "" }); };
  const saveEdit = async () => {
    if (!editId || !editForm) return;
    const { error } = await supabase.from("subjects").update(editForm).eq("id", editId);
    if (error) toast.error(error.message); else { toast.success("Updated"); setEditId(null); setEditForm(null); }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Layers className="h-4 w-4" /> Add Subject</h3>
        <div className="space-y-3">
          <div><Label>Exam</Label>
            <Select value={form.exam_id} onValueChange={v => setForm({ ...form, exam_id: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1" /></div>
          <Button onClick={create} className="w-full bg-gradient-hero text-white">Add Subject</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Subjects ({subjects.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {subjects.map(s => (
            <div key={s.id} className="rounded-lg bg-secondary p-3">
              {editId === s.id && editForm ? (
                <div className="space-y-2">
                  <Select value={editForm.exam_id} onValueChange={v => setEditForm({ ...editForm, exam_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
                    <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={editForm.name} onChange={ev => setEditForm({ ...editForm, name: ev.target.value })} placeholder="Name" />
                    <Input value={editForm.slug} onChange={ev => setEditForm({ ...editForm, slug: ev.target.value })} placeholder="Slug" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="flex-1 bg-gradient-hero text-white">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditId(null); setEditForm(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.exams?.name}</p></div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- SCHOOLS ---------- */
type SchoolType = "university" | "polytechnic" | "college_of_education" | "monotechnic" | "secondary" | "other";
type SchoolOwnership = "federal" | "state" | "private" | "other";
type AccreditationStatus = "full" | "provisional" | "not_accredited" | "unknown";

const SCHOOL_TYPES: { value: SchoolType; label: string }[] = [
  { value: "university", label: "University" },
  { value: "polytechnic", label: "Polytechnic" },
  { value: "college_of_education", label: "College of Education" },
  { value: "monotechnic", label: "Monotechnic" },
  { value: "secondary", label: "Secondary School" },
  { value: "other", label: "Other" },
];
const OWNERSHIPS: { value: SchoolOwnership; label: string }[] = [
  { value: "federal", label: "Federal" }, { value: "state", label: "State" },
  { value: "private", label: "Private" }, { value: "other", label: "Other" },
];
const ACCREDITATIONS: { value: AccreditationStatus; label: string }[] = [
  { value: "full", label: "Full" }, { value: "provisional", label: "Provisional" },
  { value: "not_accredited", label: "Not accredited" }, { value: "unknown", label: "Unknown" },
];

function SchoolsManager() {
  type S = { id: string; name: string; slug: string; state: string | null; location?: string | null; cutoff_score: number | null; fees_min?: number | null; fees_max?: number | null; description?: string | null; website_url?: string | null; map_embed_url?: string | null; logo_url?: string | null; school_type: SchoolType; ownership: SchoolOwnership; accreditation: AccreditationStatus; country: string };
  const emptySchool = {
    name: "", slug: "", state: "", location: "", cutoff_score: 180, fees_min: 0, fees_max: 0,
    description: "", school_type: "university" as SchoolType, ownership: "federal" as SchoolOwnership,
    accreditation: "unknown" as AccreditationStatus, country: "Nigeria", website_url: "", map_embed_url: "",
    logo_url: "",
  };
  const [schools, setSchools] = useState<S[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterOwnership, setFilterOwnership] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptySchool);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase.from("schools").select("id, name, slug, state, location, cutoff_score, fees_min, fees_max, description, website_url, logo_url, school_type, ownership, accreditation, country").order("name");
    setSchools((data ?? []) as S[]);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("schools", reload);

  const save = async () => {
    if (!form.name || !form.slug) { toast.error("Name and slug required"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { ...form };
    if (editingId) {
      const { error } = await supabase.from("schools").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("School updated");
    } else {
      const { error } = await supabase.from("schools").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("School added");
    }
    setForm(emptySchool); setEditingId(null);
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this school?")) return;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };
  const startEdit = (s: S) => {
    setEditingId(s.id);
    setForm({
      name: s.name, slug: s.slug, state: s.state ?? "", location: s.location ?? "",
      cutoff_score: s.cutoff_score ?? 0, fees_min: s.fees_min ?? 0, fees_max: s.fees_max ?? 0,
      description: s.description ?? "", school_type: s.school_type, ownership: s.ownership,
      accreditation: s.accreditation, country: s.country, website_url: s.website_url ?? "",
      map_embed_url: s.map_embed_url ?? "", logo_url: s.logo_url ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtered = schools.filter(s =>
    (filterType === "all" || s.school_type === filterType) &&
    (filterOwnership === "all" || s.ownership === filterOwnership) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><SchoolIcon className="h-4 w-4" /> {editingId ? "Edit School" : "Add School"}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Type</Label>
              <Select value={form.school_type} onValueChange={v => setForm({ ...form, school_type: v as SchoolType })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SCHOOL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ownership</Label>
              <Select value={form.ownership} onValueChange={v => setForm({ ...form, ownership: v as SchoolOwnership })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{OWNERSHIPS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Accreditation</Label>
              <Select value={form.accreditation} onValueChange={v => setForm({ ...form, accreditation: v as AccreditationStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ACCREDITATIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="mt-1" /></div>
            <div><Label>Location/City</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Cut-off</Label><Input type="number" value={form.cutoff_score} onChange={e => setForm({ ...form, cutoff_score: +e.target.value })} className="mt-1" /></div>
            <div><Label>Fees min (₦)</Label><Input type="number" value={form.fees_min} onChange={e => setForm({ ...form, fees_min: +e.target.value })} className="mt-1" /></div>
            <div><Label>Fees max (₦)</Label><Input type="number" value={form.fees_max} onChange={e => setForm({ ...form, fees_max: +e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label>Website URL (optional)</Label><Input value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} className="mt-1" placeholder="https://..." /></div>
          <div><Label>Google Maps Embed URL (optional)</Label><Input value={(form as typeof form & { map_embed_url?: string }).map_embed_url ?? ""} onChange={e => setForm({ ...form, map_embed_url: e.target.value } as typeof form)} className="mt-1" placeholder="https://www.google.com/maps/embed?pb=..." /><p className="text-xs text-muted-foreground mt-1">Get this from Google Maps → Share → Embed a map → copy the src URL</p></div>
          <div>
            <ImageUpload
              label="School photo / logo (optional)"
              value={(form as typeof form & { logo_url?: string }).logo_url ?? ""}
              onChange={url => setForm({ ...form, logo_url: url } as typeof form)}
              previewClass="h-24 w-full rounded-lg object-cover"
            />
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} /></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 bg-gradient-hero text-white">{editingId ? "Save changes" : "Add School"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setForm(emptySchool); setEditingId(null); }}>Cancel</Button>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-semibold">Schools ({filtered.length})</h3>
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="ml-auto h-8 w-[140px] text-xs" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {SCHOOL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterOwnership} onValueChange={setFilterOwnership}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {OWNERSHIPS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {SCHOOL_TYPES.find(t => t.value === s.school_type)?.label} · {OWNERSHIPS.find(t => t.value === s.ownership)?.label} · {s.state ?? s.country}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- BLOG ---------- */
function BlogManager() {
  const emptyPost = { title: "", slug: "", excerpt: "", content: "", category: "general", cover_url: "", published: true };
  const [posts, setPosts] = useState<{ id: string; title: string; slug: string; category: string | null; published: boolean; created_at: string; excerpt?: string | null; content?: string; cover_url?: string | null }[]>([]);
  const [form, setForm] = useState(emptyPost);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase.from("blog_posts").select("id, title, slug, category, published, created_at, excerpt, content, cover_url").order("created_at", { ascending: false });
    setPosts(data ?? []);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("blog_posts", reload);

  const save = async () => {
    if (!form.title || !form.slug || !form.content) { toast.error("Title, slug and content required"); return; }
    if (editingId) {
      const { error } = await supabase.from("blog_posts").update(form).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Post updated");
    } else {
      const { error } = await supabase.from("blog_posts").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Post created");
    }
    setForm(emptyPost); setEditingId(null);
  };
  const startEdit = (p: typeof posts[number]) => {
    setEditingId(p.id);
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", content: p.content ?? "",
      category: p.category ?? "general", cover_url: p.cover_url ?? "", published: p.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from("blog_posts").update({ published: !current }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(current ? "Unpublished" : "Published");
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Newspaper className="h-4 w-4" /> {editingId ? "Edit Post" : "New Post"}</h3>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
          <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="mt-1" /></div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="JAMB">JAMB</SelectItem>
                <SelectItem value="WAEC">WAEC</SelectItem>
                <SelectItem value="IELTS">IELTS</SelectItem>
                <SelectItem value="Admissions">Admissions</SelectItem>
                <SelectItem value="Study Tips">Study Tips</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <ImageUpload
              label="Cover image (optional)"
              value={form.cover_url}
              onChange={url => setForm({ ...form, cover_url: url })}
              previewClass="h-28 w-full rounded-lg object-cover"
            />
          </div>
          <div><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} className="mt-1" rows={2} /></div>
          <div><Label>Content (Markdown)</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1" rows={6} /></div>
          <div className="flex items-center gap-3"><Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} /><Label>Published</Label></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 bg-gradient-hero text-white">{editingId ? "Save changes" : "Create Post"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setForm(emptyPost); setEditingId(null); }}>Cancel</Button>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Posts ({posts.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {posts.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.category} · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={p.published} onCheckedChange={() => togglePublish(p.id, p.published)} />
                <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- ANNOUNCEMENTS ---------- */
function AnnouncementsManager() {
  const [items, setItems] = useState<{ id: string; title: string; body: string; type: string; active: boolean }[]>([]);
  const [form, setForm] = useState({ title: "", body: "", type: "info", active: true });

  const reload = async () => {
    const { data } = await supabase.from("announcements").select("id, title, body, type, active").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("announcements", reload);

  const create = async () => {
    if (!form.title || !form.body) { toast.error("Title and body required"); return; }
    const { error } = await supabase.from("announcements").insert(form);
    if (error) toast.error(error.message); else { toast.success("Announcement created"); setForm({ title: "", body: "", type: "info", active: true }); }
  };
  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("announcements").update({ active: !active }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Megaphone className="h-4 w-4" /> New Announcement</h3>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
          <div><Label>Body</Label><Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="mt-1" rows={3} /></div>
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="promo">Promo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Active</Label></div>
          <Button onClick={create} className="w-full bg-gradient-hero text-white">Create</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Announcements ({items.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {items.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-secondary p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${a.type === 'warning' ? 'bg-destructive/10 text-destructive' : a.type === 'success' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{a.type}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={a.active} onCheckedChange={() => toggle(a.id, a.active)} />
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- TESTIMONIALS ---------- */
type Testimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar_url: string | null;
  approved: boolean;
  sort_order: number;
};

function TestimonialsManager() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const emptyForm = { name: "", role: "", quote: "", rating: 5, avatar_url: "", approved: true, sort_order: 0 };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from("testimonials")
      .select("id, name, role, quote, rating, avatar_url, approved, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Testimonial[]);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("testimonials", reload);

  const save = async () => {
    if (!form.name || !form.quote) { toast.error("Name and quote are required"); return; }
    const payload = { ...form, avatar_url: form.avatar_url || null };
    if (editingId) {
      const { error } = await supabase.from("testimonials").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Testimonial updated");
    } else {
      const { error } = await supabase.from("testimonials").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Testimonial added");
    }
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setForm({
      name: t.name, role: t.role, quote: t.quote, rating: t.rating,
      avatar_url: t.avatar_url ?? "", approved: t.approved, sort_order: t.sort_order,
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const toggleApproved = async (t: Testimonial) => {
    const { error } = await supabase.from("testimonials").update({ approved: !t.approved }).eq("id", t.id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {editingId ? "Edit Testimonial" : "Add Testimonial"}
        </h3>
        <div className="space-y-3">
          <div><Label>Student name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
          <div><Label>Role / result</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1" placeholder="e.g. JAMB 2024 · 312/400" /></div>
          <div><Label>Quote</Label><Textarea value={form.quote} onChange={e => setForm({ ...form, quote: e.target.value })} className="mt-1" rows={3} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Rating (1–5)</Label><Input type="number" min={1} max={5} value={form.rating} onChange={e => setForm({ ...form, rating: Math.max(1, Math.min(5, +e.target.value || 5)) })} className="mt-1" /></div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value || 0 })} className="mt-1" /></div>
          </div>
          <div><Label>Avatar URL (optional)</Label><Input value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} className="mt-1" placeholder="https://..." /></div>
          <div className="flex items-center gap-3"><Switch checked={form.approved} onCheckedChange={v => setForm({ ...form, approved: v })} /><Label>Approved (visible on site)</Label></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 bg-gradient-hero text-white">{editingId ? "Save changes" : "Add testimonial"}</Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Testimonials ({items.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {items.map(t => (
            <div key={t.id} className="rounded-lg bg-secondary p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{t.name} <span className="text-xs text-muted-foreground">· {t.role}</span></p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">"{t.quote}"</p>
                  <p className="text-[10px] text-muted-foreground mt-1">★ {t.rating} · order {t.sort_order}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={t.approved} onCheckedChange={() => toggleApproved(t)} />
                  <Button size="icon" variant="ghost" onClick={() => startEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No testimonials yet — add one above.</p>}
        </div>
      </div>
    </div>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-secondary hover:bg-primary/10 hover:text-primary transition-colors" title="Click to copy User ID">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {id.slice(0, 8)}…
    </button>
  );
}

function UsersManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null; plan: string; created_at: string; whatsapp?: string | null; country?: string | null }[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  const reload = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, plan, created_at, whatsapp, country").order("created_at", { ascending: false });
    setUsers((profiles ?? []) as never);
    setAdminIds(currentUser ? new Set([currentUser.id]) : new Set());
    if (profiles && profiles.length > 0) {
      const { data: attempts } = await supabase.from("attempts").select("user_id").in("user_id", profiles.map(p => p.id));
      const counts: Record<string, number> = {};
      (attempts ?? []).forEach(a => { counts[a.user_id] = (counts[a.user_id] ?? 0) + 1; });
      setAttemptCounts(counts);
    }
  };
  useEffect(() => { reload(); }, []);
  useRealtime("profiles", reload);

  const togglePremium = async (id: string, current: string) => {
    const next = current === "premium" ? "free" : "premium";
    const { error } = await supabase.from("profiles").update({ plan: next as "free" | "premium" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(`Plan set to ${next}`);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.id.includes(q);
    const matchPlan = filterPlan === "all" || u.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-display font-semibold">All Users ({filtered.length}/{users.length})</h3>
        <p className="w-full text-xs text-muted-foreground">Administrator access is controlled securely by Supabase Auth <code>app_metadata.role</code>. Manage it from a trusted server-side Supabase workflow; it is never changed from the browser.</p>
        <Input placeholder="Search by name, email or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 max-w-xs" />
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {filtered.map(u => {
          const isAdmin = adminIds.has(u.id);
          return (
            <div key={u.id} className="rounded-xl border border-border bg-secondary p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm truncate">{u.full_name ?? "Unnamed"}</p>
                    {isAdmin && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">ADMIN</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${u.plan === "premium" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{u.plan}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <CopyableId id={u.id} />
                    {u.country && <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{u.country}</span>}
                    {u.whatsapp && <span className="text-[10px] text-muted-foreground">📱 {u.whatsapp}</span>}
                    <span className="text-[10px] text-muted-foreground">{attemptCounts[u.id] ?? 0} attempts</span>
                    <span className="text-[10px] text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => togglePremium(u.id, u.plan)} className="text-xs h-7">
                    {u.plan === "premium" ? "Downgrade" : "Upgrade"}
                  </Button>
                  {isAdmin && <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary"><Shield className="h-3 w-3" /> App metadata admin</span>}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No users found.</p>}
      </div>
    </div>
  );
}

/* ---------- SITE MENU ---------- */
const ICON_OPTIONS = ["BookOpen","FileText","BookMarked","GraduationCap","Award","Globe2","Trophy","School","Sparkles","Newspaper","Users","Calculator"];

function SiteMenuManager() {
  const [sections, setSections] = useState<{ id: string; label: string; icon: string; sort_order: number; visible: boolean }[]>([]);
  const [links, setLinks] = useState<{ id: string; section_id: string; label: string; description: string; icon: string; url: string; sort_order: number; visible: boolean }[]>([]);
  const [secForm, setSecForm] = useState({ label: "", icon: "BookOpen" });
  const [linkForm, setLinkForm] = useState({ section_id: "", label: "", description: "", icon: "BookOpen", url: "/" });
  const [editSec, setEditSec] = useState<string | null>(null);
  const [editLink, setEditLink] = useState<string | null>(null);

  const reload = async () => {
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from("site_menu_sections").select("*").order("sort_order"),
      supabase.from("site_menu_links").select("*").order("sort_order"),
    ]);
    setSections((s ?? []) as typeof sections);
    setLinks((l ?? []) as typeof links);
  };
  useEffect(() => { reload(); }, []);
  useRealtime("site_menu_sections", reload);
  useRealtime("site_menu_links", reload);

  // Section CRUD
  const addSection = async () => {
    if (!secForm.label) { toast.error("Label required"); return; }
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { error } = await supabase.from("site_menu_sections").insert({ ...secForm, sort_order: maxOrder + 1 });
    if (error) toast.error(error.message); else { toast.success("Section added"); setSecForm({ label: "", icon: "BookOpen" }); }
  };
  const updateSection = async (id: string, updates: Record<string, unknown>) => {
    const { error } = await supabase.from("site_menu_sections").update(updates as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); setEditSec(null); }
  };
  const deleteSection = async (id: string) => {
    if (!confirm("Delete this section and all its links?")) return;
    const { error } = await supabase.from("site_menu_sections").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };
  const moveSection = async (id: string, dir: number) => {
    const idx = sections.findIndex(s => s.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    await Promise.all([
      supabase.from("site_menu_sections").update({ sort_order: sections[swapIdx].sort_order }).eq("id", id),
      supabase.from("site_menu_sections").update({ sort_order: sections[idx].sort_order }).eq("id", sections[swapIdx].id),
    ]);
  };

  // Link CRUD
  const addLink = async () => {
    if (!linkForm.section_id || !linkForm.label) { toast.error("Section and label required"); return; }
    const sectionLinks = links.filter(l => l.section_id === linkForm.section_id);
    const maxOrder = sectionLinks.reduce((m, l) => Math.max(m, l.sort_order), 0);
    const { error } = await supabase.from("site_menu_links").insert({ ...linkForm, sort_order: maxOrder + 1 });
    if (error) toast.error(error.message); else { toast.success("Link added"); setLinkForm({ section_id: linkForm.section_id, label: "", description: "", icon: "BookOpen", url: "/" }); }
  };
  const updateLink = async (id: string, updates: Record<string, unknown>) => {
    const { error } = await supabase.from("site_menu_links").update(updates as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); setEditLink(null); }
  };
  const deleteLink = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    const { error } = await supabase.from("site_menu_links").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      {/* Sections panel */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><MenuIcon className="h-4 w-4" /> Add Menu Section</h3>
          <div className="space-y-3">
            <div><Label>Label</Label><Input value={secForm.label} onChange={e => setSecForm({ ...secForm, label: e.target.value })} className="mt-1" placeholder="e.g. Classroom" /></div>
            <div><Label>Icon</Label>
              <Select value={secForm.icon} onValueChange={v => setSecForm({ ...secForm, icon: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={addSection} className="w-full bg-gradient-hero text-white">Add Section</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4">Sections ({sections.length})</h3>
          <div className="space-y-2">
            {sections.map((s, idx) => (
              <div key={s.id} className="rounded-lg bg-secondary p-3">
                {editSec === s.id ? (
                  <EditSectionInline section={s} onSave={(u) => updateSection(s.id, u)} onCancel={() => setEditSec(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${s.visible ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{s.visible ? 'Visible' : 'Hidden'}</span>
                      <p className="font-medium text-sm">{s.label}</p>
                      <span className="text-xs text-muted-foreground">({s.icon})</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => moveSection(s.id, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => moveSection(s.id, 1)} disabled={idx === sections.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => updateSection(s.id, { visible: !s.visible })}>{s.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditSec(s.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteSection(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Links panel */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> Add Menu Link</h3>
          <div className="space-y-3">
            <div><Label>Section</Label>
              <Select value={linkForm.section_id} onValueChange={v => setLinkForm({ ...linkForm, section_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Label</Label><Input value={linkForm.label} onChange={e => setLinkForm({ ...linkForm, label: e.target.value })} className="mt-1" placeholder="e.g. CBT Practice" /></div>
            <div><Label>Description</Label><Input value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} className="mt-1" placeholder="Short description" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>URL</Label><Input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} className="mt-1" placeholder="/exams" /></div>
              <div><Label>Icon</Label>
                <Select value={linkForm.icon} onValueChange={v => setLinkForm({ ...linkForm, icon: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={addLink} className="w-full bg-gradient-hero text-white">Add Link</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4">Links by Section</h3>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {sections.map(s => {
              const sLinks = links.filter(l => l.section_id === s.id);
              if (sLinks.length === 0) return null;
              return (
                <div key={s.id}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{s.label}</p>
                  <div className="space-y-1.5">
                    {sLinks.map(l => (
                      <div key={l.id} className="rounded-lg bg-secondary p-2.5">
                        {editLink === l.id ? (
                          <EditLinkInline link={l} onSave={(u) => updateLink(l.id, u)} onCancel={() => setEditLink(null)} />
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1 py-0.5 rounded ${l.visible ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{l.visible ? '✓' : '✗'}</span>
                                <p className="text-sm font-medium">{l.label}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{l.url} · {l.icon}</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button size="icon" variant="ghost" onClick={() => updateLink(l.id, { visible: !l.visible })}>{l.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditLink(l.id)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteLink(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- NEWSLETTER ---------- */
function NewsletterManager() {
  const [subs, setSubs] = useState<{ id: string; email: string; user_id: string | null; created_at: string; full_name?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("newsletter_subscribers") as any).select("id, email, user_id, created_at").order("created_at", { ascending: false });
  const rows = (data ?? []) as { id: string; email: string; user_id: string | null; created_at: string; full_name?: string | null }[];
  const userIds = rows.map(row => row.user_id).filter(Boolean) as string[];
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const names = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name]));
    rows.forEach(row => { row.full_name = row.user_id ? names.get(row.user_id) ?? null : null; });
  }
  setSubs(rows);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Unsubscribe this email?")) return;
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); reload(); }
  };

  const exportCsv = () => {
    const rows = subs.map(s => `${s.email},${s.user_id ?? ""},${new Date(s.created_at).toLocaleDateString()}`);
    const csv = ["email,user_id,subscribed_date", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "newsletter_subscribers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = subs.filter(s => !search || s.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="font-display font-semibold">Newsletter Subscribers ({subs.length.toLocaleString()})</h3>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Input placeholder="Search email..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-48 text-xs" />
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 text-xs gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV</Button>
          <Button size="sm" variant="outline" onClick={reload} className="h-8 text-xs"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No subscribers found.</p>}
          {filtered.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <div className="min-w-0">
  <p className="text-sm font-medium">{s.full_name || "Newsletter subscriber"}</p>
  <p className="text-xs text-muted-foreground">{s.email}</p>
  <p className="text-xs text-muted-foreground">
  {s.user_id ? "Registered account" : "No user account"} · {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- COMMUNITY MODERATION ---------- */
function CommunityModManager() {
  const [threads, setThreads] = useState<{ id: string; title: string; body: string; category: string; pinned: boolean; locked: boolean; view_count: number; author_id: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"threads" | "whatsapp">("threads");

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("forum_threads").select("id, title, body, category, pinned, locked, view_count, author_id, created_at").order("created_at", { ascending: false }).limit(300);
    setThreads((data ?? []) as typeof threads);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const togglePin = async (id: string, current: boolean) => {
    const { error } = await supabase.from("forum_threads").update({ pinned: !current }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(current ? "Unpinned" : "Pinned"); reload(); }
  };
  const toggleLock = async (id: string, current: boolean) => {
    const { error } = await supabase.from("forum_threads").update({ locked: !current }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(current ? "Unlocked" : "Locked"); reload(); }
  };
  const removeThread = async (id: string) => {
    if (!confirm("Delete this thread and all its replies?")) return;
    const { error } = await supabase.from("forum_threads").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Thread deleted"); reload(); }
  };

  const normalThreads = threads.filter(t => t.category !== "WhatsApp");
  const waPending = threads.filter(t => t.category === "WhatsApp" && !t.pinned);
  const waApproved = threads.filter(t => t.category === "WhatsApp" && t.pinned);

  const filteredNormal = normalThreads.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));

  const approveWa = async (id: string) => {
    const { error } = await supabase.from("forum_threads").update({ pinned: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("WhatsApp group approved and published!"); reload(); }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display font-semibold">Community Moderation</h3>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={reload} className="h-8 text-xs"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(["threads", "whatsapp"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
            {t === "threads" ? `Threads (${normalThreads.length})` : `WhatsApp Groups (${waPending.length} pending, ${waApproved.length} live)`}
            {t === "whatsapp" && waPending.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{waPending.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === "threads" ? (
        <>
          <Input placeholder="Search threads..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs max-w-xs" />
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredNormal.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {t.pinned && <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">PINNED</span>}
                    {t.locked && <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">LOCKED</span>}
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{t.category}</span>
                  </div>
                  <p className="font-medium text-sm line-clamp-1">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()} · {t.view_count} views</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant={t.pinned ? "default" : "outline"} onClick={() => togglePin(t.id, t.pinned)} className="h-7 text-xs gap-1 px-2">
                    <Pin className="h-3 w-3" /> {t.pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button size="sm" variant={t.locked ? "default" : "outline"} onClick={() => toggleLock(t.id, t.locked)} className="h-7 text-xs gap-1 px-2">
                    <Lock className="h-3 w-3" /> {t.locked ? "Unlock" : "Lock"}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeThread(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {filteredNormal.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No threads found.</p>}
          </div>
        </>
      ) : (
        <div className="space-y-5">
          {/* Pending WhatsApp groups */}
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              Pending Approval
              {waPending.length > 0 && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{waPending.length}</span>}
            </p>
            {waPending.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg bg-secondary p-3">No pending WhatsApp groups.</p>
            ) : (
              <div className="space-y-2">
                {waPending.map(g => {
                  let link = "", description = "", examFocus = "General";
                  try { const j = JSON.parse(g.body); link = j.link ?? ""; description = j.description ?? ""; examFocus = j.examFocus ?? "General"; } catch { link = g.body; }
                  return (
                    <div key={g.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{g.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Focus: {examFocus} · Submitted {new Date(g.created_at).toLocaleDateString()}</p>
                          {description && <p className="text-xs text-foreground mt-1 line-clamp-2">{description}</p>}
                          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 block truncate">{link}</a>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" onClick={() => approveWa(g.id)} className="h-7 text-xs bg-success text-success-foreground hover:bg-success/90 gap-1 px-2">
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeThread(g.id)} className="h-7 text-xs text-destructive px-2">
                            <Trash2 className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live WhatsApp groups */}
          <div>
            <p className="text-sm font-semibold mb-2">Live Groups ({waApproved.length})</p>
            {waApproved.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg bg-secondary p-3">No approved groups yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {waApproved.map(g => {
                  let link = ""; try { link = JSON.parse(g.body).link ?? ""; } catch { link = g.body; }
                  return (
                    <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm line-clamp-1">{g.title}</p>
                        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate block">{link}</a>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => togglePin(g.id, true)} className="h-7 text-xs gap-1 px-2">
                        <Trash2 className="h-3 w-3 text-destructive" /> Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditSectionInline({ section, onSave, onCancel }: { section: { label: string; icon: string }; onSave: (u: Record<string, unknown>) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(section.label);
  const [icon, setIcon] = useState(section.icon);
  return (
    <div className="space-y-2">
      <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" />
      <Select value={icon} onValueChange={setIcon}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave({ label, icon })}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function EditLinkInline({ link, onSave, onCancel }: { link: { label: string; description: string; icon: string; url: string }; onSave: (u: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ label: link.label, description: link.description, icon: link.icon, url: link.url });
  return (
    <div className="space-y-2">
      <Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="Label" />
      <Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Description" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="/url" />
        <Select value={f.icon} onValueChange={v => setF({ ...f, icon: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(f)}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
