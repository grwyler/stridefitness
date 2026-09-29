export const compoundStrengthLevels = ["Beginner", "Intermediate", "Advanced", "Elite"] as const;
export type CompoundStrengthLevel = typeof compoundStrengthLevels[number];

// Approximate, general bodyweight-multiple benchmarks for the main barbell lifts.
// Each number is the estimated 1RM that starts that level.
const levelRatios: Record<string, readonly [number, number, number, number]> = {
  e0: [0.5, 1, 1.5, 2], // Bench press
  e1: [0.75, 1.25, 1.75, 2.5], // Back squat
  e2: [1, 1.5, 2, 2.75], // Deadlift
  e3: [0.3, 0.55, 0.85, 1.2], // Overhead press
  e4: [0.5, 0.8, 1.15, 1.6], // Barbell row
};

export function compoundLevelTargets(exerciseId: string, bodyweight: number | null | undefined) {
  const ratios = levelRatios[exerciseId];
  if (!ratios || !bodyweight || bodyweight <= 0) return null;
  return ratios.map((ratio, index) => ({
    level: compoundStrengthLevels[index],
    weight: Math.round((bodyweight * ratio) / 5) * 5,
  }));
}

export function compoundStrengthLevel(estimate: number, exerciseId: string, bodyweight: number | null | undefined): CompoundStrengthLevel | null {
  if (estimate <= 0) return null;
  const targets = compoundLevelTargets(exerciseId, bodyweight);
  if (!targets) return null;
  let current: CompoundStrengthLevel = "Beginner";
  for (const target of targets) if (estimate >= target.weight) current = target.level;
  return current;
}
