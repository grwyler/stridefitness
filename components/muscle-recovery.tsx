"use client";
import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Spot = [number, number, number, number, number?];
const positions: Record<MuscleGroup, { front?: Spot[]; back?: Spot[] }> = {
  Chest: {
    front: [
      [25.3, 22.6, 10.5, 6.4],
      [35.8, 22.6, 10.5, 6.4],
    ],
  },
  Shoulders: {
    front: [
      [18, 21, 4, 6, 12],
      [43, 21, 4, 6, -12],
    ],
    back: [
      [68, 21, 4, 6, -12],
      [89, 21, 4, 6, 12],
    ],
  },
  Triceps: {
    back: [
      [66.5, 31, 3.5, 8, 8],
      [90.5, 31, 3.5, 8, -8],
    ],
  },
  Back: {
    back: [
      [73, 28, 8, 13, 10],
      [84, 28, 8, 13, -10],
    ],
  },
  Biceps: {
    front: [
      [16.5, 31, 4, 9, 8],
      [44, 31, 4, 9, -8],
    ],
  },
  Core: {
    front: [
      [27.5, 34, 5, 13],
      [33.5, 34, 5, 13],
    ],
  },
  Glutes: {
    back: [
      [74, 49, 8, 9, -8],
      [84, 49, 8, 9, 8],
    ],
  },
  Quadriceps: {
    front: [
      [25, 58, 7, 16, 3],
      [37, 58, 7, 16, -3],
    ],
  },
  Hamstrings: {
    back: [
      [74, 60, 7, 16, 3],
      [84, 60, 7, 16, -3],
    ],
  },
  Calves: {
    front: [
      [25, 76, 5, 13, 3],
      [37, 76, 5, 13, -3],
    ],
    back: [
      [74, 76, 5, 13, 3],
      [84, 76, 5, 13, -3],
    ],
  },
};
const tone = (state: string) =>
  state === "Recovering"
    ? "recovering"
    : state === "Nearly recovered"
      ? "nearly"
      : state === "Likely ready"
        ? "ready"
        : "unknown";

export function MuscleRecoveryMap({ data }: { data: Data }) {
  const recovery = useMemo(() => muscleRecovery(data), [data]);
  const [selected, setSelected] = useState<MuscleGroup>(
    () => recovery.find((x) => x.state === "Recovering")?.group || "Chest",
  );
  const current = recovery.find((x) => x.group === selected)!;
  const figure = data.profile?.sex === "Female" ? "feminine" : "masculine";
  return (
    <section className="panel muscle-recovery" id="muscle-recovery">
      <div className="section-head">
        <div>
          <h2>
            <RotateCcw size={19} /> Muscle recovery
          </h2>
          <p>
            Estimated from your completed sets, effort, muscle involvement, and
            time since training.
          </p>
        </div>
      </div>
      <div className="muscle-recovery-layout">
        <div className={"muscle-figure figure-" + figure}>
          <div className="muscle-canvas">
            <img
              src={`/muscle-map-${figure}.png`}
              alt={`${figure} front and back muscle map`}
            />
            <div className="muscle-overlays">
            {recovery.filter((item) => item.state === "Recovering" || item.state === "Nearly recovered").flatMap((item) =>
              (["front", "back"] as const).flatMap((side) =>
                (positions[item.group][side] || []).map((pos, index) => (
                  <button
                    key={item.group + side + index}
                    title={`${item.group}: ${item.state}`}
                    aria-label={`${item.group}, ${item.state}`}
                    className={
                      "muscle-region " +
                      `group-${item.group.toLowerCase()} side-${side} region-${index} ` +
                      tone(item.state) +
                      (selected === item.group ? " selected" : "")
                    }
                    style={{
                      left: `${pos[0]}%`,
                      top: `${pos[1]}%`,
                      width: `${pos[2]}%`,
                      height: `${pos[3]}%`,
                      rotate: `${pos[4] || 0}deg`,
                    }}
                    onClick={() => setSelected(item.group)}
                  />
                )),
              ),
            )}
            </div>
            <span className="figure-side front">Front</span>
            <span className="figure-side back">Back</span>
          </div>
        </div>
        <div className="muscle-recovery-detail">
          <div className={"recovery-state " + tone(current.state)}>
            {current.state}
          </div>
          <h3>{current.group}</h3>
          <p>{current.detail}</p>
          <div className="recovery-legend">
            {["Recovering", "Nearly recovered", "Likely ready", "Unknown"].map(
              (state) => (
                <span key={state}>
                  <i className={tone(state)} />
                  {state}
                </span>
              ),
            )}
          </div>
          <p className="recovery-caution">
            <Info size={15} /> This is a training estimate, not a measurement of
            soreness or biological recovery. How you feel still matters.
          </p>
        </div>
      </div>
    </section>
  );
}
