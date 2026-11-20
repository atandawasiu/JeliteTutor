import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Bookmark, Sparkles, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { AIChatWidget } from "@/components/AIChatWidget";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Subject = { id: string; name: string; exams: { name: string } | null };
type Question = { id: string; question: string; options: string[]; correct_answer: string; explanation: string | null; subject_id: string };

export const Route = createFileRoute("/practice")({
  component: () => <RequireAuth><PracticeBuilder /></RequireAuth>,
});

function PracticeBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [starting, setStarting] = useState(false);

  // Session state
  const [session, setSession] = useState<{ questions: Question[] } | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; questions: Question[] } | null>(null);
  const [explainCtx, setExplainCtx] = useState<{ question: string; options: string[]; correctAnswer: string; userAnswer?: string } | undefined>();
  const [explainSignal, setExplainSignal] = useState(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    supabase.from("subjects").select("id, name, exams(name)").order("name").then(({ data }) => {
      setSubjects((data ?? []) as never);
      setLoading(false);
    });
  }, []);

  // Timer
  useEffect(() => {
    if (!session || result) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, result]);

  const MAX_SUBJECTS_PER_EXAM = 4;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      const subject = subjects.find(s => s.id === id);
      const examName = subject?.exams?.name ?? "Other";
      const examSubjects = subjects.filter(s => (s.exams?.name ?? "Other") === examName);
      const pickedFromExam = examSubjects.filter(s => next.has(s.id)).length;
      if (pickedFromExam >= MAX_SUBJECTS_PER_EXAM) {
        toast.error(`Max ${MAX_SUBJECTS_PER_EXAM} subjects per exam (${examName})`);
        return;
      }
      next.add(id);
    }
    setPicked(next);
  };

  const start = async () => {
    if (picked.size === 0) { toast.error("Pick at least one subject"); return; }
    if (count < 5 || count > 100) { toast.error("Choose 5–100 questions"); return; }
    if (minutes < 1 || minutes > 240) { toast.error("Time must be 1–240 minutes"); return; }
    setStarting(true);
    const { data, error } = await supabase
      .from("questions")
      .select("id, question, options, correct_answer, explanation, subject_id")
      .in("subject_id", [...picked])
      .limit(500);
    setStarting(false);
    if (error || !data || data.length === 0) { toast.error("No questions found for those subjects"); return; }
    const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, count)
      .map(q => ({ ...q, options: q.options as string[] })) as Question[];
    setSession({ questions: shuffled });
    setTimeLeft(minutes * 60);
    startTimeRef.current = Date.now();
    setCurrentIdx(0); setAnswers({}); setResult(null);
  };

  const select = (qid: string, opt: string) => setAnswers(p => ({ ...p, [qid]: opt }));
  const toggleBookmark = async (qid: string) => {
    if (!user) return;
    const next = new Set(bookmarked);
    const isBookmarked = next.has(qid);
    const { error } = isBookmarked
      ? await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("question_id", qid)
      : await supabase.from("bookmarks").insert({ user_id: user.id, question_id: qid });
    if (error) {
      toast.error("Bookmark couldn't be updated. Please try again.");
      return;
    }
    if (isBookmarked) next.delete(qid);
    else next.add(qid);
    setBookmarked(next);
    toast.success(isBookmarked ? "Bookmark removed" : "Question bookmarked");
  };

  const handleSubmit = async (auto = false) => {
    if (!session || submitting || result || !user) return;
    setSubmitting(true);
    const qs = session.questions;
    const correct = qs.reduce((a, q) => a + (answers[q.id] === q.correct_answer ? 1 : 0), 0);
    const score = Math.round((correct / qs.length) * 100);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Group by subject so each gets its own attempt row (works with current schema)
    const bySubject: Record<string, Question[]> = {};
    qs.forEach(q => { (bySubject[q.subject_id] ??= []).push(q); });

    const subjectIds = Object.keys(bySubject);
    const { data: subjMeta } = await supabase.from("subjects").select("id, exam_id").in("id", subjectIds);
    const examFor: Record<string, string> = {};
    (subjMeta ?? []).forEach((s: { id: string; exam_id: string }) => { examFor[s.id] = s.exam_id; });

    for (const sid of subjectIds) {
      const sQs = bySubject[sid];
      const sCorrect = sQs.reduce((a, q) => a + (answers[q.id] === q.correct_answer ? 1 : 0), 0);
      const sScore = Math.round((sCorrect / sQs.length) * 100);
      const { data: att, error: attemptError } = await supabase.from("attempts").insert({
        user_id: user.id, exam_id: examFor[sid], subject_id: sid,
        score: sScore, correct_count: sCorrect, total_questions: sQs.length,
        time_taken_seconds: Math.round(timeTaken / subjectIds.length), completed: true,
      }).select().single();
      if (attemptError) {
        toast.error("Your result could not be saved. Please try again.");
        setSubmitting(false);
        return;
      }
      if (att) {
        const { error: answersError } = await supabase.from("attempt_answers").insert(sQs.map(q => ({
          attempt_id: att.id, question_id: q.id,
          selected_answer: answers[q.id] ?? null,
          is_correct: answers[q.id] === q.correct_answer,
        })));
        if (answersError) toast.warning("Your score was saved, but some answer details couldn't be saved.");
      }
    }
    setResult({ score, correct, total: qs.length, questions: qs });
    setSubmitting(false);
    if (auto) toast.warning("Time's up — auto-submitted");
    else toast.success(`Practice submitted — ${score}%`);
  };

  const askExplain = (q: Question) => {
    setExplainCtx({ question: q.question, options: q.options, correctAnswer: q.correct_answer, userAnswer: answers[q.id] });
    setExplainSignal(s => s + 1);
  };

  const fmtTime = useMemo(() => {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  // ---------- RESULT ----------
  if (result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="font-display text-3xl font-bold">{result.score}%</h1>
          <p className="mt-1 text-sm text-muted-foreground">{result.correct} of {result.total} correct</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => { setSession(null); setResult(null); }} variant="outline">New session</Button>
            <Button onClick={() => navigate({ to: "/dashboard" })} className="bg-gradient-hero text-white">Back to dashboard</Button>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {result.questions.map((q, i) => {
            const ua = answers[q.id]; const ok = ua === q.correct_answer;
            return (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  {ok ? <CheckCircle2 className="h-5 w-5 text-success flex-none mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive flex-none mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{i + 1}. {q.question}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      {q.options.map((o, oi) => (
                        <p key={oi} className={cn(o === q.correct_answer ? "text-success font-medium" : ua === o ? "text-destructive line-through" : "text-muted-foreground")}>
                          {String.fromCharCode(65 + oi)}) {o}
                        </p>
                      ))}
                    </div>
                    {q.explanation && <p className="mt-2 text-xs text-muted-foreground italic">Explanation: {q.explanation}</p>}
                    <Button size="sm" variant="ghost" onClick={() => askExplain(q)} className="mt-2 text-primary text-xs">
                      <Sparkles className="h-3 w-3 mr-1" /> Ask AI to explain
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <AIChatWidget context={explainCtx ? { currentQuestion: explainCtx } : undefined} openSignal={explainSignal} />
      </div>
    );
  }

  // ---------- SESSION ----------
  if (session) {
    const q = session.questions[currentIdx];
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Question {currentIdx + 1} of {session.questions.length}</span>
            <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
              <Clock className="h-3.5 w-3.5" /> {fmtTime}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-hero" style={{ width: `${((currentIdx + 1) / session.questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-medium">{q.question}</p>
            <button onClick={() => toggleBookmark(q.id)} className="flex-none text-muted-foreground hover:text-primary">
              <Bookmark className={cn("h-5 w-5", bookmarked.has(q.id) && "fill-primary text-primary")} />
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {q.options.map((o, oi) => {
              const sel = answers[q.id] === o;
              return (
                <button key={oi} onClick={() => select(q.id, o)}
                  className={cn("w-full rounded-xl border p-3 text-left text-sm transition", sel ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")}>
                  <span className="font-bold mr-2">{String.fromCharCode(65 + oi)})</span>{o}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          {currentIdx === session.questions.length - 1 ? (
            <Button onClick={() => handleSubmit(false)} disabled={submitting} className="bg-gradient-hero text-white">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Submit
            </Button>
          ) : (
            <Button onClick={() => setCurrentIdx(i => i + 1)} className="bg-gradient-hero text-white">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---------- BUILDER ----------
  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const grouped = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    const k = s.exams?.name ?? "Other";
    (acc[k] ??= []).push(s); return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Settings2 className="h-7 w-7 text-primary" /> Custom Practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build your own mock exam — pick subjects, set the timer and number of questions.</p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Subjects ({picked.size} selected)</Label>
            <span className="text-xs text-muted-foreground">Max {MAX_SUBJECTS_PER_EXAM} per exam</span>
          </div>
          <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-2">
            {Object.entries(grouped).map(([exam, subs]) => {
              const pickedInGroup = subs.filter(s => picked.has(s.id)).length;
              const atMax = pickedInGroup >= MAX_SUBJECTS_PER_EXAM;
              return (
                <div key={exam}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{exam}</p>
                    <span className={cn("text-xs font-medium tabular-nums", atMax ? "text-primary font-semibold" : "text-muted-foreground")}>
                      {pickedInGroup}/{MAX_SUBJECTS_PER_EXAM}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {subs.map(s => {
                      const isChecked = picked.has(s.id);
                      const disabled = atMax && !isChecked;
                      return (
                        <label key={s.id} className={cn("flex items-center gap-2 rounded-lg border p-2 transition", isChecked ? "border-primary bg-primary/5 cursor-pointer" : disabled ? "border-border opacity-40 cursor-not-allowed" : "border-border cursor-pointer hover:border-primary/40")}>
                          <Checkbox checked={isChecked} onCheckedChange={() => toggle(s.id)} disabled={disabled} />
                          <span className="text-sm">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Questions</Label>
            <Input type="number" min={5} max={100} value={count} onChange={e => setCount(parseInt(e.target.value || "0", 10))} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">5 to 100</p>
          </div>
          <div>
            <Label>Time (minutes)</Label>
            <Input type="number" min={1} max={240} value={minutes} onChange={e => setMinutes(parseInt(e.target.value || "0", 10))} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">1 to 240</p>
          </div>
        </div>

        <Button onClick={start} disabled={starting} className="w-full bg-gradient-hero text-white" size="lg">
          {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Start practice
        </Button>
      </div>
    </div>
  );
}
