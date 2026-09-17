"use client";

import { BatteryCharging, Moon, ShieldAlert, Sparkles } from "lucide-react";
import type { DailyReadiness } from "@/lib/training";

type Choice = "low" | "okay" | "high";
const labels: Record<Choice, string> = { low: "Low", okay: "Okay", high: "High" };
const sleepLabels: Record<"low" | "okay" | "great", string> = { low: "Poor", okay: "Okay", great: "Great" };

function score(value: string) {
  return value === "high" || value === "great" ? 2 : value === "okay" ? 1 : 0;
}

export function readinessRecommendation(entry?: DailyReadiness) {
  if (!entry) return { label: "Check in before training", detail: "Add how you feel today and Stride will suggest the right session intensity.", tone: "unknown" };
  const total = score(entry.sleep) + score(entry.energy) + (2 - score(entry.stress)) + (2 - score(entry.soreness));
  if (total <= 3) return { label: "Recovery session recommended", detail: "Keep the movement, but reduce load or volume and stop well short of grinding reps.", tone: "recovery" };
  if (total <= 5) return { label: "Train, but keep a rep in reserve", detail: "A normal session is fine. Let your first working set decide whether to hold targets steady.", tone: "steady" };
  return { label: "Good day to push", detail: "Your check-in supports a normal hard session. Take the progression if your warm-ups feel good.", tone: "ready" };
}

export function DailyReadinessCheck({ value, onSave }: { value?: DailyReadiness; onSave: (entry: DailyReadiness) => void }) {
  const recommendation = readinessRecommendation(value);
  const pick = (field: keyof Omit<DailyReadiness, "date">, next: string) => onSave({
    date: value?.date || new Date().toISOString().slice(0, 10),
    sleep: value?.sleep || "okay", stress: value?.stress || "okay", soreness: value?.soreness || "okay", energy: value?.energy || "okay",
    [field]: next,
  } as DailyReadiness);
  const rows: { field: keyof Omit<DailyReadiness, "date">; label: string; icon: typeof Moon; choices: string[] }[] = [
    { field: "sleep", label: "Sleep", icon: Moon, choices: ["low", "okay", "great"] },
    { field: "energy", label: "Energy", icon: BatteryCharging, choices: ["low", "okay", "high"] },
    { field: "soreness", label: "Soreness", icon: ShieldAlert, choices: ["low", "okay", "high"] },
    { field: "stress", label: "Stress", icon: Sparkles, choices: ["low", "okay", "high"] },
  ];
  return <section className={'panel daily-readiness '+recommendation.tone} aria-labelledby="readiness-title">
    <div className="daily-readiness-head"><div><span className="eyebrow">TODAY'S READINESS</span><h2 id="readiness-title">{recommendation.label}</h2><p>{recommendation.detail}</p></div></div>
    <div className="readiness-checks">{rows.map(({ field, label, icon: Icon, choices }) => <div className="readiness-check" key={field}><span><Icon size={16}/>{label}</span><div role="group" aria-label={label}>{choices.map(choice => <button type="button" key={choice} className={(value?.[field] || "okay") === choice ? "selected" : ""} aria-pressed={(value?.[field] || "okay") === choice} onClick={() => pick(field, choice)}>{field === "sleep" ? sleepLabels[choice as keyof typeof sleepLabels] : labels[choice as Choice]}</button>)}</div></div>)}</div>
    {!value && <small>Your check-in is saved only for today. It complements recovery estimates; it does not replace how you feel during a set.</small>}
  </section>;
}
