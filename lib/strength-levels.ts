export const compoundStrengthLevels = ["Beginner", "Intermediate", "Advanced", "Elite"] as const;
export type CompoundStrengthLevel = typeof compoundStrengthLevels[number];
export type StrengthLevelContext = {
  bodyweight: number | null | undefined;
  sex?: "Male" | "Female" | null;
  ageRange?: "Under 18" | "18–29" | "30–44" | "45–59" | "60+" | "Prefer not to say" | null;
};

// Approximate training references, not competition standards. The base bands
// describe an adult male reference and are adjusted for available user context.
// Body mass is scaled allometrically (rather than linearly) because relative
// strength does not rise in direct proportion to body mass.
const levelRatios: Record<string, readonly [number, number, number, number]> = {
  press: [0.5, 1, 1.5, 2],
  squat: [0.75, 1.25, 1.75, 2.5],
  hinge: [1, 1.5, 2, 2.75],
  overhead: [0.3, 0.55, 0.85, 1.2],
  row: [0.5, 0.8, 1.15, 1.6],
  olympic: [0.35, 0.6, 0.9, 1.25],
  hipThrust: [1, 1.5, 2, 2.75],
};
const exerciseStandards: Record<string, { family: keyof typeof levelRatios; multiplier?: number }> = {
  e0: { family: "press" }, e1: { family: "squat" }, e2: { family: "hinge" }, e3: { family: "overhead" }, e4: { family: "row" },
  "library-incline-barbell-bench-press": { family: "press", multiplier: 0.85 },
  "library-decline-barbell-bench-press": { family: "press", multiplier: 1.05 },
  "library-close-grip-bench-press": { family: "press", multiplier: 1.05 },
  "library-paused-bench-press": { family: "press" },
  "library-barbell-floor-press": { family: "press", multiplier: 0.9 },
  "library-pendlay-row": { family: "row", multiplier: 1.05 },
  "library-underhand-barbell-row": { family: "row" },
  "library-t-bar-row": { family: "row", multiplier: 0.9 },
  "library-seated-barbell-press": { family: "overhead", multiplier: 0.9 },
  "library-push-press": { family: "overhead", multiplier: 1.15 },
  "library-front-squat": { family: "squat", multiplier: 0.8 },
  "library-box-squat": { family: "squat" },
  "library-zercher-squat": { family: "squat", multiplier: 0.8 },
  "library-safety-bar-squat": { family: "squat", multiplier: 0.95 },
  "library-smith-machine-squat": { family: "squat", multiplier: 0.9 },
  "library-goblet-squat": { family: "squat", multiplier: 0.65 },
  "library-sumo-squat": { family: "squat", multiplier: 0.9 },
  "library-sumo-deadlift": { family: "hinge" },
  "library-romanian-deadlift": { family: "hinge", multiplier: 0.8 },
  "library-trap-bar-deadlift": { family: "hinge", multiplier: 1.1 },
  "library-rack-pull": { family: "hinge", multiplier: 1.15 },
  "library-deficit-deadlift": { family: "hinge", multiplier: 0.95 },
  "library-good-morning": { family: "hinge", multiplier: 0.6 },
  "library-barbell-hip-thrust": { family: "hipThrust" },
  "library-barbell-clean": { family: "olympic" },
  "library-hang-clean": { family: "olympic", multiplier: 0.95 },
  "library-power-clean": { family: "olympic", multiplier: 1.05 },
  "library-clean-and-press": { family: "olympic", multiplier: 0.9 },
  "library-barbell-snatch": { family: "olympic", multiplier: 0.8 },
  "library-barbell-thruster": { family: "olympic", multiplier: 1.1 },
};

const ageFactor = (ageRange: StrengthLevelContext["ageRange"]) =>
  ageRange === "Under 18" ? 0.75 : ageRange === "45–59" ? 0.9 : ageRange === "60+" ? 0.8 : 1;

function contextFactor(exerciseId: string, context: StrengthLevelContext) {
  const family = exerciseStandards[exerciseId]?.family;
  const upperBody = family === "press" || family === "overhead" || family === "row";
  // Sex differences in relative strength are movement-dependent and largest
  // for upper-body lifts; this deliberately broad adjustment keeps the labels
  // useful without implying a precise population percentile.
  const sex = context.sex === "Female" ? (upperBody ? 0.72 : 0.84) : context.sex === "Male" ? 1 : 0.86;
  const bodyweight = context.bodyweight!;
  const mass = Math.max(0.72, Math.min(1.45, Math.pow(bodyweight / 154, -0.33)));
  return sex * ageFactor(context.ageRange) * mass;
}

export function compoundLevelTargets(exerciseId: string, context: StrengthLevelContext) {
  const standard = exerciseStandards[exerciseId];
  const bodyweight = context.bodyweight;
  if (!standard || !bodyweight || bodyweight <= 0) return null;
  const adjustment = contextFactor(exerciseId, context);
  return levelRatios[standard.family].map((ratio, index) => ({
    level: compoundStrengthLevels[index],
    weight: Math.round((bodyweight * ratio * (standard.multiplier ?? 1) * adjustment) / 5) * 5,
  }));
}

export function compoundStrengthLevel(estimate: number, exerciseId: string, context: StrengthLevelContext): CompoundStrengthLevel | null {
  if (estimate <= 0) return null;
  const targets = compoundLevelTargets(exerciseId, context);
  if (!targets) return null;
  let current: CompoundStrengthLevel = "Beginner";
  for (const target of targets) if (estimate >= target.weight) current = target.level;
  return current;
}
