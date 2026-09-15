"use client";
import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Spot = [number, number, number, number, number?];
const masculinePositions: Record<MuscleGroup, { front?: Spot[]; back?: Spot[] }> = {
  Chest: {
    front: [
      [20.5, 24.2, 20.5, 10],
      [42, 24.2, 20.5, 10],
    ],
  },
  Shoulders: {
    front: [
      [9.5, 22.5, 7, 8, 12],
      [52, 22.5, 7, 8, -12],
    ],
    back: [
      [63.5, 22.5, 7, 8, -12],
      [94, 22.5, 7, 8, 12],
    ],
  },
  Triceps: {
    back: [
      [60, 32, 4.5, 9, 8],
      [98, 32, 4.5, 9, -8],
    ],
  },
  Back: {
    back: [
      [69, 32, 10, 14, 10],
      [86, 32, 10, 14, -10],
    ],
  },
  Biceps: {
    front: [
      [8.5, 32, 4.5, 10, 8],
      [53.5, 32, 4.5, 10, -8],
    ],
  },
  Core: {
    front: [
      [25.5, 37, 6.5, 15],
      [36.5, 37, 6.5, 15],
    ],
  },
  Glutes: {
    back: [
      [72, 51, 10, 10, -8],
      [87, 51, 10, 10, 8],
    ],
  },
  Quadriceps: {
    front: [
      [20.5, 61, 9, 18, 3],
      [42, 61, 9, 18, -3],
    ],
  },
  Hamstrings: {
    back: [
      [72, 62, 8, 18, 3],
      [89, 62, 8, 18, -3],
    ],
  },
  Calves: {
    front: [
      [18, 79, 6, 15, 3],
      [45, 79, 6, 15, -3],
    ],
    back: [
      [71, 79, 6, 15, 3],
      [92, 79, 6, 15, -3],
    ],
  },
};
const femininePositions: typeof masculinePositions = {
  Chest:{front:[[21.5,29,12,10],[35,29,12,10]]},
  Shoulders:{front:[[11,25,6,8,12],[47,25,6,8,-12]],back:[[54,25,6,8,-12],[88,25,6,8,12]]},
  Triceps:{back:[[54,35,4,10,8],[91,35,4,10,-8]]},
  Back:{back:[[62,34,9,15,10],[80,34,9,15,-10]]},
  Biceps:{front:[[8,35,4,10,8],[49,35,4,10,-8]]},
  Core:{front:[[24,40,6,14],[34,40,6,14]]},
  Glutes:{back:[[65,51,11,11,-8],[80,51,11,11,8]]},
  Quadriceps:{front:[[18,61,9,18,3],[39,61,9,18,-3]]},
  Hamstrings:{back:[[64,62,8,18,3],[81,62,8,18,-3]]},
  Calves:{front:[[17,79,6,15,3],[41,79,6,15,-3]],back:[[63,79,6,15,3],[82,79,6,15,-3]]},
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
  const positions = figure === "feminine" ? femininePositions : masculinePositions;
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
