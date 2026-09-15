"use client";
import { useEffect, useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Region={group:MuscleGroup;d:string};
const masculineRegions:Region[]=[
 {group:'Chest',d:'M91 183 C115 171 152 171 181 184 L181 228 C165 244 140 249 115 245 C97 240 87 225 87 204 C87 194 89 187 91 183Z'},
 {group:'Chest',d:'M185 184 C214 171 251 171 275 183 C277 187 279 194 279 204 C279 225 269 240 251 245 C226 249 201 244 185 228Z'},
 {group:'Shoulders',d:'M61 176 C48 184 46 207 53 226 C58 238 66 243 73 236 C80 226 86 201 82 184 C76 177 68 174 61 176Z'},{group:'Shoulders',d:'M284 184 C280 201 286 226 293 236 C300 243 308 238 313 226 C320 207 318 184 305 176 C298 174 290 177 284 184Z'},
 {group:'Shoulders',d:'M347 178 C337 188 336 209 344 227 C349 238 357 242 364 234 C371 222 374 198 367 184 C361 178 353 176 347 178Z'},{group:'Shoulders',d:'M549 184 C542 198 545 222 552 234 C559 242 567 238 572 227 C580 209 579 188 569 178 C563 176 555 178 549 184Z'},
 {group:'Traps',d:'M414 158 C427 169 443 177 456 184 L456 216 C440 207 423 195 407 183 C410 174 412 166 414 158Z'},{group:'Traps',d:'M460 184 C473 177 489 169 502 158 C504 166 506 174 509 183 C493 195 476 207 460 216Z'},
 {group:'Biceps',d:'M60 228 C50 249 48 284 55 314 C59 330 68 338 76 330 C87 310 92 269 86 240 C82 225 69 219 60 228Z'},{group:'Biceps',d:'M306 228 C316 249 318 284 311 314 C307 330 298 338 290 330 C279 310 274 269 280 240 C284 225 297 219 306 228Z'},
 {group:'Triceps',d:'M349 226 C338 247 338 282 346 315 C350 333 359 344 369 338 C381 319 388 278 382 245 C379 229 366 218 354 221 C352 222 350 224 349 226Z'},{group:'Triceps',d:'M567 226 C578 247 578 282 570 315 C566 333 557 344 547 338 C535 319 528 278 534 245 C537 229 550 218 562 221 C564 222 566 224 567 226Z'},
 {group:'Forearms',d:'M54 323 C43 340 35 367 30 399 C26 426 31 448 42 453 C52 443 60 417 65 386 C70 357 66 335 54 323Z'},{group:'Forearms',d:'M312 323 C323 340 331 367 336 399 C340 426 335 448 324 453 C314 443 306 417 301 386 C296 357 300 335 312 323Z'},
 {group:'Forearms',d:'M352 322 C342 342 336 373 337 406 C338 432 345 451 356 454 C365 441 370 414 370 384 C370 353 364 330 352 322Z'},{group:'Forearms',d:'M564 322 C574 342 580 373 579 406 C578 432 571 451 560 454 C551 441 546 414 546 384 C546 353 552 330 564 322Z'},
 {group:'Back',d:'M390 220 C407 225 435 245 456 269 L456 382 C426 362 401 326 382 276Z'},{group:'Back',d:'M460 269 C481 245 509 225 526 220 L534 276 C515 326 490 362 460 382Z'},
 {group:'Core',d:'M125 252 C145 244 161 249 181 260 L181 403 C158 395 139 366 126 323Z'},{group:'Core',d:'M185 260 C205 249 221 244 241 252 L240 323 C227 366 208 395 185 403Z'},
 {group:'Glutes',d:'M389 397 C414 382 442 390 456 414 L456 482 C426 500 390 481 383 447Z'},{group:'Glutes',d:'M460 414 C474 390 502 382 527 397 L533 447 C526 481 490 500 460 482Z'},
 {group:'Quadriceps',d:'M100 449 C126 430 155 445 164 484 C162 558 143 623 116 635 C94 592 86 513 100 449Z'},{group:'Quadriceps',d:'M202 484 C211 445 240 430 266 449 C280 513 272 592 250 635 C223 623 204 558 202 484Z'},
 {group:'Hamstrings',d:'M397 491 C423 478 447 495 454 534 C450 606 432 654 410 665 C390 617 382 545 397 491Z'},{group:'Hamstrings',d:'M478 534 C484 499 501 483 519 493 C530 545 523 610 506 655 C490 642 480 597 478 534Z'},
 {group:'Calves',d:'M94 648 C110 635 130 651 133 687 C131 729 119 762 105 772 C91 742 85 681 94 648Z'},{group:'Calves',d:'M221 687 C224 651 244 635 260 648 C269 681 263 742 249 772 C235 762 223 729 221 687Z'},
 {group:'Calves',d:'M396 662 C410 646 428 659 431 695 C429 735 418 766 405 777 C391 744 385 694 396 662Z'},{group:'Calves',d:'M495 695 C498 662 512 649 524 665 C533 699 526 746 514 775 C503 763 497 735 495 695Z'},
];
const feminineRegions:Region[]=[
 {group:'Chest',d:'M84 218 C103 204 132 203 158 216 C165 232 166 254 158 274 C151 293 136 303 118 302 C98 301 84 289 78 270 C73 252 76 231 84 218Z'},{group:'Chest',d:'M166 216 C192 203 221 204 240 218 C248 231 251 252 246 270 C240 289 226 301 206 302 C188 303 173 293 166 274 C158 254 159 232 166 216Z'},
 {group:'Shoulders',d:'M67 207 C56 216 55 239 63 257 C68 267 76 270 82 261 C88 249 90 225 82 212 C78 207 72 205 67 207Z'},{group:'Shoulders',d:'M243 212 C235 225 237 249 243 261 C249 270 257 267 262 257 C270 239 269 216 258 207 C253 205 247 207 243 212Z'},{group:'Shoulders',d:'M324 210 C314 220 314 242 322 258 C327 268 335 270 341 261 C348 248 349 226 342 214 C337 209 329 207 324 210Z'},{group:'Shoulders',d:'M498 214 C491 226 492 248 499 261 C505 270 513 268 518 258 C526 242 526 220 516 210 C511 207 503 209 498 214Z'},
 {group:'Traps',d:'M370 178 C383 188 402 198 418 208 L418 235 C400 225 383 211 367 196 C368 190 369 184 370 178Z'},{group:'Traps',d:'M422 208 C438 198 457 188 470 178 C471 184 472 190 473 196 C457 211 440 225 422 235Z'},
 {group:'Biceps',d:'M66 262 C58 282 58 316 66 342 C71 357 80 362 87 350 C96 326 98 288 89 267 C84 256 72 254 66 262Z'},{group:'Biceps',d:'M258 262 C266 282 266 316 258 342 C253 357 244 362 237 350 C228 326 226 288 235 267 C240 256 252 254 258 262Z'},
 {group:'Triceps',d:'M317 250 C305 271 305 309 314 341 C319 358 328 367 338 358 C349 336 354 296 346 265 C342 251 328 243 317 250Z'},{group:'Triceps',d:'M523 250 C535 271 535 309 526 341 C521 358 512 367 502 358 C491 336 486 296 494 265 C498 251 512 243 523 250Z'},
 {group:'Forearms',d:'M57 343 C46 361 37 389 30 421 C24 448 27 469 38 476 C49 465 58 438 65 406 C71 376 69 354 57 343Z'},{group:'Forearms',d:'M267 343 C278 361 287 389 294 421 C300 448 297 469 286 476 C275 465 266 438 259 406 C253 376 255 354 267 343Z'},{group:'Forearms',d:'M311 342 C301 363 296 393 299 424 C301 449 309 468 320 472 C329 459 334 432 332 402 C330 373 323 350 311 342Z'},{group:'Forearms',d:'M529 342 C539 363 544 393 541 424 C539 449 531 468 520 472 C511 459 506 432 508 402 C510 373 517 350 529 342Z'},
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
  const active = useMemo(() => {
    const order = { Recovering: 0, "Nearly recovered": 1, "Likely ready": 2, Unknown: 3 } as Record<string, number>;
    return recovery
      .filter((item) => item.hoursSince !== null && item.hoursSince <= 120)
      .sort((a, b) => order[a.state] - order[b.state] || a.group.localeCompare(b.group));
  }, [recovery]);
  const [selected, setSelected] = useState<MuscleGroup>(
    () => recovery.find((x) => x.state === "Recovering")?.group || "Chest",
  );
  useEffect(() => {
    if (active.length && !active.some((item) => item.group === selected))
      setSelected(active[0].group);
  }, [active, selected]);
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
            {active.flatMap((item) =>
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
          <div className="recovery-summary">
            <strong>Recently trained</strong>
            <div>
              {active.map((item) => (
                <button
                  type="button"
                  key={item.group}
                  aria-pressed={selected === item.group}
                  className={selected === item.group ? "selected" : ""}
                  onClick={() => setSelected(item.group)}
                >
                  <i className={tone(item.state)} />
                  <span>{item.group}</span>
                  <small>{item.state}</small>
                </button>
              ))}
            </div>
          </div>
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
