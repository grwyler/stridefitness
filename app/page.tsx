"use client";
import { PwaSupport } from "@/components/pwa-support";
import { fitnessNow } from "@/lib/fitness-clock";
import { ProgressExercisePicker } from "@/components/progress-exercise-picker";
import { onLocalDay } from "@/lib/daily-logging";
import { QuickSet } from "@/components/quick-set";
import { WeeklyReviewPanel } from "@/components/weekly-review";
import { CoachBoundary } from "@/components/coach-boundary";
import { TemplateCoach } from "@/components/template-coach";
import { FirstRunCoach } from "@/components/first-run-coach";
import { nextTemplate } from "@/lib/session-rotation";

import { useEffect, useState, useRef } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  Plus,
  TrendingUp,
  CalendarDays,
  ClipboardList,
  Layers,
  Sun,
  Moon,
  Trash2,
  ArrowLeft,
  SlidersHorizontal,
  Flame,
  RotateCcw,
  Leaf,
  X,
  Info,
  Utensils,
  Droplets,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Data,
  Exercise,
  Workout,
  Template,
  SetLog,
  Target,
  uid,
  setOf,
  initialData,
  migrateData,
  history,
  recommend,
  volume,
} from "@/lib/training";
import { PlanChat, PlannerState } from "@/components/plan-chat";
import { SetCoach } from "@/components/set-coach";
import { CoachMemoryProvider } from "@/components/coach-memory";
import { ProfileGate } from "@/components/profile-gate";
import { SessionCoach } from "@/components/session-coach";
import { BodyMeasurements } from "@/components/body-measurements";
import { MuscleRecoveryMap } from "@/components/muscle-recovery";
import { NutritionTracker } from "@/components/nutrition";
import { Goals } from "@/components/goals";
import { ProgressCoach } from "@/components/progress-coach";
import { ActivityEnergy } from "@/components/activity-energy";
import { ExerciseHelp } from "@/components/exercise-help";
import { ExerciseCoach } from "@/components/exercise-coach";
import { RestFeedback } from "@/components/rest-feedback";
import {
  WorkoutEnergyButton,
  WorkoutEnergySummary,
  EnergyResult,
} from "@/components/workout-energy";
import { FeedbackUpdates } from "@/components/feedback-updates";
import { Feedback } from "@/components/feedback";
import { AccountSync, AccountSyncHandle } from "@/components/account-sync";
import { applyPlan, GeneratedPlan, PlanMessage } from "@/lib/plan";
import {
  calorieBudget,
  hydrationTotal,
  localDay,
  nutritionTotals,
} from "@/lib/nutrition";
import { activeCaloriesForDay } from "@/lib/activity-energy";
import { muscleRecovery } from "@/lib/muscle-recovery";
import { estimatedOneRepMax, estimatedStrength } from "@/lib/goals";
const num = (v: number) => v.toLocaleString("en-US");
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Badge({ kind }: { kind: string }) {
  const label = kind === "Baseline" ? "Set baseline" : kind;
  return (
    <span className={"badge " + kind.toLowerCase()}>
      {kind === "Increase" ? (
        <TrendingUp size={13} />
      ) : kind === "Repeat" ? (
        <RotateCcw size={12} />
      ) : kind === "Baseline" ? (
        <SlidersHorizontal size={12} />
      ) : (
        <Leaf size={13} />
      )}{" "}
      {label}
    </span>
  );
}
export default function Page() {
  return (
    <ProfileGate>{(intent) => <Home initialAction={intent} />}</ProfileGate>
  );
}
function Home({
  initialAction = "explore",
}: {
  initialAction?: "plan" | "log" | "explore";
}) {
  const [coachTemplate, setCoachTemplate] = useState(""),
    [templateCoachOpen, setTemplateCoachOpen] = useState(false),
    [welcomeDismissed, setWelcomeDismissed] = useState(false),
    [libraryView, setLibraryView] = useState<"Exercises" | "Templates">("Exercises");
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState(initialAction === "log" ? "Workouts" : "Overview"),
    [active, setActive] = useState<string | null>(null),
    [selected, setSelected] = useState(""),
    [modal, setModal] = useState(
      initialAction === "log"
        ? "new-workout"
        : initialAction === "plan"
          ? "plan"
          : "",
    ),
    [editId, setEditId] = useState(""),
    [deleting, setDeleting] = useState<{ type: string; id: string } | null>(
      null,
    ),
    [query, setQuery] = useState("");
  useEffect(() => {
    setData(initialData());
  }, []);
  useEffect(() => {
    if (data) {
      document.documentElement.classList.toggle("dark", data.dark);
    }
  }, [data]);
  const dataRef = useRef<Data | null>(null);
  dataRef.current = data;
  const accountSyncRef = useRef<AccountSyncHandle>(null);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_training_recommendations",
            description:
              "Read current exercise targets and the performance-based explanations shown in Stride.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              const current = dataRef.current;
              if (!current) throw new Error("Training data is still loading.");
              return {
                exercises: current.exercises.map((e) => ({
                  id: e.id,
                  name: e.name,
                  ...recommend(current, e),
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  if (!data)
    return (
      <div className="loading">
        <Dumbbell /> Loading your training space…
      </div>
    );
  const d = data;
  const planner = d.coachPlanner || { messages: [], plan: null, ids: [] };
  const setPlanner = (next: PlannerState) =>
    setData((current) =>
      current
        ? {
            ...current,
            coachPlanner: {
              ...next,
              messages: next.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
          }
        : current,
    );
  function createPlan() {
    setPlanner({ messages: [], plan: null, ids: [] });
    setModal("plan");
  }
  function viewTemplates() {
    setModal("");
    setLibraryView("Templates");
    setTab("Library");
    requestAnimationFrame(() => {
      document
        .getElementById("saved-templates")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      document
        .getElementById("saved-templates")
        ?.focus({ preventScroll: true });
    });
  }
  function updatePlanDraft(plan: GeneratedPlan, messages: PlanMessage[]) {
    const current = dataRef.current!;
    const currentPlanner = current.coachPlanner || {
      messages: [],
      plan: null,
      ids: [],
    };
    setPlanner({
      ...currentPlanner,
      plan,
      draft: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  }
  function savePlanDraft(plan: GeneratedPlan, messages: PlanMessage[]) {
    const before = dataRef.current!;
    const currentPlanner = before.coachPlanner || {
      messages: [],
      plan: null,
      ids: [],
    };
    const clean = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "assistant" as const,
        content: `Your workout plan is saved to your account. It includes ${plan.workouts.length} ${plan.workouts.length === 1 ? "workout" : "workouts"}. We can keep adjusting it here.`,
      },
    ].slice(-200);
    const result = applyPlan(before, plan, currentPlanner.ids);
    const next = {
      ...result.data,
      coachPlanner: { messages: clean, plan, ids: result.ids, draft: false },
    };
    return new Promise<boolean>((resolve) =>
      window.dispatchEvent(
        new CustomEvent("stride:apply-coach-change", {
          detail: {
            action: "plan",
            before: {
              ...before,
              coachPlanner: {
                ...currentPlanner,
                plan,
                draft: true,
                messages: messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              },
            },
            next,
            label:
              "Workout plan · " +
              plan.workouts.map((w) => w.name).join(", "),
            resolve,
          },
        }),
      ),
    );
  }
  function discardPlanDraft() {
    const current = dataRef.current!;
    const currentPlanner = current.coachPlanner || {
      messages: [],
      plan: null,
      ids: [],
    };
    setPlanner({ ...currentPlanner, plan: null, draft: false });
  }
  const save = (f: (d: Data) => Data) => setData((p) => (p ? f(p) : p));
  function reviewCoachChanges() {
    setModal("");
    requestAnimationFrame(() =>
      window.dispatchEvent(new Event("stride:review-changes")),
    );
  }
  function stage(
    action: import("@/lib/account-operations").Operation["action"],
    before: Data,
    next: Data,
    label: string,
    operationId?: string,
  ) {
    if (!accountSyncRef.current)
      throw new Error("Your account is still loading.");
    const id = accountSyncRef.current.stage(
      action,
      before,
      next,
      label,
      operationId,
    );
    if (id) reviewCoachChanges();
    return id;
  }
  const finished = d.workouts
    .filter((w) => w.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
  const isNewUser =
    !finished.length &&
    !d.templates.length &&
    !d.coachPlanner?.messages.length &&
    !d.activityEnergy?.logs.length &&
    !d.nutrition?.entries.length &&
    !d.bodyMeasurements?.length &&
    !d.goals?.length;
  const recs = d.exercises.map((e) => ({ e, r: recommend(d, e) }));
  const recovery = muscleRecovery(d),
    recoveringMuscles = recovery
      .filter((item) => item.state === "Recovering")
      .sort((a, b) => (a.hoursSince ?? 999) - (b.hoursSince ?? 999));
  const workout = d.workouts.find((w) => w.id === active);
  const updateWorkout = (f: (w: Workout) => Workout) =>
    save((d) => ({
      ...d,
      workouts: d.workouts.map((w) => (w.id === active ? f(w) : w)),
    }));
  function start(t?: Template, name?: string) {
    const w: Workout = {
      id: uid(),
      name: name || t?.name || "New workout",
      ...(t ? { templateId: t.id } : {}),
      date: fitnessNow().toISOString(),
      completed: false,
      difficulty: "Moderate",
      notes: "",
      entries: t
        ? t.entries.map((x) => {
            const e = d.exercises.find((e) => e.id === x.exerciseId)!;
            const r =
              history(d, e.id).length || d.overrides[e.id] || x.weight <= 0
                ? recommend(d, e)
                : x;
            return {
              exerciseId: x.exerciseId,
              sets: Array.from({ length: r.sets }, () =>
                setOf(r.weight, r.reps),
              ),
            };
          })
        : [],
    };
    save((d) => ({ ...d, workouts: [w, ...d.workouts] }));
    setActive(w.id);
    setTab("Workouts");
    setModal("");
  }
  function readyToFinish() {
    if (
      !workout?.entries.length ||
      !workout.entries.some((e) =>
        e.sets.some(
          (s) =>
            s.status === "completed" ||
            s.status === "failed" ||
            s.status === "modified",
        ),
      )
    ) {
      toast.error("Log at least one attempted set first.");
      return false;
    }
    return true;
  }
  function finish(energy: EnergyResult | undefined) {
    if (!workout) return;
    if (
      !workout.entries.length ||
      !workout.entries.some((e) =>
        e.sets.some(
          (s) =>
            s.status === "completed" ||
            s.status === "failed" ||
            s.status === "modified",
        ),
      )
    ) {
      toast.error("Log at least one attempted set first.");
      return;
    }
    const skipped = workout.entries.reduce(
      (count, e) => count + e.sets.filter((s) => s.status === "pending").length,
      0,
    );
    save((d) => ({
      ...d,
      workouts: d.workouts.map((w) =>
        w.id === active
          ? {
              ...w,
              ...energy,
              completed: true,
              entries: w.entries.map((e) => ({
                ...e,
                sets: e.sets.map((s) =>
                  s.status === "pending"
                    ? { ...s, status: "skipped" as const }
                    : s,
                ),
              })),
            }
          : w,
      ),
      overrides: Object.fromEntries(
        Object.entries(d.overrides).filter(
          ([id]) => !workout.entries.some((e) => e.exerciseId === id),
        ),
      ),
    }));
    setActive(null);
    setTab("Overview");
    toast(
      skipped
        ? `Session finished. ${skipped} unfinished ${skipped === 1 ? "set was" : "sets were"} marked skipped. Saving to your account…`
        : "Session finished. Saving to your account…",
    );
  }
  function addExercise(id: string) {
    const e = d.exercises.find((e) => e.id === id)!;
    const r = recommend(d, e);
    updateWorkout((w) => ({
      ...w,
      entries: [
        ...w.entries,
        {
          exerciseId: id,
          sets: Array.from({ length: r.sets }, () => setOf(r.weight, r.reps)),
        },
      ],
    }));
    setModal("");
    toast(e.name + " selected. Saving to your account…");
  }
  function setPatch(eid: string, sid: string, p: Partial<SetLog>) {
    updateWorkout((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.exerciseId === eid
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === sid ? { ...s, ...p } : s)),
            }
          : e,
      ),
    }));
  }
  function showProgress(id: string) {
    setSelected(id);
    setTab("Progress");
    setActive(null);
  }
  const completedToday = finished.find((w) => onLocalDay(w));
  const suggestedTemplate = nextTemplate(d.templates, finished);
  const today = localDay(),
    todayActivities = (d.activityEnergy?.logs || []).filter(
      (log) => log.date === today,
    ),
    activityUsed = !!(
      (d.activityEnergy?.logs.length || 0) +
      (d.activityEnergy?.templates.length || 0)
    );
  const hydrationUsed =
      !!d.nutrition?.hydration &&
      (d.nutrition.hydration.dailyTargetOz !== null ||
        d.nutrition.hydration.entries.length > 0),
    todayHydration = hydrationTotal(d.nutrition, today),
    hydrationTarget = d.nutrition?.hydration?.dailyTargetOz ?? null;
  const nutritionUsed =
      !!d.nutrition &&
      (d.nutrition.entries.length > 0 ||
        d.nutrition.calorieTarget !== null ||
        d.nutrition.proteinTarget !== null ||
        d.nutrition.carbTarget != null ||
        d.nutrition.fatTarget != null ||
        !!d.nutrition.activityCalorieAdjustment),
    todayNutrition = d.nutrition
      ? nutritionTotals(d.nutrition.entries, today)
      : null,
    todayFoodEntries =
      d.nutrition?.entries.filter((entry) => entry.date === today) || [];
  const allMacros =
      d.nutrition?.proteinTarget != null &&
      d.nutrition?.carbTarget != null &&
      d.nutrition?.fatTarget != null,
    fullDayNutrition =
      todayFoodEntries.length === 1 &&
      /^daily total(?: ·.*)?$/i.test(todayFoodEntries[0].name) &&
      todayFoodEntries[0].calories !== null &&
      todayFoodEntries[0].protein !== null &&
      (!allMacros ||
        (todayFoodEntries[0].carbs != null && todayFoodEntries[0].fat != null));
  const todayBudget = d.nutrition
    ? calorieBudget(d.nutrition, activeCaloriesForDay(d, today).total)
    : null;
  const caloriesLeft =
      todayBudget?.budget === null ||
      todayBudget?.budget === undefined ||
      !todayNutrition
        ? null
        : Math.max(0, todayBudget.budget - todayNutrition.calories),
    proteinLeft =
      d.nutrition?.proteinTarget === null ||
      d.nutrition?.proteinTarget === undefined ||
      !todayNutrition
        ? null
        : Math.max(
            0,
            Math.round(
              (d.nutrition.proteinTarget - todayNutrition.protein) * 10,
            ) / 10,
          );
  const macroCalories = todayNutrition
      ? todayNutrition.protein * 4 +
        todayNutrition.carbs * 4 +
        todayNutrition.fat * 9
      : 0,
    proteinShare =
      macroCalories && todayNutrition
        ? (todayNutrition.protein * 400) / macroCalories
        : 0,
    carbShare =
      macroCalories && todayNutrition
        ? (todayNutrition.carbs * 400) / macroCalories
        : 0;
  function openDailyLog(id: "activity-log" | "nutrition-log") {
    setActive(null);
    setTab("Progress");
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(id)
          ?.scrollIntoView({ block: "start", behavior: "smooth" }),
      ),
    );
  }
  const week = finished.filter(
    (w) => fitnessNow().getTime() - new Date(w.date).getTime() < 7 * 86400000,
  );
  const loggedDates = new Map<string, string>();
  for (const w of finished)
    for (const entry of w.entries)
      if (
        entry.sets.some((s) =>
          ["completed", "modified", "failed"].includes(s.status),
        ) &&
        !loggedDates.has(entry.exerciseId)
      )
        loggedDates.set(entry.exerciseId, w.date);
  const loggedExercises = d.exercises
    .filter((e) => loggedDates.has(e.id))
    .sort(
      (a, b) =>
        loggedDates.get(b.id)!.localeCompare(loggedDates.get(a.id)!) ||
        a.name.localeCompare(b.name),
    );
  const progressExercise =
    loggedExercises.find((e) => e.id === selected) || loggedExercises[0];
  const ph = progressExercise
    ? history(d, progressExercise.id).slice().reverse()
    : [];
  const chart = ph.map((w) => {
    const sets = w.entries
      .find((e) => e.exerciseId === progressExercise.id)!
      .sets.filter((s) => s.status === "completed" || s.status === "modified");
    return {
      date: date(w.date),
      strength: Math.round(
        Math.max(0, ...sets.map((s) => s.weight * (1 + s.reps / 30))),
      ),
      volume: sets.reduce((n, s) => n + s.weight * s.reps, 0),
    };
  });
  const bestSets = ph
    .flatMap(
      (w) => w.entries.find((e) => e.exerciseId === progressExercise.id)!.sets,
    )
    .filter((s) => s.status === "completed" || s.status === "modified");
  function Chart({ small = false }: { small?: boolean }) {
    return (
      <div className={small ? "chart small-chart" : "chart"}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chart}
            margin={{ left: -20, right: 14, top: 15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#26936e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#26936e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 5"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              minTickGap={25}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
              formatter={(v) => [`${v} lb`, "Estimated 1RM"]}
            />
            <Area
              type="monotone"
              dataKey="strength"
              stroke="#26936e"
              strokeWidth={3}
              fill="url(#fill)"
              dot={{
                r: 3,
                fill: "#26936e",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const targetText = (r: Target) =>
    `${r.sets} × ${r.reps} · ${r.weight > 0 ? `${r.weight} lb` : "choose load"}`;
  const header = {
    Overview: [
      "Your training",
      "Build a plan, log a workout, or ask your coach.",
    ],
    Workouts: ["Your training log", "Every session is a step forward."],
    Progress: [
      "See your strength grow",
      "The long view matters more than one session.",
    ],
    Logs: ["Your health logs", "Daily inputs that add context to your training."],
    Library: [
      "Your training library",
      "Find exercises and manage reusable workout templates.",
    ],
  }[tab] || ["", ""];
  return (
    <CoachMemoryProvider
      data={d}
      change={save}
      stage={stage}
      review={reviewCoachChanges}
    >
      <div className="app">
        <Toaster position="bottom-right" richColors />
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("Overview");
              setActive(null);
            }}
          >
            <span className="brand-icon">
              <Activity size={24} />
            </span>
            stride<span className="brand-dot">.</span>
          </a>
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setActive(null);
            }}
            className="navigation"
          >
            <TabsList>
              {[
                ["Overview", LayoutDashboard],
                ["Workouts", Dumbbell],
                ["Progress", TrendingUp],
                ["Logs", ClipboardList],
                ["Library", Layers],
              ].map(([name, Icon]) => (
                <TabsTrigger value={name as string} key={name as string}>
                  <Icon size={17} />
                  <span>{name as string}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="header-right">
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() => save((d) => ({ ...d, dark: !d.dark }))}
            >
              {d.dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="avatar">Y</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{workout ? workout.name : header[0]}</h1>
              <p>
                {workout
                  ? "Log what you do. We’ll help with what’s next."
                  : header[1]}
              </p>
            </div>
            {!workout && (
              <button
                className="primary"
                onClick={() => {
                  setEditId("");
                  setModal("new-workout");
                }}
              >
                <Plus size={18} /> Start workout
              </button>
            )}
          </div>
          <AccountSync
            ref={accountSyncRef}
            data={d}
            onLoad={(next) => {
              dataRef.current = next;
              setData(next);
            }}
            onView={(target) => {
              setModal("");
              const [root, id] = target.split("/");
              setTab(
                root === "templates" || root === "coachPlanner"
                  ? "Library"
                  : root === "exercises"
                    ? "Library"
                    : root === "workouts"
                      ? "Workouts"
                      : root === "nutrition" || root === "bodyMeasurements" || root === "activityEnergy"
                        ? "Logs"
                        : "Progress",
              );
              if (root === "templates" || root === "coachPlanner")
                setLibraryView("Templates");
              if (root === "exercises") setLibraryView("Exercises");
              setActive(
                root === "workouts" && id?.startsWith("@") ? id.slice(1) : null,
              );
              if (root === "overrides" && id) setSelected(id);
            }}
          />
          <FeedbackUpdates />
          {tab === "Overview" && isNewUser && !welcomeDismissed && (
            <FirstRunCoach
              onPlan={createPlan}
              onWorkout={() => {
                setEditId("");
                setModal("new-workout");
              }}
              onExplore={() => setWelcomeDismissed(true)}
            />
          )}
          {tab === "Overview" && (!isNewUser || welcomeDismissed) && (
            <CoachBoundary>
              <WeeklyReviewPanel
                onDiscard={(id) =>
                  accountSyncRef.current?.discard(id) || Promise.resolve(false)
                }
                sync={() =>
                  accountSyncRef.current?.flush() || Promise.resolve(false)
                }
                onWorkout={(id) => {
                  setTab("Workouts");
                  setActive(id);
                }}
              />
            </CoachBoundary>
          )}
          {((tab === "Workouts" && !workout) ||
            (tab === "Overview" && (!isNewUser || welcomeDismissed))) &&
            modal !== "plan" && (
              <CoachBoundary>
                <PlanChat
                  onCreatePlan={createPlan}
                  data={d}
                  state={planner}
                  onDraft={updatePlanDraft}
                  onSave={savePlanDraft}
                  onReset={discardPlanDraft}
                  onView={viewTemplates}
                />
              </CoachBoundary>
            )}
          {tab === "Overview" &&
            (activityUsed || nutritionUsed || hydrationUsed) && (
              <section
                className="panel today-overview"
                aria-labelledby="today-overview-title"
              >
                <div className="today-overview-heading">
                  <div>
                    <span className="eyebrow">TODAY</span>
                    <h2 id="today-overview-title">Your daily log</h2>
                  </div>
                  <span className="muted">
                    {fitnessNow().toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="today-overview-grid">
                  {activityUsed && (
                    <article>
                      <span className="today-overview-icon">
                        <Activity size={18} />
                      </span>
                      <div>
                        <h3>Activity</h3>
                        {todayActivities.length ? (
                          <>
                            <strong>
                              {todayActivities.reduce(
                                (sum, item) => sum + item.durationMinutes,
                                0,
                              )}{" "}
                              min ·{" "}
                              {todayActivities
                                .reduce(
                                  (sum, item) => sum + item.caloriesBurned,
                                  0,
                                )
                                .toLocaleString()}{" "}
                              kcal
                            </strong>
                            <p>
                              {todayActivities.length === 1
                                ? `${todayActivities[0].name} · ${todayActivities[0].intensity}`
                                : `${todayActivities.length} activities logged`}
                            </p>
                          </>
                        ) : (
                          <>
                            <strong>Nothing logged today</strong>
                            <p>Reuse a recent activity or add what you did.</p>
                          </>
                        )}
                      </div>
                      <button
                        className="secondary"
                        onClick={() => openDailyLog("activity-log")}
                      >
                        {todayActivities.length
                          ? "View activity"
                          : "Log activity"}{" "}
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  )}
                  {nutritionUsed && (
                    <article className="today-food">
                      <span className="today-overview-icon">
                        <Utensils size={18} />
                      </span>
                      <div>
                        <h3>Food</h3>
                        {todayNutrition?.count ? (
                          <>
                            <strong>
                              {todayNutrition.calories.toLocaleString()} kcal ·{" "}
                              {todayNutrition.protein.toLocaleString()} g
                              protein
                            </strong>
                            <p>
                              {fullDayNutrition
                                ? "Daily total entered"
                                : "Partial log"}
                            </p>
                          </>
                        ) : (
                          <>
                            <strong>Nothing logged today</strong>
                            <p>Add a meal or enter your daily totals.</p>
                          </>
                        )}
                      </div>
                      {todayBudget?.budget !== null &&
                        todayBudget?.budget !== undefined &&
                        todayNutrition && (
                          <div className="daily-progress">
                            <div className="daily-progress-label">
                              <span>
                                <b>
                                  {todayNutrition.calories.toLocaleString()}
                                </b>{" "}
                                eaten
                              </span>
                              <span>
                                <b>{caloriesLeft?.toLocaleString()}</b> left
                              </span>
                            </div>
                            <div
                              className="daily-meter"
                              role="img"
                              aria-label={`${todayNutrition.calories.toLocaleString()} of ${todayBudget.budget.toLocaleString()} calories eaten; ${todayBudget.adjustment.toLocaleString()} calories added from activity`}
                            >
                              <span
                                className="daily-meter-activity"
                                style={{
                                  width: `${Math.min(100, (todayBudget.adjustment / todayBudget.budget) * 100)}%`,
                                }}
                              />
                              <span
                                className="daily-meter-used"
                                style={{
                                  width: `${Math.min(100, (todayNutrition.calories / todayBudget.budget) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="daily-progress-note">
                              <span>
                                Base{" "}
                                {d.nutrition?.calorieTarget?.toLocaleString() ||
                                  "—"}
                              </span>
                              {todayBudget.adjustment > 0 && (
                                <span className="activity-added">
                                  + {todayBudget.adjustment.toLocaleString()}{" "}
                                  activity
                                </span>
                              )}
                              <b>
                                {todayBudget.budget.toLocaleString()} kcal today
                              </b>
                            </div>
                          </div>
                        )}
                      {allMacros && todayNutrition && (
                        <div className="macro-overview">
                          <div
                            className="macro-ring"
                            role="img"
                            aria-label={`Logged macro calories: ${Math.round(proteinShare)} percent protein, ${Math.round(carbShare)} percent carbohydrates, ${Math.round(100 - proteinShare - carbShare)} percent fat`}
                            style={{
                              background: macroCalories
                                ? `conic-gradient(#63b99d 0 ${proteinShare}%, #76a8df ${proteinShare}% ${proteinShare + carbShare}%, #d9a95f ${proteinShare + carbShare}% 100%)`
                                : "var(--border)",
                            }}
                          >
                            <span>
                              {macroCalories
                                ? Math.round(macroCalories).toLocaleString()
                                : "—"}
                              <small>macro kcal</small>
                            </span>
                          </div>
                          <div className="macro-legend">
                            <span>
                              <i className="protein-dot" />
                              <b>Protein</b>
                              {todayNutrition.protein.toLocaleString()} /{" "}
                              {d.nutrition!.proteinTarget!.toLocaleString()} g
                            </span>
                            <span>
                              <i className="carb-dot" />
                              <b>Carbs</b>
                              {todayNutrition.carbs.toLocaleString()} /{" "}
                              {d.nutrition!.carbTarget!.toLocaleString()} g
                            </span>
                            <span>
                              <i className="fat-dot" />
                              <b>Fat</b>
                              {todayNutrition.fat.toLocaleString()} /{" "}
                              {d.nutrition!.fatTarget!.toLocaleString()} g
                            </span>
                          </div>
                        </div>
                      )}
                      {!allMacros &&
                        d.nutrition?.proteinTarget !== null &&
                        d.nutrition?.proteinTarget !== undefined &&
                        todayNutrition && (
                          <div className="daily-progress protein-progress">
                            <div className="daily-progress-label">
                              <span>
                                <b>
                                  {todayNutrition.protein.toLocaleString()} g
                                </b>{" "}
                                protein
                              </span>
                              <span>
                                <b>{proteinLeft?.toLocaleString()} g</b> left
                              </span>
                            </div>
                            <div
                              className="daily-meter"
                              role="img"
                              aria-label={`${todayNutrition.protein.toLocaleString()} of ${d.nutrition.proteinTarget.toLocaleString()} grams of protein logged`}
                            >
                              <span
                                className="daily-meter-used"
                                style={{
                                  width: `${Math.min(100, (todayNutrition.protein / d.nutrition.proteinTarget) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="daily-progress-note">
                              <span>Goal</span>
                              <b>
                                {d.nutrition.proteinTarget.toLocaleString()} g
                              </b>
                            </div>
                          </div>
                        )}
                      <button
                        className="secondary"
                        onClick={() => openDailyLog("nutrition-log")}
                      >
                        {todayNutrition?.count ? "View food" : "Log food"}{" "}
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  )}
                  {hydrationUsed && (
                    <article className="today-hydration">
                      <span className="today-overview-icon">
                        <Droplets size={18} />
                      </span>
                      <div>
                        <h3>Hydration</h3>
                        <strong>{todayHydration.toLocaleString()} fl oz</strong>
                        <p>
                          {hydrationTarget
                            ? `${Math.max(0, hydrationTarget - todayHydration).toLocaleString()} fl oz remaining · ${hydrationTarget.toLocaleString()} goal`
                            : "Logged today"}
                        </p>
                      </div>
                      {hydrationTarget && (
                        <div className="daily-progress">
                          <div
                            className="daily-meter"
                            role="img"
                            aria-label={`${todayHydration} of ${hydrationTarget} fluid ounces logged`}
                          >
                            <span
                              className="daily-meter-used hydration-meter"
                              style={{
                                width: `${Math.min(100, (todayHydration / hydrationTarget) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <button
                        className="secondary"
                        onClick={() => openDailyLog("nutrition-log")}
                      >
                        Log water <ArrowRight size={15} />
                      </button>
                    </article>
                  )}
                </div>
              </section>
            )}

          {tab === "Progress" && (
            <nav className="logging-shortcuts" aria-label="Logging shortcuts">
              {[
                ["activity-log", "Activity"],
                ["nutrition-log", "Food"],
                ["body-log", "Weight"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className="secondary"
                  onClick={() =>
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ block: "start", behavior: "smooth" })
                  }
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          {tab === "Workouts" && workout && (
            <>
              <CoachBoundary>
                <SessionCoach data={d} workout={workout} />
              </CoachBoundary>
              <RestFeedback data={d} workout={workout} />
            </>
          )}
          {tab === "Overview" &&
            !finished.length &&
            (!isNewUser || welcomeDismissed) && (
              <section className="panel first-workout">
                <h2>
                  {d.templates.length
                    ? "Ready to train"
                    : "Your training starts here"}
                </h2>
                <p>
                  {d.templates.length
                    ? "Choose a saved workout to begin."
                    : "Start a workout to log your sets, or create a plan with your coach. Your progress will appear after your first session."}
                </p>
                {d.workouts
                  .filter((w) => !w.completed)
                  .slice(0, 1)
                  .map((w) => (
                    <button
                      className="primary"
                      key={w.id}
                      onClick={() => {
                        setActive(w.id);
                        setTab("Workouts");
                      }}
                    >
                      Resume {w.name}
                      <ArrowRight size={16} />
                    </button>
                  ))}
                {d.templates.slice(0, 3).map((t) => (
                  <button
                    className="secondary"
                    key={t.id}
                    onClick={() => start(t)}
                  >
                    {t.name}
                    <ArrowRight size={16} />
                  </button>
                ))}
                {d.templates.length > 3 && (
                  <button className="text-button" onClick={viewTemplates}>
                    View all templates
                  </button>
                )}
              </section>
            )}
          {tab === "Overview" && finished.length > 0 && (
            <>
              <div className="stats-grid">
                <div className="stat">
                  <span>
                    Workouts this week <CalendarDays size={18} />
                  </span>
                  <strong>
                    {week.length}
                    <small>sessions</small>
                  </strong>
                  <p>Building a consistent practice</p>
                </div>
                <div className="stat">
                  <span>
                    Exercise calories <Flame size={18} />
                  </span>
                  <strong>
                    {num(week.reduce((a, w) => a + (w.caloriesBurned || 0), 0))}
                    <small>kcal</small>
                  </strong>
                  <p>
                    {week.some((w) => w.caloriesBurned !== undefined)
                      ? "From tracked workouts this week"
                      : "Finish a workout to estimate burn"}
                  </p>
                </div>
                <div className="stat">
                  <span>
                    Weekly volume <Dumbbell size={18} />
                  </span>
                  <strong>
                    {num(week.reduce((a, w) => a + volume(w), 0))}
                    <small>lb</small>
                  </strong>
                  <p>Across your completed sets</p>
                </div>
                <div className="stat">
                  <span>
                    Ready to progress <TrendingUp size={18} />
                  </span>
                  <strong>
                    {recs.filter((x) => x.r.kind === "Increase").length}
                    <small>exercises</small>
                  </strong>
                  <p className="green">A little more is within reach</p>
                </div>
              </div>
              <div className="dashboard-grid">
                <div className="left-column">
                  {completedToday ? (
                    <section className="next-card">
                      <div className="next-top">
                        <span className="light-eyebrow">TODAY’S TRAINING</span>
                        <span className="soft-pill">Completed today</span>
                      </div>
                      <h2>{completedToday.name}</h2>
                      <p>
                        Your session is recorded. The targets below are for your
                        next session, whenever you choose to train again.
                      </p>
                      <div className="next-bottom">
                        <span>
                          {completedToday.entries.length} exercises ·{" "}
                          {num(volume(completedToday))} lb logged
                        </span>
                        <button
                          className="lime-button"
                          onClick={() => {
                            setActive(completedToday.id);
                            setTab("Workouts");
                          }}
                        >
                          Review workout <ArrowRight size={17} />
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="next-card">
                      <div className="next-top">
                        <span className="light-eyebrow">
                          <span className="live-dot" /> WHEN YOU’RE READY
                        </span>
                        <span className="soft-pill">Suggested session</span>
                      </div>
                      <h2>
                        {suggestedTemplate?.name || "Make it your session"}
                      </h2>
                      <p>
                        {suggestedTemplate?.description ||
                          "Start a workout with any exercises you like."}
                      </p>
                      <div className="session-items">
                        {suggestedTemplate?.entries.slice(0, 3).map((x) => {
                          const e = d.exercises.find(
                            (e) => e.id === x.exerciseId,
                          )!;
                          const r = recommend(d, e);
                          return (
                            <div key={e.id}>
                              <span>{e.name}</span>
                              <b>{targetText(r)}</b>
                            </div>
                          );
                        })}
                      </div>
                      <div className="next-bottom">
                        <span>
                          {suggestedTemplate?.entries.length || 0} exercises{" "}
                          <span>·</span> Targets adapt to you
                        </span>
                        <button
                          className="lime-button"
                          onClick={() =>
                            suggestedTemplate && start(suggestedTemplate)
                          }
                        >
                          Let’s train <ArrowRight size={17} />
                        </button>
                      </div>
                    </section>
                  )}
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Your next targets</h2>
                        <p>Based on what you actually completed</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setLibraryView("Exercises");
                          setTab("Library");
                        }}
                      >
                        View all <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="recommendations">
                      {!finished.length && (
                        <div className="empty">
                          Complete your first workout to get targets based on
                          your training.
                        </div>
                      )}
                      {recs
                        .filter((x) => history(d, x.e.id).length)
                        .slice(0, 4)
                        .map(({ e, r }) => (
                          <div className="rec-row" key={e.id}>
                            <div
                              className={
                                "exercise-symbol " + r.kind.toLowerCase()
                              }
                            >
                              <Dumbbell size={19} />
                            </div>
                            <div className="rec-main">
                              <div className="rec-title">
                                <button onClick={() => showProgress(e.id)}>
                                  {e.name}
                                </button>
                                <Badge kind={r.kind} />
                              </div>
                              <p>{r.why}</p>
                            </div>
                            <button
                              className="target-button"
                              onClick={() => {
                                setEditId(e.id);
                                setModal("target");
                              }}
                            >
                              <b>{targetText(r)}</b>
                              <span>
                                {r.overridden
                                  ? "Your override"
                                  : "Next session"}{" "}
                                <SlidersHorizontal size={12} />
                              </span>
                            </button>
                          </div>
                        ))}
                    </div>
                    <div className="panel-note">
                      <Info size={15} /> Recommendations are a starting point.
                      You’re always in control.
                    </div>
                  </section>
                </div>
                <div className="right-column">
                  {progressExercise && (
                    <section className="panel strength-panel">
                      <div className="section-head">
                        <h2>Strength in motion</h2>
                        <TrendingUp size={19} />
                      </div>
                      <ProgressExercisePicker
                        exercises={loggedExercises}
                        value={progressExercise.id}
                        onChange={setSelected}
                      />
                      <div className="strength-number">
                        {chart.at(-1)?.strength || 0}
                        <small>
                          lb <span>estimated 1RM</span>
                        </small>
                      </div>
                      {chart.length ? (
                        <Chart small />
                      ) : (
                        <div className="empty">
                          Your strength trend will appear after you log a
                          workout.
                        </div>
                      )}
                      <button
                        className="text-button"
                        onClick={() => setTab("Progress")}
                      >
                        Explore your progress <ArrowRight size={15} />
                      </button>
                    </section>
                  )}
                  <section className="recovery-card recovery-summary">
                    <span className="recovery-icon">
                      <Leaf size={22} />
                    </span>
                    <h3>
                      {recoveringMuscles.length
                        ? "Muscles still recovering"
                        : "Recovery looks clear"}
                    </h3>
                    <p>
                      {recoveringMuscles.length
                        ? recoveringMuscles
                            .slice(0, 3)
                            .map((item) => item.group)
                            .join(", ") +
                          " are still within their estimated recovery windows."
                        : "No recently trained muscle group is currently flagged as recovering."}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setTab("Progress");
                        requestAnimationFrame(() =>
                          document
                            .getElementById("muscle-recovery")
                            ?.scrollIntoView({
                              block: "start",
                              behavior: "smooth",
                            }),
                        );
                      }}
                    >
                      View body map <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              </div>
              <section className="panel recent-panel">
                <div className="section-head">
                  <h2>Recent workouts</h2>
                  <button
                    className="text-button"
                    onClick={() => setTab("Workouts")}
                  >
                    View history <ArrowRight size={16} />
                  </button>
                </div>
                <div className="recent-grid">
                  {finished.slice(0, 3).map((w) => (
                    <button
                      className="recent-card"
                      key={w.id}
                      onClick={() => {
                        setActive(w.id);
                        setTab("Workouts");
                      }}
                    >
                      <div className="recent-icon">
                        <Dumbbell size={21} />
                      </div>
                      <div>
                        <span>{date(w.date)}</span>
                        <h3>{w.name}</h3>
                        <p>
                          {w.entries.length} exercises · {num(volume(w))} lb
                          volume
                          {w.caloriesBurned !== undefined
                            ? ` · ${w.caloriesBurned} kcal`
                            : ""}
                        </p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
                {!finished.length && (
                  <p className="empty">
                    Your completed workouts will appear here.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "Workouts" && !workout && (
            <section className="panel">
              <div className="section-head">
                <h2>All sessions</h2>
                <span className="muted">{d.workouts.length} workouts</span>
              </div>
              {d.workouts
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((w) => (
                  <div className="history-row" key={w.id}>
                    <div className="recent-icon">
                      <Dumbbell size={21} />
                    </div>
                    <button
                      className="history-main"
                      onClick={() => setActive(w.id)}
                    >
                      <h3>{w.name}</h3>
                      <p>
                        {date(w.date)} · {w.entries.length} exercises ·{" "}
                        {num(volume(w))} lb
                        {w.caloriesBurned !== undefined
                          ? ` · ${w.caloriesBurned} kcal`
                          : ""}
                      </p>
                    </button>
                    <span
                      className={
                        "badge " + (w.completed ? "increase" : "repeat")
                      }
                    >
                      {w.completed ? "Completed" : "In progress"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={"Delete " + w.name}
                      onClick={() => setDeleting({ type: "workout", id: w.id })}
                    >
                      <Trash2 size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={"Open " + w.name}
                      onClick={() => setActive(w.id)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ))}
              {!d.workouts.length && (
                <div className="empty">
                  Your first session starts here. Tap Start workout.
                </div>
              )}
            </section>
          )}
          {tab === "Workouts" && workout && (
            <>
              <div className="workout-toolbar">
                <button className="text-button" onClick={() => setActive(null)}>
                  <ArrowLeft size={16} /> All workouts
                </button>
                <div className="button-group">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditId(workout.id);
                      setModal("edit-workout");
                    }}
                  >
                    Edit details
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditId("from-workout");
                      setModal("template");
                    }}
                  >
                    <Layers size={16} /> Save as template
                  </button>
                </div>
              </div>
              {!workout.completed && (
                <nav className="session-jump" aria-label="Workout exercises">
                  {workout.entries.map((e) => (
                    <button
                      className="secondary"
                      key={e.exerciseId}
                      onClick={() =>
                        document
                          .getElementById("exercise-" + e.exerciseId)
                          ?.scrollIntoView({
                            block: "start",
                            behavior: "smooth",
                          })
                      }
                    >
                      {d.exercises.find((x) => x.id === e.exerciseId)?.name} ·{" "}
                      {e.sets.filter((s) => s.status !== "pending").length}/
                      {e.sets.length}
                    </button>
                  ))}
                  <button
                    className="primary"
                    onClick={() => {
                      const next = document.querySelector<HTMLElement>(
                        '[data-next-set="true"]',
                      );
                      (
                        next || document.querySelector(".finish-panel")
                      )?.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                      });
                    }}
                  >
                    Next set / finish
                  </button>
                </nav>
              )}
              {workout.completed && (
                <>
                  <div className="notice">
                    <Check size={17} /> Completed session. Edits update your
                    recommendations.
                  </div>
                  <WorkoutEnergySummary workout={workout} />
                </>
              )}
              {workout.entries.map((entry) => {
                const ex = d.exercises.find((e) => e.id === entry.exerciseId)!;
                const r = recommend(d, ex);
                const currentEstimate = Math.max(
                  estimatedStrength(d, ex.id),
                  ...entry.sets
                    .filter(
                      (set) =>
                        (set.status === "completed" ||
                          set.status === "modified") &&
                        set.weight > 0 &&
                        set.reps > 0,
                    )
                    .map((set) => estimatedOneRepMax(set.weight, set.reps)),
                );
                return (
                  <section
                    className="panel log-panel"
                    key={ex.id}
                    id={"exercise-" + ex.id}
                  >
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">{ex.category}</span>
                        <ExerciseHelp exercise={ex} />
                      </div>
                      <button
                        className="icon-button"
                        aria-label={"Remove " + ex.name}
                        onClick={() =>
                          setDeleting({ type: "entry", id: ex.id })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <details className="log-target">
                      <summary>Current guidance · {r.kind}</summary>
                      <p>{r.why}</p>
                    </details>
                    {ex.mode === "weight" && (
                      <div className="live-strength-estimate" aria-live="polite">
                        <div>
                          <span>Estimated 1RM</span>
                          <strong>
                            {currentEstimate > 0
                              ? `${num(currentEstimate)} lb`
                              : "—"}
                          </strong>
                        </div>
                        <p>
                          {currentEstimate > 0
                            ? "Based on your strongest logged set."
                            : "Complete your first weighted set to calculate it."}
                        </p>
                      </div>
                    )}
                    <>
                      {entry.sets.map((s, i) => (
                        <div className="set-with-guidance" key={s.id}>
                          {!workout.completed &&
                            entry.sets.find((x) => x.status === "pending")
                              ?.id === s.id && (
                              <CoachBoundary>
                                <SetCoach
                                  data={d}
                                  workout={workout}
                                  exercise={ex}
                                />
                              </CoachBoundary>
                            )}
                          <QuickSet
                            key={s.id}
                            set={s}
                            index={i}
                            exercise={ex.name}
                            next={
                              !workout.completed &&
                              workout.entries
                                .flatMap((e) => e.sets)
                                .find((x) => x.status === "pending")?.id ===
                                s.id
                            }
                            onPatch={(p) => setPatch(ex.id, s.id, p)}
                            onRecord={(status, recorded) => {
                              if (status === "skipped") return;
                              window.dispatchEvent(
                                new CustomEvent("stride:set-recorded", {
                                  detail: {
                                    exerciseId: ex.id,
                                    weight: recorded.weight,
                                    reps: recorded.reps,
                                    targetWeight: recorded.targetWeight,
                                    targetReps: recorded.targetReps,
                                  },
                                }),
                              );
                            }}
                            onAdvance={() =>
                              requestAnimationFrame(() => {
                                document
                                  .querySelector<HTMLElement>(
                                    '[data-next-set="true"]',
                                  )
                                  ?.closest(".set-with-guidance")
                                  ?.scrollIntoView({
                                    block: "nearest",
                                    behavior: "smooth",
                                  });
                              })
                            }
                            onDelete={() =>
                              updateWorkout((w) => ({
                                ...w,
                                entries: w.entries.map((e) =>
                                  e.exerciseId === ex.id
                                    ? {
                                        ...e,
                                        sets: e.sets.filter(
                                          (x) => x.id !== s.id,
                                        ),
                                      }
                                    : e,
                                ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </>
                    <button
                      className="add-set"
                      onClick={() =>
                        updateWorkout((w) => ({
                          ...w,
                          entries: w.entries.map((e) =>
                            e.exerciseId === ex.id
                              ? {
                                  ...e,
                                  sets: [
                                    ...e.sets,
                                    setOf(
                                      e.sets.at(-1)?.weight ?? r.weight,
                                      (e.sets.at(-1)?.status === "failed" ||
                                      e.sets.at(-1)?.status === "skipped"
                                        ? e.sets.at(-1)?.targetReps
                                        : e.sets.at(-1)?.reps) ?? r.reps,
                                    ),
                                  ],
                                }
                              : e,
                          ),
                        }))
                      }
                    >
                      <Plus size={16} /> Add set
                    </button>
                  </section>
                );
              })}
              <button
                className="add-exercise"
                onClick={() => {
                  setQuery("");
                  setModal("add-exercise");
                }}
              >
                <Plus size={18} /> Add exercise
              </button>
              <section className="panel finish-panel">
                <div>
                  <h2>How did the session feel?</h2>
                  <p>Your feedback helps shape the next one.</p>
                </div>
                <Choice
                  value={workout.difficulty}
                  onChange={(v) =>
                    updateWorkout((w) => ({ ...w, difficulty: v }))
                  }
                  options={["Easy", "Moderate", "Hard", "Very Hard", "Failed"]}
                  label="Session difficulty"
                />
                <WorkoutEnergyButton
                  workout={workout}
                  measurements={d.bodyMeasurements}
                  canOpen={workout.completed ? undefined : readyToFinish}
                  onSave={(energy) =>
                    workout.completed
                      ? updateWorkout((w) => ({ ...w, ...energy }))
                      : finish(energy)
                  }
                />
              </section>
            </>
          )}
          {tab === "Progress" && (
            <CoachBoundary>
              <ProgressCoach data={d} />
            </CoachBoundary>
          )}
          {tab === "Progress" && <MuscleRecoveryMap data={d} />}
          {tab === "Logs" && (
            <ActivityEnergy data={d} onChange={(next) => setData(next)} />
          )}
          {tab === "Logs" && (
            <NutritionTracker
              value={d.nutrition}
              workouts={d.workouts}
              activityLogs={d.activityEnergy?.logs}
              onChange={(nutrition) =>
                save((current) => ({ ...current, nutrition }))
              }
            />
          )}
          {tab === "Logs" && (
            <BodyMeasurements
              entries={d.bodyMeasurements}
              profile={d.strengthProfile}
              onProfile={(strengthProfile) =>
                save((current) => ({ ...current, strengthProfile }))
              }
              onChange={(bodyMeasurements) =>
                save((current) => {
                  const weight =
                    [...bodyMeasurements]
                      .filter((x) => x.weight !== null)
                      .sort((a, b) => b.date.localeCompare(a.date))[0]
                      ?.weight ??
                    current.strengthProfile?.bodyweight ??
                    null;
                  return {
                    ...current,
                    bodyMeasurements,
                    strengthProfile: {
                      ...current.strengthProfile,
                      bodyweight: weight,
                      comparison:
                        current.strengthProfile?.comparison || "general",
                    },
                  };
                })
              }
            />
          )}
          {tab === "Progress" && (
            <Goals
              data={d}
              onChange={(goals) => save((current) => ({ ...current, goals }))}
              onProfile={(strengthProfile) =>
                save((current) => ({ ...current, strengthProfile }))
              }
            />
          )}
          {tab === "Progress" && !progressExercise && (
            <section className="panel empty">
              <h2>No exercise history yet</h2>
              <p>
                Log an attempted set and finish a workout to see its progress
                here.
              </p>
            </section>
          )}
          {tab === "Progress" && progressExercise && (
            <>
              <div className="progress-select">
                <ProgressExercisePicker
                  exercises={loggedExercises}
                  value={progressExercise.id}
                  onChange={setSelected}
                />
                <Badge kind={recommend(d, progressExercise).kind} />
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span>Best completed weight</span>
                  <strong>
                    {Math.max(0, ...bestSets.map((s) => s.weight))}
                    <small>lb</small>
                  </strong>
                </div>
                <div className="stat">
                  <span>Best completed reps</span>
                  <strong>
                    {Math.max(0, ...bestSets.map((s) => s.reps))}
                    <small>reps</small>
                  </strong>
                </div>
                <div className="stat">
                  <span>Latest estimated strength</span>
                  <strong>
                    {chart.at(-1)?.strength || 0}
                    <small>lb</small>
                  </strong>
                </div>
                <div className="stat">
                  <span>Completed sessions</span>
                  <strong>
                    {ph.length}
                    <small>sessions</small>
                  </strong>
                </div>
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Estimated strength trend</h2>
                    <p>
                      Epley estimate: weight × (1 + reps ÷ 30). A trend, not a
                      tested maximum.
                    </p>
                  </div>
                </div>
                {chart.length ? (
                  <Chart />
                ) : (
                  <div className="empty">
                    Complete a session to start your progress chart.
                  </div>
                )}
              </section>
              <section className="panel target-detail">
                <Badge kind={recommend(d, progressExercise).kind} />
                <h2>Next up: {targetText(recommend(d, progressExercise))}</h2>
                <p>{recommend(d, progressExercise).why}</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditId(progressExercise.id);
                    setModal("target");
                  }}
                >
                  <SlidersHorizontal size={16} /> Adjust target
                </button>
              </section>
              <section className="panel">
                <div className="section-head">
                  <h2>Performance history</h2>
                </div>
                {ph
                  .slice()
                  .reverse()
                  .map((w) => {
                    const en = w.entries.find(
                      (e) => e.exerciseId === progressExercise.id,
                    )!;
                    return (
                      <button
                        className="performance-row"
                        key={w.id}
                        onClick={() => {
                          setActive(w.id);
                          setTab("Workouts");
                        }}
                      >
                        <div>
                          <h3>{date(w.date)}</h3>
                          <p>
                            {en.sets
                              .map(
                                (s) =>
                                  `${s.weight} × ${s.reps}${s.status === "failed" ? " (failed)" : ""}${s.status === "skipped" ? " (skipped)" : ""}`,
                              )
                              .join(" / ")}
                          </p>
                        </div>
                        <span>
                          {num(
                            en.sets
                              .filter(
                                (s) =>
                                  s.status === "completed" ||
                                  s.status === "modified",
                              )
                              .reduce((a, s) => a + s.weight * s.reps, 0),
                          )}{" "}
                          lb volume
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    );
                  })}
              </section>
            </>
          )}
          {tab === "Library" && (
            <Tabs value={libraryView} onValueChange={(value) => setLibraryView(value as "Exercises" | "Templates")} className="library-tabs">
              <TabsList>
                <TabsTrigger value="Exercises"><Dumbbell size={16} />Exercises</TabsTrigger>
                <TabsTrigger value="Templates"><CalendarDays size={16} />Templates</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {tab === "Library" && libraryView === "Exercises" && (
            <CoachBoundary>
              <ExerciseCoach data={d} />
            </CoachBoundary>
          )}
          {tab === "Library" && libraryView === "Exercises" && (
            <>
              <div className="workout-toolbar">
                <input
                  className="search-input"
                  placeholder="Find an exercise…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Find exercise"
                />
                <span className="muted">
                  {
                    recs.filter(({ e }) =>
                      (e.name + " " + e.category)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ).length
                  }{" "}
                  exercises
                </span>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditId("");
                    setModal("exercise");
                  }}
                >
                  <Plus size={16} /> Custom exercise
                </button>
              </div>
              {!recs.some(({ e }) =>
                (e.name + " " + e.category)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ) && (
                <div className="panel empty">
                  No matching exercises. Try another name or create a custom
                  exercise.
                </div>
              )}
              <div className="exercise-grid">
                {recs
                  .filter(({ e }) =>
                    (e.name + " " + e.category)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map(({ e, r }) => (
                    <section className="panel exercise-card" key={e.id}>
                      <div className="exercise-card-top">
                        <span className="recent-icon">
                          <Dumbbell size={22} />
                        </span>
                        {history(d, e.id).length || d.overrides[e.id] ? (
                          <Badge kind={r.kind} />
                        ) : (
                          <span className="muted">Not logged yet</span>
                        )}
                      </div>
                      <span className="eyebrow">{e.category}</span>
                      <h2>{e.name}</h2>
                      <div className="exercise-target">
                        {history(d, e.id).length || d.overrides[e.id]
                          ? targetText(r)
                          : "Set your starting target"}
                      </div>
                      <p>
                        {history(d, e.id).length || d.overrides[e.id]
                          ? r.why
                          : "Choose your weight, reps, and sets when you add this movement to a workout."}
                      </p>
                      <div className="exercise-actions">
                        <button
                          className="text-button"
                          onClick={() => showProgress(e.id)}
                        >
                          View progress <ArrowUpRight size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Edit " + e.name}
                          onClick={() => {
                            setEditId(e.id);
                            setModal("exercise");
                          }}
                        >
                          <SlidersHorizontal size={17} />
                        </button>
                      </div>
                    </section>
                  ))}
              </div>
            </>
          )}
          {tab === "Library" && libraryView === "Templates" && (
            <CoachBoundary>
              <TemplateCoach
                data={d}
                selected={coachTemplate}
                onSelect={setCoachTemplate}
                open={templateCoachOpen}
                onOpenChange={setTemplateCoachOpen}
              />
            </CoachBoundary>
          )}

          {tab === "Library" && libraryView === "Templates" && (
            <>
              <h2
                id="saved-templates"
                tabIndex={-1}
                className="saved-templates-heading"
              >
                Your saved templates
              </h2>
              <div className="workout-toolbar">
                <span className="muted">
                  Tap an exercise for instructions and video examples.
                </span>
                <div className="button-group">
                  <button className="primary" onClick={createPlan}>
                    <Plus size={17} /> Create a plan
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditId("");
                      setModal("template");
                    }}
                  >
                    Add template
                  </button>
                </div>
              </div>
              {!d.templates.length && (
                <div className="panel empty">
                  No templates yet. Create your own or save a workout as a
                  template.
                </div>
              )}
              <div className="exercise-grid">
                {d.templates.map((t) => (
                  <section className="panel template-card" key={t.id}>
                    <div className="exercise-card-top">
                      <div className="recent-icon">
                        <Layers size={22} />
                      </div>
                      <div className="button-group">
                        <button
                          className="icon-button"
                          aria-label={"Edit " + t.name}
                          onClick={() => {
                            setEditId(t.id);
                            setModal("template");
                          }}
                        >
                          <SlidersHorizontal size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Delete " + t.name}
                          onClick={() =>
                            setDeleting({ type: "template", id: t.id })
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <h2>{t.name}</h2>
                    <p>{t.description}</p>
                    <div className="template-exercises">
                      {t.entries.map((x) => (
                        <div key={x.exerciseId}>
                          <span>
                            {(() => {
                              const exercise = d.exercises.find(
                                (e) => e.id === x.exerciseId,
                              );
                              return exercise ? (
                                <ExerciseHelp exercise={exercise} />
                              ) : (
                                "Exercise unavailable"
                              );
                            })()}
                          </span>
                          <b>
                            {x.sets} × {x.reps}
                          </b>
                        </div>
                      ))}
                      {!t.entries.length && (
                        <p>Add exercises to make this template yours.</p>
                      )}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setCoachTemplate(t.id);
                        setTemplateCoachOpen(true);
                        requestAnimationFrame(() =>
                          document
                            .getElementById("template-coach")
                            ?.scrollIntoView({
                              block: "start",
                              behavior: "smooth",
                            }),
                        );
                      }}
                    >
                      Adjust with coach
                    </button>
                    <button className="primary" onClick={() => start(t)}>
                      Start session <ArrowRight size={17} />
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
          <PwaSupport />
          <footer>
            <Feedback area={tab} />
            <span className="footer-brand">
              <Activity size={16} /> stride.
            </span>
            <span>Your training, in your account.</span>
            <span>General fitness guidance only. Not medical advice.</span>
          </footer>
        </main>
        <Dialog
          open={!!modal}
          onOpenChange={(o) => {
            if (!o) setModal("");
          }}
        >
          <DialogContent
            className={"app-dialog " + (modal === "plan" ? "plan-dialog" : "")}
          >
            <DialogHeader className={modal === "plan" ? "sr-only" : undefined}>
              <DialogTitle>
                {
                  {
                    plan: "Create a workout plan",
                    "new-workout": "Start your next session",
                    "edit-workout": "Workout details",
                    "add-exercise": "Add an exercise",
                    exercise: editId ? "Edit exercise" : "Create an exercise",
                    template:
                      editId && editId !== "from-workout"
                        ? "Edit template"
                        : "Create a template",
                    target: "Make the target yours",
                  }[modal]
                }
              </DialogTitle>
              <DialogDescription>
                {
                  {
                    plan: "Your saved workouts stay available while you create a new plan.",
                    "new-workout":
                      "Choose a template or start with a blank workout.",
                    "edit-workout": "Correct the name, date, or notes.",
                    "add-exercise":
                      "Pick a movement. You can adjust every set.",
                    exercise:
                      "Choose the defaults and how this movement progresses.",
                    template:
                      "Set up a reusable session. Saved history will adapt its targets.",
                    target:
                      "Override the next session without changing past performance.",
                  }[modal]
                }
              </DialogDescription>
            </DialogHeader>
            {modal === "plan" && (
              <CoachBoundary>
                <PlanChat
                  initialSetup
                  onCancel={() => setModal("")}
                  data={d}
                  state={planner}
                  onDraft={updatePlanDraft}
                  onSave={savePlanDraft}
                  onReset={discardPlanDraft}
                  onView={viewTemplates}
                />
              </CoachBoundary>
            )}
            {modal === "new-workout" && (
              <>
                <div className="template-picker">
                  {d.templates.map((t) => (
                    <button key={t.id} onClick={() => start(t)}>
                      <Layers size={19} />
                      <span>
                        <b>{t.name}</b>
                        <small>{t.entries.length} exercises</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(
                      undefined,
                      new FormData(e.currentTarget).get("name") as string,
                    );
                  }}
                >
                  <label>
                    Workout name
                    <input
                      name="name"
                      required
                      placeholder="e.g. Friday strength"
                      defaultValue="Custom workout"
                    />
                  </label>
                  <button className="primary full">
                    <Plus size={17} /> Start blank workout
                  </button>
                </form>
              </>
            )}
            {modal === "edit-workout" && workout && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  updateWorkout((w) => ({
                    ...w,
                    name: String(f.get("name")).trim(),
                    date: new Date(
                      String(f.get("date")) + "T12:00:00",
                    ).toISOString(),
                    notes: String(f.get("notes")),
                  }));
                  setModal("");
                }}
              >
                <label>
                  Name
                  <input name="name" defaultValue={workout.name} required />
                </label>
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    defaultValue={workout.date.slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Notes
                  <textarea name="notes" defaultValue={workout.notes} />
                </label>
                <button className="primary full">Save details</button>
              </form>
            )}
            {modal === "add-exercise" && (
              <>
                <input
                  placeholder="Find an exercise…"
                  aria-label="Search exercises"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="template-picker">
                  {d.exercises
                    .filter(
                      (e) =>
                        (e.name + " " + e.category)
                          .toLowerCase()
                          .includes(query.toLowerCase()) &&
                        !workout?.entries.some((x) => x.exerciseId === e.id),
                    )
                    .map((e) => (
                      <button key={e.id} onClick={() => addExercise(e.id)}>
                        <Dumbbell size={18} />
                        <span>
                          <b>{e.name}</b>
                          <small>{e.category}</small>
                        </span>
                        <Plus size={18} />
                      </button>
                    ))}
                </div>
                <button
                  className="secondary full"
                  onClick={() => {
                    setEditId("");
                    setModal("exercise");
                  }}
                >
                  Create custom exercise
                </button>
              </>
            )}
            {modal === "exercise" && (
              <ExerciseForm
                exercise={d.exercises.find((e) => e.id === editId)}
                onSave={(ex) => {
                  if (
                    d.exercises.some(
                      (e) =>
                        e.id !== ex.id &&
                        e.name.toLowerCase() === ex.name.toLowerCase(),
                    )
                  ) {
                    toast.error("An exercise with that name already exists.");
                    return;
                  }
                  save((d) => ({
                    ...d,
                    exercises: d.exercises.some((e) => e.id === ex.id)
                      ? d.exercises.map((e) => (e.id === ex.id ? ex : e))
                      : [...d.exercises, ex],
                  }));
                  setModal(workout ? "add-exercise" : "");
                  toast("Saving exercise to your account…");
                }}
              />
            )}
            {modal === "target" && (
              <TargetForm
                exercise={d.exercises.find((e) => e.id === editId)!}
                target={recommend(
                  d,
                  d.exercises.find((e) => e.id === editId)!,
                )}
                onSave={(t) => {
                  save((d) => ({
                    ...d,
                    overrides: { ...d.overrides, [editId]: t },
                  }));
                  setModal("");
                  toast("Saving your next target…");
                }}
                onReset={() => {
                  save((d) => ({
                    ...d,
                    overrides: Object.fromEntries(
                      Object.entries(d.overrides).filter(([k]) => k !== editId),
                    ),
                  }));
                  setModal("");
                }}
              />
            )}
            {modal === "template" && (
              <TemplateForm
                exercises={d.exercises}
                template={
                  editId === "from-workout" && workout
                    ? {
                        id: uid(),
                        name: workout.name,
                        description: "",
                        entries: workout.entries.map((e) => ({
                          exerciseId: e.exerciseId,
                          weight: e.sets[0]?.weight || 0,
                          reps: e.sets[0]?.reps || 8,
                          sets: e.sets.length || 1,
                        })),
                      }
                    : d.templates.find((t) => t.id === editId)
                }
                onSave={(t) => {
                  save((d) => ({
                    ...d,
                    templates: d.templates.some((x) => x.id === t.id)
                      ? d.templates.map((x) => (x.id === t.id ? t : x))
                      : [...d.templates, t],
                  }));
                  setModal("");
                  toast("Saving template to your account…");
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={!!deleting}
          onOpenChange={(o) => {
            if (!o) setDeleting(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete this{" "}
                {deleting?.type === "entry"
                  ? "exercise from the workout"
                  : deleting?.type}
                ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This removes its saved data and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleting?.type === "workout")
                    save((d) => ({
                      ...d,
                      workouts: d.workouts.filter((w) => w.id !== deleting.id),
                    }));
                  if (deleting?.type === "template")
                    save((d) => ({
                      ...d,
                      templates: d.templates.filter(
                        (t) => t.id !== deleting.id,
                      ),
                    }));
                  if (deleting?.type === "entry")
                    updateWorkout((w) => ({
                      ...w,
                      entries: w.entries.filter(
                        (e) => e.exerciseId !== deleting.id,
                      ),
                    }));
                  setDeleting(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CoachMemoryProvider>
  );
}
function ExerciseForm({
  exercise,
  onSave,
}: {
  exercise?: Exercise;
  onSave: (e: Exercise) => void;
}) {
  const [mode, setMode] = useState(exercise?.mode || "weight");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: exercise?.id || uid(),
          name: String(f.get("name")).trim(),
          category: String(f.get("category")).trim(),
          mode,
          increment: +f.get("increment")!,
          baseWeight: +f.get("weight")!,
          baseReps: +f.get("reps")!,
          baseSets: +f.get("sets")!,
        });
      }}
    >
      <label>
        Exercise name
        <input
          name="name"
          defaultValue={exercise?.name}
          required
          maxLength={80}
        />
      </label>
      <label>
        Muscle group or movement pattern
        <input
          name="category"
          defaultValue={exercise?.category || "General"}
          required
        />
      </label>
      <label>
        Progress by
        <Choice
          value={mode}
          onChange={(v) => setMode(v as Exercise["mode"])}
          options={["weight", "reps", "volume"]}
          label="Progression preference"
        />
      </label>
      <div className="form-grid">
        <label>
          Weight increment · lb
          <input
            name="increment"
            type="number"
            min="0.5"
            step="0.5"
            defaultValue={exercise?.increment || 5}
            required
          />
        </label>
        <label>
          Starting weight · lb
          <input
            name="weight"
            type="number"
            min="0"
            step="0.5"
            defaultValue={exercise?.baseWeight || 0}
            required
          />
        </label>
        <label>
          Starting reps
          <input
            name="reps"
            type="number"
            min="1"
            max="100"
            defaultValue={exercise?.baseReps || 8}
            required
          />
        </label>
        <label>
          Starting sets
          <input
            name="sets"
            type="number"
            min="1"
            max="20"
            defaultValue={exercise?.baseSets || 3}
            required
          />
        </label>
      </div>
      <p className="form-help">
        For bodyweight exercises, use 0 lb and progress by reps. Volume
        progression adds one set after a successful session.
      </p>
      <button className="primary full">Save exercise</button>
    </form>
  );
}
function TargetForm({
  exercise,
  target,
  onSave,
  onReset,
}: {
  exercise: Exercise;
  target: Target;
  onSave: (t: Target) => void;
  onReset: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          weight: +f.get("weight")!,
          reps: +f.get("reps")!,
          sets: +f.get("sets")!,
        });
      }}
    >
      <h3>{exercise.name}</h3>
      <div className="form-grid">
        <label>
          Weight · lb
          <input
            name="weight"
            type="number"
            min="0"
            step="0.5"
            defaultValue={target.weight}
            required
          />
        </label>
        <label>
          Reps
          <input
            name="reps"
            type="number"
            min="1"
            max="100"
            defaultValue={target.reps}
            required
          />
        </label>
        <label>
          Sets
          <input
            name="sets"
            type="number"
            min="1"
            max="20"
            defaultValue={target.sets}
            required
          />
        </label>
      </div>
      <p className="form-help">
        Used when you next add this exercise or start a template. Resets after
        you finish that session.
      </p>
      <button className="primary full">Save next target</button>
      <button type="button" className="text-button full" onClick={onReset}>
        Use recommendation instead
      </button>
    </form>
  );
}
function TemplateForm({
  template,
  exercises,
  onSave,
}: {
  template?: Template;
  exercises: Exercise[];
  onSave: (t: Template) => void;
}) {
  const [entries, setEntries] = useState(template?.entries || []);
  const [pick, setPick] = useState(exercises[0]?.name || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!entries.length) {
          toast.error("Add at least one exercise.");
          return;
        }
        const f = new FormData(e.currentTarget);
        onSave({
          id: template?.id || uid(),
          name: String(f.get("name")).trim(),
          description: String(f.get("description")),
          entries,
        });
      }}
    >
      <label>
        Template name
        <input
          name="name"
          defaultValue={template?.name}
          placeholder="e.g. Pull day"
          required
        />
      </label>
      <label>
        Description
        <input name="description" defaultValue={template?.description} />
      </label>
      <div className="template-edit">
        {entries.map((x, i) => (
          <div key={x.exerciseId}>
            <div className="section-head">
              <b>{exercises.find((e) => e.id === x.exerciseId)?.name}</b>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove exercise"
                onClick={() => setEntries(entries.filter((_, j) => i !== j))}
              >
                <X size={16} />
              </button>
            </div>
            <div className="form-grid triple">
              {(["weight", "reps", "sets"] as const).map((key) => (
                <label key={key}>
                  {key === "weight" ? "Weight · lb" : key}
                  <input
                    type="number"
                    min={key === "weight" ? 0 : 1}
                    max={key === "sets" ? 20 : undefined}
                    step={key === "weight" ? 0.5 : 1}
                    value={x[key]}
                    required
                    onChange={(e) =>
                      setEntries(
                        entries.map((a, j) =>
                          j === i ? { ...a, [key]: +e.target.value } : a,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="button-group picker-row">
        <Choice
          value={pick}
          onChange={setPick}
          options={exercises.map((e) => e.name)}
          label="Template exercise"
        />
        <button
          className="secondary"
          type="button"
          onClick={() => {
            const ex = exercises.find((e) => e.name === pick)!;
            if (entries.some((x) => x.exerciseId === ex.id)) {
              toast.error("That exercise is already in the template.");
              return;
            }
            setEntries([
              ...entries,
              {
                exerciseId: ex.id,
                weight: ex.baseWeight,
                reps: ex.baseReps,
                sets: ex.baseSets,
              },
            ]);
          }}
        >
          <Plus size={16} /> Add
        </button>
      </div>
      <button className="primary full">Save template</button>
    </form>
  );
}
