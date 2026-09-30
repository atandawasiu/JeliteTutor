import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Loader2, Target, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/welcome")({
  component: () => <RequireAuth><WelcomePage /></RequireAuth>,
});

type Exam = { id: string; name: string; region: string };
type Subject = { id: string; name: string; exam_id: string };

function WelcomePage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pickedExams, setPickedExams] = useState<string[]>([]);
  const [pickedSubjects, setPickedSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState(30);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: s }] = await Promise.all([
        supabase.from("exams").select("id, name, region").order("name"),
        supabase.from("subjects").select("id, name, exam_id").order("name"),
      ]);
      setExams(e ?? []);
      setSubjects(s ?? []);
      setLoading(false);
    })();
  }, []);

  const availableSubjects = useMemo(
    () => subjects.filter((s) => pickedExams.includes(s.exam_id)),
    [subjects, pickedExams],
  );

  const toggle = (arr: string[], setArr: (a: string[]) => void, id: string) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      selected_exam_ids: pickedExams,
      selected_subject_ids: pickedSubjects,
      daily_goal_minutes: goal,
      onboarded: true,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("All set! Let's start learning 🎉");
    navigate({ to: "/dashboard" });
  };

  const steps = [
    { title: "Welcome to Jelite Tutor 👋", subtitle: "Let's personalise your study plan in 3 quick steps." },
    { title: "Which exams are you preparing for?", subtitle: "Pick one or more — you can change this anytime." },
    { title: "Choose your subjects", subtitle: "We'll surface practice questions and notes for these first." },
    { title: "Set your daily study goal", subtitle: "Consistency beats intensity. How many minutes per day?" },
  ];

  const canNext = () =>
    step === 0 ||
    (step === 1 && pickedExams.length > 0) ||
    (step === 2 && pickedSubjects.length > 0) ||
    step === 3;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col px-4 py-8 sm:px-6">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-gradient-hero" : "bg-secondary"}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{steps[step].title}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{steps[step].subtitle}</p>

          <div className="mt-8">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: BookOpen, title: "Real exam questions", desc: "JAMB, WAEC, IELTS, SAT and more" },
                  { icon: Target, title: "Smart progress", desc: "See your weak areas instantly" },
                  { icon: Sparkles, title: "Personalised", desc: "Tailored to your goals & schedule" },
                ].map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-display font-semibold text-foreground">{c.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {step === 1 && (
              loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {exams.map((e) => {
                    const picked = pickedExams.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        onClick={() => toggle(pickedExams, setPickedExams, e.id)}
                        className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                          picked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        {picked && (
                          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <p className="font-display font-semibold text-foreground">{e.name}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{e.region}</p>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {step === 2 && (
              availableSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects available for the selected exams yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSubjects.map((s) => {
                    const picked = pickedSubjects.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggle(pickedSubjects, setPickedSubjects, s.id)}
                        className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${
                          picked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => setGoal(m)}
                    className={`rounded-2xl border-2 p-5 text-center transition-all ${
                      goal === m ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="font-display text-3xl font-bold text-foreground">{m}</p>
                    <p className="mt-1 text-xs text-muted-foreground">minutes / day</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => (step > 0 ? setStep(step - 1) : navigate({ to: "/dashboard" }))}
          disabled={saving}
        >
          {step > 0 ? "Back" : "Skip for now"}
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="gap-2 bg-gradient-hero text-white shadow-hero hover:opacity-90"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={finish}
            disabled={saving}
            className="gap-2 bg-gradient-hero text-white shadow-hero hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Finish <Check className="h-4 w-4" /></>}
          </Button>
        )}
      </div>
    </div>
  );
}
