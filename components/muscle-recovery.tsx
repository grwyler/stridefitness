"use client";
import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Region={group:MuscleGroup;d:string};
const masculineRegions:Region[]=[
 {group:'Chest',d:'M60 184 C88 164 144 164 181 181 L181 228 C163 248 132 255 101 247 C75 240 60 220 60 184Z'},
 {group:'Chest',d:'M185 181 C222 164 278 164 306 184 C307 220 292 240 266 247 C235 255 203 248 185 228Z'},
 {group:'Shoulders',d:'M72 181 C60 191 59 218 72 236 C80 225 85 201 82 187 C79 184 76 182 72 181Z'},{group:'Shoulders',d:'M292 187 C289 201 294 225 302 236 C315 218 314 191 302 181 C298 182 295 184 292 187Z'},
 {group:'Shoulders',d:'M351 184 C341 196 343 221 354 237 C364 226 369 204 365 190 C361 187 356 185 351 184Z'},{group:'Shoulders',d:'M544 190 C540 204 545 226 555 237 C566 221 568 196 558 184 C553 185 548 187 544 190Z'},
 {group:'Traps',d:'M414 158 C427 169 443 177 456 184 L456 216 C440 207 423 195 407 183 C410 174 412 166 414 158Z'},{group:'Traps',d:'M460 184 C473 177 489 169 502 158 C504 166 506 174 509 183 C493 195 476 207 460 216Z'},
 {group:'Biceps',d:'M65 251 C58 272 59 306 68 322 C76 309 80 275 75 253 C72 251 68 251 65 251Z'},{group:'Biceps',d:'M300 253 C295 275 299 309 307 322 C316 306 317 272 310 251 C307 251 303 251 300 253Z'},
 {group:'Triceps',d:'M357 252 C351 273 353 307 362 322 C371 306 374 274 369 253 C365 251 361 251 357 252Z'},{group:'Triceps',d:'M555 253 C550 274 553 306 562 322 C571 307 573 273 567 252 C563 251 559 251 555 253Z'},
 {group:'Forearms',d:'M48 342 C39 371 32 411 41 432 C52 414 59 374 56 343 C53 341 51 341 48 342Z'},{group:'Forearms',d:'M321 343 C318 374 325 414 336 432 C345 411 338 371 329 342 C326 341 324 341 321 343Z'},
 {group:'Forearms',d:'M347 342 C338 371 332 411 341 432 C351 414 357 375 354 343 C352 341 349 341 347 342Z'},{group:'Forearms',d:'M570 343 C567 375 573 414 583 432 C592 411 586 371 577 342 C575 341 572 341 570 343Z'},
 {group:'Back',d:'M390 220 C407 225 435 245 456 269 L456 382 C426 362 401 326 382 276Z'},{group:'Back',d:'M460 269 C481 245 509 225 526 220 L534 276 C515 326 490 362 460 382Z'},
 {group:'Core',d:'M125 252 C145 244 161 249 181 260 L181 403 C158 395 139 366 126 323Z'},{group:'Core',d:'M185 260 C205 249 221 244 241 252 L240 323 C227 366 208 395 185 403Z'},
 {group:'Glutes',d:'M389 397 C414 382 442 390 456 414 L456 482 C426 500 390 481 383 447Z'},{group:'Glutes',d:'M460 414 C474 390 502 382 527 397 L533 447 C526 481 490 500 460 482Z'},
 {group:'Quadriceps',d:'M100 449 C126 430 155 445 164 484 C162 558 143 623 116 635 C94 592 86 513 100 449Z'},{group:'Quadriceps',d:'M202 484 C211 445 240 430 266 449 C280 513 272 592 250 635 C223 623 204 558 202 484Z'},
 {group:'Hamstrings',d:'M397 491 C423 478 447 495 454 534 C450 606 432 654 410 665 C390 617 382 545 397 491Z'},{group:'Hamstrings',d:'M462 534 C469 495 493 478 519 491 C534 545 526 617 506 665 C484 654 466 606 462 534Z'},
 {group:'Calves',d:'M94 648 C110 635 130 651 133 687 C131 729 119 762 105 772 C91 742 85 681 94 648Z'},{group:'Calves',d:'M221 687 C224 651 244 635 260 648 C269 681 263 742 249 772 C235 762 223 729 221 687Z'},
 {group:'Calves',d:'M396 662 C410 646 428 659 431 695 C429 735 418 766 405 777 C391 744 385 694 396 662Z'},{group:'Calves',d:'M485 695 C488 659 506 646 520 662 C531 694 525 744 511 777 C498 766 487 735 485 695Z'},
];
const feminineRegions:Region[]=[
 {group:'Chest',d:'M69 220 C89 200 126 199 159 216 C171 242 165 283 143 300 C112 308 78 286 69 252Z'},{group:'Chest',d:'M166 216 C199 199 236 200 256 220 L256 252 C247 286 213 308 182 300 C160 283 154 242 166 216Z'},
 {group:'Shoulders',d:'M73 212 C62 223 63 249 75 264 C83 251 87 228 81 214 C79 212 76 211 73 212Z'},{group:'Shoulders',d:'M244 214 C238 228 242 251 250 264 C262 249 263 223 252 212 C249 211 246 212 244 214Z'},{group:'Shoulders',d:'M330 214 C320 226 322 250 332 263 C342 251 345 230 340 217 C337 215 333 214 330 214Z'},{group:'Shoulders',d:'M498 217 C493 230 496 251 506 263 C516 250 518 226 508 214 C505 214 501 215 498 217Z'},
 {group:'Traps',d:'M370 178 C383 188 402 198 418 208 L418 235 C400 225 383 211 367 196 C368 190 369 184 370 178Z'},{group:'Traps',d:'M422 208 C438 198 457 188 470 178 C471 184 472 190 473 196 C457 211 440 225 422 235Z'},
 {group:'Biceps',d:'M70 282 C63 302 65 331 74 345 C82 332 85 304 79 283 C76 281 73 281 70 282Z'},{group:'Biceps',d:'M252 283 C246 304 249 332 257 345 C266 331 268 302 261 282 C258 281 255 281 252 283Z'},
 {group:'Triceps',d:'M324 280 C318 300 320 329 329 344 C338 330 340 301 334 281 C331 279 327 279 324 280Z'},{group:'Triceps',d:'M504 281 C498 301 500 330 509 344 C518 329 520 300 514 280 C511 279 507 279 504 281Z'},
 {group:'Forearms',d:'M49 357 C34 392 19 435 29 460 C46 443 61 398 63 360Z'},{group:'Forearms',d:'M267 360 C269 398 284 443 301 460 C311 435 296 392 281 357Z'},{group:'Forearms',d:'M309 357 C296 392 286 435 298 458 C314 440 326 397 323 360Z'},{group:'Forearms',d:'M520 360 C517 397 529 440 545 458 C557 435 547 392 534 357Z'},
 {group:'Back',d:'M350 245 C369 251 397 272 418 296 L418 390 C390 371 366 337 346 288Z'},{group:'Back',d:'M422 296 C443 272 471 251 490 245 L494 288 C474 337 450 371 422 390Z'},
 {group:'Core',d:'M126 304 C143 298 156 306 161 326 L161 420 C143 405 130 374 123 334Z'},{group:'Core',d:'M165 326 C170 306 183 298 200 304 L203 334 C196 374 183 405 165 420Z'},
 {group:'Glutes',d:'M356 398 C382 382 408 393 418 419 L418 486 C390 505 357 482 351 447Z'},{group:'Glutes',d:'M422 419 C432 393 458 382 484 398 L489 447 C483 482 450 505 422 486Z'},
 {group:'Quadriceps',d:'M88 458 C112 438 139 454 149 493 C147 566 131 626 108 640 C85 594 76 519 88 458Z'},{group:'Quadriceps',d:'M184 493 C194 454 221 438 245 458 C257 519 248 594 225 640 C202 626 186 566 184 493Z'},
 {group:'Hamstrings',d:'M361 493 C384 479 408 496 416 535 C413 608 398 654 377 668 C357 620 349 548 361 493Z'},{group:'Hamstrings',d:'M424 535 C432 496 456 479 479 493 C491 548 483 620 463 668 C442 654 427 608 424 535Z'},
 {group:'Calves',d:'M83 655 C98 641 116 655 120 691 C118 735 108 768 96 779 C82 746 75 690 83 655Z'},{group:'Calves',d:'M211 691 C215 655 233 641 248 655 C256 690 249 746 235 779 C223 768 213 735 211 691Z'},{group:'Calves',d:'M354 665 C368 649 386 662 389 697 C387 739 377 770 364 781 C351 749 344 697 354 665Z'},{group:'Calves',d:'M451 697 C454 662 472 649 486 665 C496 697 489 749 476 781 C463 770 453 739 451 697Z'},
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
            <svg className="muscle-overlays" viewBox={figure === "feminine" ? "0 0 592 887" : "0 0 591 887"} preserveAspectRatio="none" aria-label="Interactive muscle recovery regions">
            {recovery.filter((item) => item.hoursSince !== null && item.hoursSince <= 120).flatMap((item) =>
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
