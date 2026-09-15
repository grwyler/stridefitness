"use client";
import { useEffect, useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Data } from "@/lib/training";
import { muscleRecovery, type MuscleGroup } from "@/lib/muscle-recovery";

type Region={group:MuscleGroup;d:string};
const masculineRegions:Region[]=[
 {group:'Upper Chest',d:'M91 183 C116 171 151 172 181 184 L181 207 C151 199 119 200 88 207 C87 197 88 189 91 183Z'},{group:'Upper Chest',d:'M185 184 C215 172 250 171 275 183 C278 189 279 197 278 207 C247 200 215 199 185 207Z'},
 {group:'Mid Chest',d:'M88 207 C119 200 151 199 181 207 L181 226 C155 224 125 225 92 230 C89 223 88 215 88 207Z'},{group:'Mid Chest',d:'M185 207 C215 199 247 200 278 207 C278 215 277 223 274 230 C241 225 211 224 185 226Z'},
 {group:'Lower Chest',d:'M92 230 C125 225 155 224 181 226 L181 232 C164 246 140 250 116 246 C105 243 97 238 92 230Z'},{group:'Lower Chest',d:'M185 226 C211 224 241 225 274 230 C269 238 261 243 250 246 C226 250 202 246 185 232Z'},
 {group:'Side Delts',d:'M58 176 C47 186 47 208 54 225 C58 235 63 240 69 239 C66 218 69 196 79 181 C72 176 65 174 58 176Z'},{group:'Side Delts',d:'M287 181 C297 196 300 218 297 239 C303 240 308 235 312 225 C319 208 319 186 308 176 C301 174 294 176 287 181Z'},
 {group:'Front Delts',d:'M79 181 C86 188 90 202 88 217 C86 229 79 238 69 239 C66 218 69 196 79 181Z'},{group:'Front Delts',d:'M287 181 C280 188 276 202 278 217 C280 229 287 238 297 239 C300 218 297 196 287 181Z'},
 {group:'Rear Delts',d:'M363 183 C351 185 345 198 347 214 C349 225 355 233 364 235 C371 222 375 203 372 190 C370 186 367 184 363 183Z'},{group:'Rear Delts',d:'M541 183 C553 185 559 198 557 214 C555 225 549 233 540 235 C533 222 529 203 532 190 C534 186 537 184 541 183Z'},
 {group:'Traps',d:'M418 147 C428 160 443 171 456 177 L456 231 C441 220 425 207 411 190 C413 176 416 160 418 147Z'},{group:'Traps',d:'M460 177 C473 171 488 160 498 147 C500 160 503 176 505 190 C491 207 475 220 460 231Z'},
 {group:'Biceps',d:'M60 228 C50 249 48 284 55 314 C59 330 68 338 76 330 C87 310 92 269 86 240 C82 225 69 219 60 228Z'},{group:'Biceps',d:'M306 228 C316 249 318 284 311 314 C307 330 298 338 290 330 C279 310 274 269 280 240 C284 225 297 219 306 228Z'},
 {group:'Triceps',d:'M354 230 C348 250 349 282 356 313 C359 327 364 335 369 334 C376 313 380 279 376 250 C374 236 366 227 359 227 C357 227 355 228 354 230Z'},{group:'Triceps',d:'M550 230 C556 250 555 282 548 313 C545 327 540 335 535 334 C528 313 524 279 528 250 C530 236 538 227 545 227 C547 227 549 228 550 230Z'},
 {group:'Forearms',d:'M54 323 C43 340 35 367 30 399 C26 426 31 448 42 453 C52 443 60 417 65 386 C70 357 66 335 54 323Z'},{group:'Forearms',d:'M312 323 C323 340 331 367 336 399 C340 426 335 448 324 453 C314 443 306 417 301 386 C296 357 300 335 312 323Z'},
 {group:'Forearms',d:'M350 326 C343 347 339 375 340 403 C341 426 347 445 356 451 C362 437 365 412 365 385 C365 357 360 335 350 326Z'},{group:'Forearms',d:'M557 326 C565 346 570 375 571 403 C572 426 567 445 559 451 C551 437 547 412 547 385 C547 357 550 335 557 326Z'},
 {group:'Upper Back',d:'M390 222 C407 226 434 244 454 267 L454 340 C431 322 409 294 392 262 C386 248 385 234 390 222Z'},{group:'Upper Back',d:'M462 267 C482 244 509 226 526 222 C531 234 530 248 524 262 C507 294 485 322 462 340Z'},
 {group:'Lower Back',d:'M428 318 C437 330 446 341 454 347 L454 402 C441 388 431 358 428 318Z'},{group:'Lower Back',d:'M462 347 C470 341 479 330 488 318 C485 358 475 388 462 402Z'},
 {group:'Core',d:'M125 252 C145 244 161 249 181 260 L181 403 C158 395 139 366 126 323Z'},{group:'Core',d:'M185 260 C205 249 221 244 241 252 L240 323 C227 366 208 395 185 403Z'},
 {group:'Glutes',d:'M389 407 C407 393 436 393 454 418 L454 479 C433 492 407 485 394 465 C385 450 383 424 389 407Z'},{group:'Glutes',d:'M465 418 C483 393 512 393 530 407 C536 424 534 450 525 465 C512 485 486 492 465 479Z'},
 {group:'Quadriceps',d:'M100 449 C126 430 155 445 164 484 C162 558 143 623 116 635 C94 592 86 513 100 449Z'},{group:'Quadriceps',d:'M202 484 C211 445 240 430 266 449 C280 513 272 592 250 635 C223 623 204 558 202 484Z'},
 {group:'Hamstrings',d:'M393 491 C412 485 438 500 449 533 C447 584 434 630 413 657 C398 636 390 594 389 550 C389 525 390 505 393 491Z'},{group:'Hamstrings',d:'M477 533 C488 500 514 485 533 491 C536 505 537 525 537 550 C536 594 528 636 513 657 C492 630 479 584 477 533Z'},
 {group:'Calves',d:'M94 648 C110 635 130 651 133 687 C131 729 119 762 105 772 C91 742 85 681 94 648Z'},{group:'Calves',d:'M221 687 C224 651 244 635 260 648 C269 681 263 742 249 772 C235 762 223 729 221 687Z'},
 {group:'Calves',d:'M401 658 C414 650 428 667 430 696 C428 729 418 758 406 772 C396 747 391 715 392 688 C393 674 396 664 401 658Z'},{group:'Calves',d:'M496 696 C498 667 512 650 525 658 C530 664 533 674 534 688 C535 715 530 747 520 772 C508 758 498 729 496 696Z'},
];
const feminineRegions:Region[]=[
 {group:'Upper Chest',d:'M84 218 C104 204 132 204 158 216 L159 237 C132 230 105 231 78 240 C79 230 81 222 84 218Z'},{group:'Upper Chest',d:'M166 216 C192 204 220 204 240 218 C243 222 245 230 246 240 C219 231 192 230 165 237Z'},
 {group:'Mid Chest',d:'M78 240 C105 231 132 230 159 237 L160 270 C132 264 104 266 77 274 C74 262 74 250 78 240Z'},{group:'Mid Chest',d:'M165 237 C192 230 219 231 246 240 C250 250 250 262 247 274 C220 266 192 264 164 270Z'},
 {group:'Lower Chest',d:'M77 274 C104 266 132 264 160 270 C153 291 138 302 118 302 C98 301 84 291 77 274Z'},{group:'Lower Chest',d:'M164 270 C192 264 220 266 247 274 C240 291 226 301 206 302 C186 302 171 291 164 270Z'},
 {group:'Side Delts',d:'M65 207 C55 217 55 239 63 257 C67 265 72 269 77 267 C74 247 76 226 83 212 C78 207 71 205 65 207Z'},{group:'Side Delts',d:'M241 212 C248 226 250 247 247 267 C252 269 257 265 261 257 C269 239 269 217 259 207 C253 205 246 207 241 212Z'},
 {group:'Front Delts',d:'M83 212 C90 222 91 241 86 255 C84 262 81 266 77 267 C74 247 76 226 83 212Z'},{group:'Front Delts',d:'M241 212 C234 222 233 241 238 255 C240 262 243 266 247 267 C250 247 248 226 241 212Z'},
 {group:'Rear Delts',d:'M335 208 C322 211 316 225 318 242 C320 256 327 265 337 265 C344 251 347 231 343 217 C341 212 338 209 335 208Z'},{group:'Rear Delts',d:'M505 208 C518 211 524 225 522 242 C520 256 513 265 503 265 C496 251 493 231 497 217 C499 212 502 209 505 208Z'},
 {group:'Traps',d:'M371 174 C383 188 401 199 418 207 L418 239 C399 228 381 214 367 198 C369 188 370 180 371 174Z'},{group:'Traps',d:'M422 207 C439 199 457 188 469 174 C470 180 471 188 473 198 C459 214 441 228 422 239Z'},
 {group:'Biceps',d:'M66 262 C58 282 58 316 66 342 C71 357 80 362 87 350 C96 326 98 288 89 267 C84 256 72 254 66 262Z'},{group:'Biceps',d:'M258 262 C266 282 266 316 258 342 C253 357 244 362 237 350 C228 326 226 288 235 267 C240 256 252 254 258 262Z'},
 {group:'Triceps',d:'M319 255 C311 275 312 309 320 340 C324 354 330 361 337 356 C346 334 350 298 344 270 C341 257 331 249 323 251 C321 252 320 253 319 255Z'},{group:'Triceps',d:'M521 255 C529 275 528 309 520 340 C516 354 510 361 503 356 C494 334 490 298 496 270 C499 257 509 249 517 251 C519 252 520 253 521 255Z'},
 {group:'Forearms',d:'M57 343 C46 361 37 389 30 421 C24 448 27 469 38 476 C49 465 58 438 65 406 C71 376 69 354 57 343Z'},{group:'Forearms',d:'M267 343 C278 361 287 389 294 421 C300 448 297 469 286 476 C275 465 266 438 259 406 C253 376 255 354 267 343Z'},{group:'Forearms',d:'M311 347 C304 367 301 395 303 423 C305 445 311 462 320 468 C327 454 330 430 328 403 C326 376 320 355 311 347Z'},{group:'Forearms',d:'M529 347 C536 367 539 395 537 423 C535 445 529 462 520 468 C513 454 510 430 512 403 C514 376 520 355 529 347Z'},
 {group:'Upper Back',d:'M349 241 C368 246 397 264 418 286 L418 345 C390 328 365 299 349 267 C345 257 345 248 349 241Z'},{group:'Upper Back',d:'M422 286 C443 264 472 246 491 241 C495 248 495 257 491 267 C475 299 450 328 422 345Z'},
 {group:'Lower Back',d:'M388 325 C398 338 409 349 418 355 L418 407 C402 394 390 365 388 325Z'},{group:'Lower Back',d:'M422 355 C431 349 442 338 452 325 C450 365 438 394 422 407Z'},
 {group:'Core',d:'M126 304 C143 298 156 306 161 326 L161 420 C143 405 130 374 123 334Z'},{group:'Core',d:'M165 326 C170 306 183 298 200 304 L203 334 C196 374 183 405 165 420Z'},
 {group:'Glutes',d:'M354 403 C376 387 403 393 418 420 L418 486 C394 501 366 489 355 465 C348 449 348 419 354 403Z'},{group:'Glutes',d:'M422 420 C437 393 464 387 486 403 C492 419 492 449 485 465 C474 489 446 501 422 486Z'},
 {group:'Quadriceps',d:'M88 458 C112 438 139 454 149 493 C147 566 131 626 108 640 C85 594 76 519 88 458Z'},{group:'Quadriceps',d:'M184 493 C194 454 221 438 245 458 C257 519 248 594 225 640 C202 626 186 566 184 493Z'},
 {group:'Hamstrings',d:'M358 494 C379 484 404 499 414 535 C412 589 398 636 378 663 C361 642 352 598 352 550 C352 527 354 507 358 494Z'},{group:'Hamstrings',d:'M426 535 C436 499 461 484 482 494 C486 507 488 527 488 550 C488 598 479 642 462 663 C442 636 428 589 426 535Z'},
 {group:'Calves',d:'M83 655 C98 641 116 655 120 691 C118 735 108 768 96 779 C82 746 75 690 83 655Z'},{group:'Calves',d:'M211 691 C215 655 233 641 248 655 C256 690 249 746 235 779 C223 768 213 735 211 691Z'},{group:'Calves',d:'M356 661 C370 650 385 666 388 698 C386 735 376 766 364 778 C353 754 347 718 349 689 C350 675 352 666 356 661Z'},{group:'Calves',d:'M452 698 C455 666 470 650 484 661 C488 666 490 675 491 689 C493 718 487 754 476 778 C464 766 454 735 452 698Z'},
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
    () => recovery.find((x) => x.state === "Recovering")?.group || "Mid Chest",
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
