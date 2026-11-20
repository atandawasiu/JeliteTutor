import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Clock, ChevronLeft, ChevronRight, Flag, CheckCircle2,
  XCircle, Bookmark, Sparkles, Pause, Play, AlertTriangle, RotateCcw,
  BarChart2, ChevronDown, Filter, Hash, Calendar, Layers, Zap, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { AIChatWidget } from "@/components/AIChatWidget";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Difficulty = "easy" | "medium" | "hard";
type Question = {
  id: string; question: string; options: string[];
  correct_answer: string; explanation: string | null;
  year: number | null; difficulty: Difficulty; topic: string | null;
};
type Subject = {
  id: string; name: string; exam_id: string;
  exams: { id: string; name: string; duration_minutes: number };
};
type ExamMode = "exam" | "practice";
type SetupConfig = {
  year: number | "all";
  count: number;
  mode: ExamMode;
  difficulty: Difficulty | "all";
};

function shuffleQuestions<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export const Route = createFileRoute("/cbt/$subjectId")({
  component: () => <RequireAuth><CBTEngine /></RequireAuth>,
});

const QUESTION_COUNTS = [10, 20, 30, 40, 50, 60];
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "text-success bg-success/10 border-success/20",
  medium: "text-warning bg-warning/10 border-warning/20",
  hard: "text-destructive bg-destructive/10 border-destructive/20",
};

function CBTEngine() {
  const { subjectId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [config, setConfig] = useState<SetupConfig>({ year: "all", count: 40, mode: "exam", difficulty: "all" });

  const [phase, setPhase] = useState<"setup" | "active" | "result">("setup");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // practice mode
  const [timeLeft, setTimeLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; timeTaken: number } | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const autoSubmitRef = useRef(false);
  const submitLockRef = useRef(false);

  const [explainCtx, setExplainCtx] = useState<{ question: string; options: string[]; correctAnswer: string; userAnswer?: string } | undefined>();
  const [explainSignal, setExplainSignal] = useState(0);
  const [explainPrompt, setExplainPrompt] = useState<string | undefined>();

  type WolframPod = { title: string; id: string; subpods: { title: string; plaintext: string; img?: { src: string; alt: string } }[] };
  type WolframSolveResult = { success: true; pods: WolframPod[]; inputstring: string } | { success: false; didyoumean: string[]; tips: string[] };
  type WolframState = { loading: boolean; result: WolframSolveResult | null; error: string | null };
  const [wolframResults, setWolframResults] = useState<Record<string, WolframState>>({});

  const startTimeRef = useRef<number>(0);
  const storageKey = `cbt_${subjectId}_${user?.id}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const [subjectResult, questionResult] = await Promise.all([
          supabase.from("subjects").select("id, name, exam_id, exams(id, name, duration_minutes)").eq("id", subjectId).single(),
          supabase.from("questions").select("id, question, options, correct_answer, explanation, year, difficulty, topic").eq("subject_id", subjectId).limit(500),
        ]);
        if (subjectResult.error || questionResult.error || !subjectResult.data) {
          throw new Error("Unable to load this subject and its questions.");
        }

        const mapped = (questionResult.data ?? []).map(q => ({ ...q, options: q.options as string[] })) as Question[];
        const years = [...new Set(mapped.map(q => q.year).filter(Boolean) as number[])].sort((a, b) => b - a);
        if (!cancelled) {
          setSubject(subjectResult.data as unknown as Subject);
          setAllQuestions(mapped);
          setAvailableYears(years);
        }
      } catch {
        if (!cancelled) setLoadError("We couldn't load this subject right now. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [subjectId, loadAttempt]);

  useEffect(() => {
    if (!user || allQuestions.length === 0) {
      setBookmarked(new Set());
      return;
    }

    let cancelled = false;
    void supabase
      .from("bookmarks")
      .select("question_id")
      .eq("user_id", user.id)
      .in("question_id", allQuestions.map(question => question.id))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Saved bookmarks couldn't be loaded.");
          return;
        }
        setBookmarked(new Set((data ?? []).map(bookmark => bookmark.question_id)));
      });

    return () => { cancelled = true; };
  }, [allQuestions, user]);

  const startExam = () => {
    let pool = [...allQuestions];
    if (config.year !== "all") pool = pool.filter(q => q.year === config.year);
    if (config.difficulty !== "all") pool = pool.filter(q => q.difficulty === config.difficulty);
    if (pool.length === 0) { toast.error("No questions match your filters. Try different settings."); return; }
    const shuffled = shuffleQuestions(pool).slice(0, config.count);
    setQuestions(shuffled);
    const dur = (subject?.exams?.duration_minutes ?? 30) * 60;
    setTimeLeft(dur);
    startTimeRef.current = Date.now();
    autoSubmitRef.current = false;
    submitLockRef.current = false;
    setAnswers({});
    setFlagged(new Set());
    setRevealed(new Set());
    setCurrentIdx(0);
    setPhase("active");
    localStorage.removeItem(storageKey);
  };

  // Timer — decrement every second; flag auto-submit when it reaches 0
  useEffect(() => {
    if (phase !== "active" || paused) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            // Defer to avoid calling setState inside setState
            setTimeout(() => void submitExam(true), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused]);

  const selectAnswer = (qid: string, opt: string) => {
    if (config.mode === "practice" && revealed.has(qid)) return;
    setAnswers(p => ({ ...p, [qid]: opt }));
    if (config.mode === "practice") {
      setRevealed(p => new Set([...p, qid]));
    }
  };

  const toggleFlag = (qid: string) => {
    setFlagged(p => { const n = new Set(p); n.has(qid) ? n.delete(qid) : n.add(qid); return n; });
  };
  const toggleBookmark = async (qid: string) => {
    if (!user) return;
    const isBookmarked = bookmarked.has(qid);
    const { error } = isBookmarked
      ? await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("question_id", qid)
      : await supabase.from("bookmarks").insert({ user_id: user.id, question_id: qid });
    if (error) {
      toast.error("Bookmark couldn't be updated. Please try again.");
      return;
    }
    setBookmarked(current => {
      const next = new Set(current);
      if (isBookmarked) next.delete(qid);
      else next.add(qid);
      return next;
    });
    toast.success(isBookmarked ? "Bookmark removed" : "Question bookmarked");
  };

  const solveWithWolfram = async (qid: string, question: string) => {
    setWolframResults(p => ({ ...p, [qid]: { loading: true, result: null, error: null } }));
    try {
      const res = await fetch(`/api/wolfram?q=${encodeURIComponent(question)}&format=plaintext,image`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setWolframResults(p => ({ ...p, [qid]: { loading: false, result: null, error: err.error ?? "Request failed" } }));
        return;
      }
      const data = await res.json() as WolframSolveResult;
      setWolframResults(p => ({ ...p, [qid]: { loading: false, result: data, error: null } }));
    } catch {
      setWolframResults(p => ({ ...p, [qid]: { loading: false, result: null, error: "Could not reach WolframAlpha" } }));
    }
  };

  const submitExam = async (auto = false) => {
    if (submitLockRef.current || submitting || phase === "result" || !user || !subject) return;
    submitLockRef.current = true;
    setSubmitting(true);
    const correctCount = questions.reduce((acc, q) => acc + (answers[q.id] === q.correct_answer ? 1 : 0), 0);
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    let attemptSaved = false;

    try {
      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({ user_id: user.id, exam_id: subject.exam_id, subject_id: subject.id, score, correct_count: correctCount, total_questions: questions.length, time_taken_seconds: timeTaken, completed: true })
        .select().single();

      if (attemptError || !attempt) {
        toast.error("Your result couldn't be saved. Please try again.");
        return;
      }
      attemptSaved = true;

      let answerDetailsSaved = true;
      try {
        const { error: answersError } = await supabase.from("attempt_answers").insert(
          questions.map(q => ({ attempt_id: attempt.id, question_id: q.id, selected_answer: answers[q.id] ?? null, is_correct: answers[q.id] === q.correct_answer }))
        );
        answerDetailsSaved = !answersError;
      } catch {
        answerDetailsSaved = false;
      }

      localStorage.removeItem(storageKey);
      setResult({ score, correct: correctCount, total: questions.length, timeTaken });
      setPhase("result");
      if (!answerDetailsSaved) toast.warning("Your score was saved, but some answer details couldn't be saved.");
      if (auto) toast.warning("Time's up! Test auto-submitted.");
      else if (answerDetailsSaved) toast.success(`Test submitted — ${score}%`);
    } catch {
      toast.error("Your result couldn't be saved. Please try again.");
    } finally {
      setSubmitting(false);
      if (!attemptSaved) submitLockRef.current = false;
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const answered = Object.keys(answers).length;
  const isWarning = timeLeft > 0 && timeLeft < 120;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading subject" /></div>;

  if (loadError || !subject) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-xl font-semibold">Subject unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "This subject could not be found."}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/exams" })}>Back to exams</Button>
          <Button onClick={() => setLoadAttempt(value => value + 1)}>Try again</Button>
        </div>
      </div>
    );
  }

  // ── SETUP SCREEN ────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const filteredCount = allQuestions.filter(q => {
      if (config.year !== "all" && q.year !== config.year) return false;
      if (config.difficulty !== "all" && q.difficulty !== config.difficulty) return false;
      return true;
    }).length;
    const diffCounts = { all: allQuestions.length, easy: 0, medium: 0, hard: 0 };
    allQuestions.forEach(q => { if (q.difficulty in diffCounts) diffCounts[q.difficulty]++; });

    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate({ to: "/exams" })} className="text-muted-foreground hover:text-foreground transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold">{subject?.name}</h1>
            <p className="text-sm text-muted-foreground">{subject?.exams?.name} · {allQuestions.length} questions available</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" /> Exam Mode</p>
            <div className="grid grid-cols-2 gap-3">
              {(["exam", "practice"] as ExamMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setConfig(c => ({ ...c, mode: m }))}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    config.mode === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  )}
                >
                  <p className="font-semibold capitalize">{m === "exam" ? "🎯 Exam Mode" : "📚 Practice Mode"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m === "exam" ? "Timed. See results after submitting." : "See the correct answer after each question."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Question count */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Hash className="h-4 w-4 text-primary" /> Number of Questions</p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setConfig(c => ({ ...c, count: n }))}
                  disabled={n > filteredCount}
                  className={cn(
                    "rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all",
                    config.count === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
                    n > filteredCount && "cursor-not-allowed opacity-40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{filteredCount} questions match your current filters</p>
          </div>

          {/* Year filter */}
          {availableYears.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Calendar className="h-4 w-4 text-primary" /> Examination Year</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConfig(c => ({ ...c, year: "all" }))}
                  className={cn("rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-all",
                    config.year === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40")}
                >
                  All Years
                </button>
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setConfig(c => ({ ...c, year: y }))}
                    className={cn("rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-all",
                      config.year === y ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40")}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-primary" /> Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "easy", "medium", "hard"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                  className={cn(
                    "rounded-xl border-2 px-4 py-2 text-sm font-semibold capitalize transition-all",
                    config.difficulty === d ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                  )}
                >
                  {d === "all" ? "All" : d} {d !== "all" && <span className="ml-1 text-xs opacity-70">({diffCounts[d]})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Summary + time estimate */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 flex flex-wrap gap-4 text-sm">
            <div><span className="text-muted-foreground">Questions:</span> <strong>{Math.min(config.count, filteredCount)}</strong></div>
            <div><span className="text-muted-foreground">Duration:</span> <strong>{subject?.exams?.duration_minutes} min</strong></div>
            <div><span className="text-muted-foreground">Mode:</span> <strong className="capitalize">{config.mode}</strong></div>
            {config.year !== "all" && <div><span className="text-muted-foreground">Year:</span> <strong>{config.year}</strong></div>}
            {config.difficulty !== "all" && <div><span className="text-muted-foreground">Difficulty:</span> <strong className="capitalize">{config.difficulty}</strong></div>}
          </div>

          {/* Instructions */}
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground mb-2">Instructions</p>
            <p>• {config.mode === "exam" ? "Timer runs continuously — answers reviewed after submit." : "Each answer is revealed immediately with explanation."}</p>
            <p>• Navigate freely between questions using the question panel.</p>
            <p>• Flag questions you want to revisit using the flag icon.</p>
            <p>• Bookmark any question to save it for later review.</p>
            {config.mode === "exam" && <p>• The test auto-submits when time runs out.</p>}
          </div>

          <Button
            onClick={startExam}
            disabled={filteredCount === 0}
            className="w-full bg-gradient-hero text-white text-base h-12 shadow-hero hover:opacity-90"
          >
            {filteredCount === 0 ? "No questions available" : `Start ${config.mode === "practice" ? "Practice" : "Exam"}`}
          </Button>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const pct = result.score;
    const grade = pct >= 70 ? { label: "Excellent!", color: "text-success", bg: "bg-success/10" }
      : pct >= 50 ? { label: "Good effort!", color: "text-warning", bg: "bg-warning/10" }
      : { label: "Needs work", color: "text-destructive", bg: "bg-destructive/10" };
    const mins = Math.floor(result.timeTaken / 60);
    const secs = result.timeTaken % 60;

    const topicBreakdown = questions.reduce<Record<string, { correct: number; total: number }>>((acc, q) => {
      const t = q.topic ?? "General";
      if (!acc[t]) acc[t] = { correct: 0, total: 0 };
      acc[t].total++;
      if (answers[q.id] === q.correct_answer) acc[t].correct++;
      return acc;
    }, {});

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className={cn("rounded-2xl border border-border p-8 text-center", grade.bg)}>
          <div className={cn("mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-card")}>
            <span className={cn("font-display text-3xl font-bold", grade.color)}>{pct}%</span>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">{grade.label}</h1>
          <p className="mt-1 text-muted-foreground">{subject?.name} — {subject?.exams?.name}</p>
          {config.year !== "all" && <p className="text-sm text-muted-foreground">{config.year} Past Questions</p>}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-card p-4"><p className="text-2xl font-bold text-success">{result.correct}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div className="rounded-xl bg-card p-4"><p className="text-2xl font-bold text-destructive">{result.total - result.correct}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
            <div className="rounded-xl bg-card p-4"><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
            <div className="rounded-xl bg-card p-4"><p className="text-2xl font-bold text-primary">{mins}:{String(secs).padStart(2, "0")}</p><p className="text-xs text-muted-foreground">Time taken</p></div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <Button onClick={() => { setPhase("setup"); setResult(null); }} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Retry</Button>
            <Button onClick={() => navigate({ to: "/dashboard" })} className="bg-gradient-hero text-white gap-2"><BarChart2 className="h-4 w-4" /> Dashboard</Button>
            <Button onClick={() => navigate({ to: "/exams" })} variant="outline">More Exams</Button>
          </div>
        </div>

        {/* Topic breakdown */}
        {Object.keys(topicBreakdown).length > 1 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" /> Performance by Topic</h3>
            <div className="space-y-2">
              {Object.entries(topicBreakdown).map(([topic, { correct, total }]) => {
                const p = Math.round((correct / total) * 100);
                return (
                  <div key={topic}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{topic}</span>
                      <span className={p >= 70 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}>{correct}/{total} ({p}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", p >= 70 ? "bg-success" : p >= 50 ? "bg-warning" : "bg-destructive")} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Study Resources for weak topics */}
        {(() => {
          const weakTopics = Object.entries(topicBreakdown)
            .filter(([, { correct, total }]) => Math.round((correct / total) * 100) < 70)
            .map(([topic]) => topic);
          if (weakTopics.length === 0) return null;
          const examName = subject?.exams?.name ?? "";
          return (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-semibold mb-1 flex items-center gap-2">
                📺 Study Resources
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Topics where you scored under 70% — click to find video tutorials on YouTube.</p>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((topic) => (
                  <a
                    key={topic}
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} ${examName} tutorial explanation`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    ▶ {topic}
                  </a>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">Opens YouTube search in a new tab. Look for channels like Exam Success, Gidiclass, JAMB Success for relevant content.</p>
            </div>
          );
        })()}

        {/* Review */}
        <div className="mt-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Review Answers</h2>
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const isCorrect = userAns === q.correct_answer;
            return (
              <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  {isCorrect ? <CheckCircle2 className="h-5 w-5 flex-none text-success mt-0.5" /> : <XCircle className="h-5 w-5 flex-none text-destructive mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                      {q.year && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{q.year}</span>}
                      {q.difficulty && <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</span>}
                      {q.topic && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{q.topic}</span>}
                    </div>
                    <p className="font-medium text-sm">{q.question}</p>
                  </div>
                </div>
                <div className="mt-3 ml-8 space-y-1.5">
                  {q.options.map(opt => (
                    <div key={opt} className={cn("rounded-lg px-3 py-2 text-sm border",
                      opt === q.correct_answer ? "bg-success/10 text-success border-success/20 font-medium" :
                      opt === userAns ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-secondary/50 border-transparent"
                    )}>
                      {opt}
                      {opt === q.correct_answer && " ✓"}
                      {opt === userAns && opt !== q.correct_answer && " (your answer)"}
                    </div>
                  ))}
                </div>
                {q.explanation && <p className="mt-3 ml-8 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">💡 {q.explanation}</p>}
                <div className="mt-3 ml-8 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                    setExplainCtx({ question: q.question, options: q.options, correctAnswer: q.correct_answer, userAnswer: userAns });
                    setExplainPrompt("Please explain this question step-by-step in simple terms.");
                    setExplainSignal(Date.now());
                  }}>
                    <Sparkles className="h-3.5 w-3.5" /> Ask AI to explain
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950"
                    disabled={wolframResults[q.id]?.loading}
                    onClick={() => void solveWithWolfram(q.id, q.question)}
                  >
                    {wolframResults[q.id]?.loading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Solving…</>
                      : <><FlaskConical className="h-3.5 w-3.5" /> Solve with Wolfram</>}
                  </Button>
                </div>
                {(() => {
                  const wr = wolframResults[q.id];
                  if (!wr || wr.loading) return null;
                  return (
                    <div className="mt-2 ml-8 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
                      {wr.error && <p className="text-xs text-destructive">⚠ {wr.error}</p>}
                      {wr.result && !wr.result.success && (
                        <p className="text-xs text-muted-foreground">No computational result for this question type.</p>
                      )}
                      {wr.result && wr.result.success && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                            <FlaskConical className="h-3 w-3" /> WolframAlpha Solution
                          </p>
                          {wr.result.pods.slice(0, 5).map(pod => (
                            <div key={pod.id} className="border-t border-purple-100 dark:border-purple-900 pt-1.5 first:border-0 first:pt-0">
                              <p className="text-xs font-medium text-foreground mb-1">{pod.title}</p>
                              {pod.subpods.map((sp, si) => (
                                <div key={si}>
                                  {sp.plaintext && <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">{sp.plaintext}</pre>}
                                  {sp.img && <img src={sp.img.src} alt={sp.img.alt || pod.title} className="max-w-full rounded mt-1" loading="lazy" />}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <AIChatWidget context={explainCtx ? { currentQuestion: explainCtx } : undefined} openSignal={explainSignal} starterPrompt={explainPrompt} />
      </div>
    );
  }

  // ── ACTIVE EXAM ──────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;
  const isRevealed = config.mode === "practice" && revealed.has(q.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{subject?.exams?.name} · {subject?.name}</p>
            <p className="text-sm font-semibold">Q{currentIdx + 1} / {questions.length}</p>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:flex flex-1 items-center gap-2 max-w-xs">
            <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-gradient-hero transition-all duration-300" style={{ width: `${(answered / questions.length) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{answered}/{questions.length}</span>
          </div>

          <div className="flex items-center gap-2">
            {config.mode === "exam" && (
              <>
                <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono font-bold text-sm",
                  isWarning ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary")}>
                  <Clock className="h-3.5 w-3.5" />
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </div>
                <button onClick={() => setPaused(p => !p)} className="rounded-lg border border-border p-1.5 hover:bg-secondary transition" title={paused ? "Resume" : "Pause"}>
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
              </>
            )}
            {config.mode === "practice" && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Practice Mode</span>
            )}
          </div>
        </div>

        {/* Pause overlay */}
        <AnimatePresence>
          {paused && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 top-full z-30 flex flex-col items-center justify-center bg-background/95 backdrop-blur min-h-screen"
            >
              <Pause className="h-16 w-16 text-primary mb-4 opacity-40" />
              <p className="font-display text-2xl font-bold mb-2">Test Paused</p>
              <p className="text-muted-foreground mb-6">Your progress is saved</p>
              <Button onClick={() => setPaused(false)} className="bg-gradient-hero text-white gap-2"><Play className="h-4 w-4" /> Resume</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Question card */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={q.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              <div className="rounded-2xl border border-border bg-card p-6">
                {/* Meta row */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {q.year && <span className="text-xs bg-secondary px-2 py-1 rounded-full font-medium">{q.year}</span>}
                    {q.difficulty && <span className={cn("text-xs px-2 py-1 rounded-full border capitalize font-medium", DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</span>}
                    {q.topic && <span className="text-xs bg-secondary px-2 py-1 rounded-full">{q.topic}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleFlag(q.id)}
                      title="Flag for review"
                      className={cn("rounded-lg p-1.5 transition", flagged.has(q.id) ? "text-warning bg-warning/10" : "text-muted-foreground hover:text-warning hover:bg-warning/10")}
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void toggleBookmark(q.id)}
                      title="Bookmark"
                      className={cn("rounded-lg p-1.5 transition", bookmarked.has(q.id) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
                    >
                      <Bookmark className={cn("h-4 w-4", bookmarked.has(q.id) && "fill-primary")} />
                    </button>
                  </div>
                </div>

                <p className="text-base font-medium leading-relaxed">{q.question}</p>

                <div className="mt-5 space-y-2.5">
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[q.id] === opt;
                    const isCorrect = opt === q.correct_answer;
                    const isWrong = isRevealed && isSelected && !isCorrect;
                    return (
                      <button
                        key={opt}
                        onClick={() => selectAnswer(q.id, opt)}
                        disabled={isRevealed}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm transition-all",
                          isRevealed && isCorrect ? "border-success bg-success/10 text-success" :
                          isWrong ? "border-destructive bg-destructive/10 text-destructive" :
                          isSelected ? "border-primary bg-primary/5" :
                          "border-border hover:border-primary/40 hover:bg-secondary/50",
                          isRevealed && !isSelected && !isCorrect && "opacity-60"
                        )}
                      >
                        <span className={cn(
                          "flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 text-xs font-bold",
                          isRevealed && isCorrect ? "border-success bg-success text-white" :
                          isWrong ? "border-destructive bg-destructive text-white" :
                          isSelected ? "border-primary bg-primary text-primary-foreground" :
                          "border-border bg-secondary"
                        )}>
                          {isRevealed && isCorrect ? <CheckCircle2 className="h-4 w-4" /> :
                           isWrong ? <XCircle className="h-4 w-4" /> :
                           String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Practice mode: show explanation immediately */}
                {isRevealed && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-secondary/50 border border-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {answers[q.id] === q.correct_answer
                        ? <CheckCircle2 className="h-4 w-4 text-success" />
                        : <XCircle className="h-4 w-4 text-destructive" />}
                      <p className="text-sm font-semibold">{answers[q.id] === q.correct_answer ? "Correct!" : "Incorrect"}</p>
                      {answers[q.id] !== q.correct_answer && (
                        <span className="text-xs text-muted-foreground">Answer: <strong className="text-success">{q.correct_answer}</strong></span>
                      )}
                    </div>
                    {q.explanation && <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">{q.explanation}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                        setExplainCtx({ question: q.question, options: q.options, correctAnswer: q.correct_answer, userAnswer: answers[q.id] });
                        setExplainPrompt("Explain this question in detail with step-by-step working.");
                        setExplainSignal(Date.now());
                      }}>
                        <Sparkles className="h-3.5 w-3.5" /> Ask AI to explain
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950"
                        disabled={wolframResults[q.id]?.loading}
                        onClick={() => void solveWithWolfram(q.id, q.question)}
                      >
                        {wolframResults[q.id]?.loading
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Solving…</>
                          : <><FlaskConical className="h-3.5 w-3.5" /> Solve with Wolfram</>}
                      </Button>
                    </div>
                    {(() => {
                      const wr = wolframResults[q.id];
                      if (!wr || wr.loading) return null;
                      return (
                        <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
                          {wr.error && <p className="text-xs text-destructive">⚠ {wr.error}</p>}
                          {wr.result && !wr.result.success && (
                            <p className="text-xs text-muted-foreground">No computational result for this question type.</p>
                          )}
                          {wr.result && wr.result.success && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" /> WolframAlpha Solution
                              </p>
                              {wr.result.pods.slice(0, 5).map(pod => (
                                <div key={pod.id} className="border-t border-purple-100 dark:border-purple-900 pt-1.5 first:border-0 first:pt-0">
                                  <p className="text-xs font-medium text-foreground mb-1">{pod.title}</p>
                                  {pod.subpods.map((sp, si) => (
                                    <div key={si}>
                                      {sp.plaintext && <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">{sp.plaintext}</pre>}
                                      {sp.img && <img src={sp.img.src} alt={sp.img.alt || pod.title} className="max-w-full rounded mt-1" loading="lazy" />}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </div>

              {/* Nav buttons */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                {currentIdx === questions.length - 1 ? (
                  config.mode === "exam" ? (
                    <Button onClick={() => void submitExam(false)} disabled={submitting} className="bg-gradient-hero text-white gap-2">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} Submit Test
                    </Button>
                  ) : (
                    <Button onClick={() => void submitExam(false)} disabled={submitting} className="bg-gradient-hero text-white gap-2">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Finish Practice
                    </Button>
                  )
                ) : (
                  <Button onClick={() => setCurrentIdx(i => i + 1)} className="bg-gradient-hero text-white gap-2">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Question panel */}
        <aside>
          <div className="rounded-2xl border border-border bg-card p-4 sticky top-[64px]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions</p>
              <button onClick={() => setShowPanel(p => !p)} className="text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !showPanel && "-rotate-90")} />
              </button>
            </div>

            {showPanel && (
              <>
                <div className="grid grid-cols-5 gap-1.5">
                  {questions.map((qq, i) => {
                    const isCurrent = i === currentIdx;
                    const isAns = !!answers[qq.id];
                    const isFl = flagged.has(qq.id);
                    return (
                      <button
                        key={qq.id}
                        onClick={() => setCurrentIdx(i)}
                        title={isFl ? "Flagged" : isAns ? "Answered" : "Not answered"}
                        className={cn(
                          "h-9 rounded-lg text-xs font-semibold transition-all relative",
                          isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1" :
                          isFl ? "bg-warning/20 text-warning" :
                          isAns ? "bg-success/20 text-success" :
                          "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        )}
                      >
                        {i + 1}
                        {isFl && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning" />}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-success/20 inline-block" />Answered</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-secondary inline-block" />Skipped</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-warning/20 inline-block" />Flagged</span>
                </div>

                {/* Flagged list */}
                {flagged.size > 0 && (
                  <div className="mt-3 rounded-xl bg-warning/5 border border-warning/20 p-3">
                    <p className="text-xs font-medium text-warning mb-2 flex items-center gap-1"><Flag className="h-3 w-3" /> Flagged ({flagged.size})</p>
                    <div className="flex flex-wrap gap-1">
                      {questions.map((qq, i) => flagged.has(qq.id) ? (
                        <button key={qq.id} onClick={() => setCurrentIdx(i)} className="h-6 w-6 rounded text-xs bg-warning/20 text-warning font-semibold hover:bg-warning/30">{i + 1}</button>
                      ) : null)}
                    </div>
                  </div>
                )}

                {config.mode === "exam" && (
                  <Button variant="outline" size="sm" onClick={() => void submitExam(false)} disabled={submitting} className="mt-4 w-full gap-2 text-xs">
                    <Flag className="h-3.5 w-3.5" /> Submit Now
                  </Button>
                )}

                {/* Unanswered warning */}
                {config.mode === "exam" && answered < questions.length && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-secondary p-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 flex-none text-warning mt-0.5" />
                    {questions.length - answered} unanswered question{questions.length - answered !== 1 ? "s" : ""}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <AIChatWidget context={explainCtx ? { currentQuestion: explainCtx } : undefined} openSignal={explainSignal} starterPrompt={explainPrompt} />
    </div>
  );
}
