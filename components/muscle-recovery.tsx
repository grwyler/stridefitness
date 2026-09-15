"use client";
import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Region={group:MuscleGroup;d:string};
const masculineRegions:Region[]=[
 {group:'Chest',d:'M60 184 C88 164 144 164 181 181 L181 228 C163 248 132 255 101 247 C75 240 60 220 60 184Z'},
 {group:'Chest',d:'M185 181 C222 164 278 164 306 184 C307 220 292 240 266 247 C235 255 203 248 185 228Z'},
 {group:'Shoulders',d:'M51 178 C35 190 36 226 53 246 C65 235 72 202 67 184Z'},{group:'Shoulders',d:'M306 184 C301 202 308 235 320 246 C337 226 338 190 322 178Z'},
 {group:'Shoulders',d:'M340 181 C326 196 329 229 344 246 C357 236 365 204 358 187Z'},{group:'Shoulders',d:'M551 187 C544 204 552 236 565 246 C580 229 583 196 569 181Z'},
 {group:'Traps',d:'M410 143 C426 162 443 169 456 177 L456 235 C433 222 411 202 391 185Z'},{group:'Traps',d:'M460 177 C474 169 491 162 507 143 L526 185 C506 202 484 222 460 235Z'},
 {group:'Biceps',d:'M42 247 C32 271 34 315 48 334 C62 319 68 275 61 249Z'},{group:'Biceps',d:'M311 249 C304 275 310 319 324 334 C338 315 340 271 330 247Z'},
 {group:'Triceps',d:'M337 248 C329 273 333 318 347 334 C360 314 365 273 357 248Z'},{group:'Triceps',d:'M566 248 C558 273 563 314 576 334 C590 318 594 273 586 248Z'},
 {group:'Forearms',d:'M34 337 C20 376 10 426 25 451 C42 429 54 376 50 339Z'},{group:'Forearms',d:'M325 339 C321 376 333 429 350 451 C365 426 355 376 341 337Z'},
 {group:'Forearms',d:'M329 337 C316 376 308 426 322 451 C339 429 349 377 345 339Z'},{group:'Forearms',d:'M578 339 C574 377 584 429 601 451 C615 426 607 376 594 337Z'},
 {group:'Back',d:'M390 220 C407 225 435 245 456 269 L456 382 C426 362 401 326 382 276Z'},{group:'Back',d:'M460 269 C481 245 509 225 526 220 L534 276 C515 326 490 362 460 382Z'},
 {group:'Core',d:'M125 252 C145 244 161 249 181 260 L181 403 C158 395 139 366 126 323Z'},{group:'Core',d:'M185 260 C205 249 221 244 241 252 L240 323 C227 366 208 395 185 403Z'},
 {group:'Glutes',d:'M389 397 C414 382 442 390 456 414 L456 482 C426 500 390 481 383 447Z'},{group:'Glutes',d:'M460 414 C474 390 502 382 527 397 L533 447 C526 481 490 500 460 482Z'},
 {group:'Quadriceps',d:'M100 449 C126 430 155 445 164 484 C162 558 143 623 116 635 C94 592 86 513 100 449Z'},{group:'Quadriceps',d:'M202 484 C211 445 240 430 266 449 C280 513 272 592 250 635 C223 623 204 558 202 484Z'},
 {group:'Hamstrings',d:'M397 491 C423 478 447 495 454 534 C450 606 432 654 410 665 C390 617 382 545 397 491Z'},{group:'Hamstrings',d:'M462 534 C469 495 493 478 519 491 C534 545 526 617 506 665 C484 654 466 606 462 534Z'},
 {group:'Calves',d:'M91 643 C112 624 137 648 139 690 C136 751 120 800 103 806 C84 759 77 687 91 643Z'},{group:'Calves',d:'M227 690 C229 648 254 624 275 643 C289 687 282 759 263 806 C246 800 230 751 227 690Z'},
 {group:'Calves',d:'M389 658 C407 636 432 653 437 697 C435 756 420 798 403 808 C384 766 376 700 389 658Z'},{group:'Calves',d:'M479 697 C484 653 509 636 527 658 C540 700 532 766 513 808 C496 798 481 756 479 697Z'},
];
const feminineRegions:Region[]=[
 {group:'Chest',d:'M69 220 C89 200 126 199 159 216 C171 242 165 283 143 300 C112 308 78 286 69 252Z'},{group:'Chest',d:'M166 216 C199 199 236 200 256 220 L256 252 C247 286 213 308 182 300 C160 283 154 242 166 216Z'},
 {group:'Shoulders',d:'M61 208 C45 222 48 260 65 277 C76 260 80 226 73 211Z'},{group:'Shoulders',d:'M252 211 C245 226 249 260 260 277 C277 260 280 222 264 208Z'},{group:'Shoulders',d:'M318 211 C304 225 307 257 322 274 C335 260 340 230 333 216Z'},{group:'Shoulders',d:'M503 216 C496 230 501 260 514 274 C529 257 532 225 518 211Z'},
 {group:'Traps',d:'M365 164 C382 184 402 193 418 205 L418 250 C394 237 373 215 351 194Z'},{group:'Traps',d:'M422 205 C438 193 458 184 475 164 L489 194 C467 215 446 237 422 250Z'},
 {group:'Biceps',d:'M56 278 C47 303 51 343 63 358 C76 341 80 303 72 278Z'},{group:'Biceps',d:'M257 278 C249 303 253 341 266 358 C278 343 282 303 273 278Z'},
 {group:'Triceps',d:'M311 276 C303 300 307 339 320 356 C332 340 336 301 329 278Z'},{group:'Triceps',d:'M509 278 C502 301 506 340 518 356 C531 339 535 300 527 276Z'},
 {group:'Forearms',d:'M49 357 C34 392 19 435 29 460 C46 443 61 398 63 360Z'},{group:'Forearms',d:'M267 360 C269 398 284 443 301 460 C311 435 296 392 281 357Z'},{group:'Forearms',d:'M309 357 C296 392 286 435 298 458 C314 440 326 397 323 360Z'},{group:'Forearms',d:'M520 360 C517 397 529 440 545 458 C557 435 547 392 534 357Z'},
 {group:'Back',d:'M350 245 C369 251 397 272 418 296 L418 390 C390 371 366 337 346 288Z'},{group:'Back',d:'M422 296 C443 272 471 251 490 245 L494 288 C474 337 450 371 422 390Z'},
 {group:'Core',d:'M126 304 C143 298 156 306 161 326 L161 420 C143 405 130 374 123 334Z'},{group:'Core',d:'M165 326 C170 306 183 298 200 304 L203 334 C196 374 183 405 165 420Z'},
 {group:'Glutes',d:'M356 398 C382 382 408 393 418 419 L418 486 C390 505 357 482 351 447Z'},{group:'Glutes',d:'M422 419 C432 393 458 382 484 398 L489 447 C483 482 450 505 422 486Z'},
 {group:'Quadriceps',d:'M88 458 C112 438 139 454 149 493 C147 566 131 626 108 640 C85 594 76 519 88 458Z'},{group:'Quadriceps',d:'M184 493 C194 454 221 438 245 458 C257 519 248 594 225 640 C202 626 186 566 184 493Z'},
 {group:'Hamstrings',d:'M361 493 C384 479 408 496 416 535 C413 608 398 654 377 668 C357 620 349 548 361 493Z'},{group:'Hamstrings',d:'M424 535 C432 496 456 479 479 493 C491 548 483 620 463 668 C442 654 427 608 424 535Z'},
 {group:'Calves',d:'M79 650 C99 631 122 650 126 694 C124 754 111 798 95 810 C77 766 68 697 79 650Z'},{group:'Calves',d:'M205 694 C209 650 232 631 252 650 C263 697 254 766 236 810 C220 798 207 754 205 694Z'},{group:'Calves',d:'M349 660 C367 640 389 656 393 699 C391 758 378 799 362 810 C345 769 337 702 349 660Z'},{group:'Calves',d:'M447 699 C451 656 473 640 491 660 C503 702 495 769 478 810 C462 799 449 758 447 699Z'},
];
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
  const regions = figure === "feminine" ? feminineRegions : masculineRegions;
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
            <svg className="muscle-overlays" viewBox="0 0 584 872" preserveAspectRatio="none" aria-label="Interactive muscle recovery regions">
            {recovery.filter((item) => item.state === "Recovering" || item.state === "Nearly recovered").flatMap((item) =>
                regions.filter(region=>region.group===item.group).map((region, index) => (
                  <path
                    key={item.group + index}
                    d={region.d}
                    aria-label={`${item.group}, ${item.state}`}
                    role="button"
                    tabIndex={0}
                    className={
                      "muscle-region " +
                      `group-${item.group.toLowerCase()} region-${index} ` +
                      tone(item.state) +
                      (selected === item.group ? " selected" : "")
                    }
                    onClick={() => setSelected(item.group)}
                    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(item.group)}}}
                  ><title>{`${item.group}: ${item.state}`}</title></path>
                )),
            )}
            </svg>
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
