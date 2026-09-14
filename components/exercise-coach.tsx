"use client";
import { useState } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { Data, Exercise, uid } from "@/lib/training";

import {useCoachMemory} from '@/components/coach-memory';
import type {CoachingUpdates} from '@/lib/coaching-updates';
import {CoachSaveOffer} from '@/components/coach-save-offer';
type Message = { role: "user" | "assistant"; content: string };
type Proposal = Omit<Exercise, "id">;
export function ExerciseCoach({
  data,
  onCreate,
}: {
  data: Data;
  onCreate: (exercise: Exercise) => void;
}) {
  const {messages,setMessages,setOffer}=useCoachMemory('exercises');
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function send() {
    if (!input.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    setProposal(null);
    try {
      const response = await fetch("/api/exercise-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-12),
            exercises: data.exercises.map(({ name, category, mode }) => ({
              name,
              category,
              mode,
            })),
          }),
        }),
        body = await response.json() as {message:string;proposal:Proposal|null;saveUpdates?:CoachingUpdates;error?:string};
      if (!response.ok)
        throw new Error(body.error || "Your coach could not respond.");
      setMessages([...next, { role: "assistant", content: body.message }]);
      setProposal(body.proposal);setOffer(body.saveUpdates||null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your coach could not respond.",
      );
    } finally {
      setBusy(false);
    }
  }
  function create() {
    if (!proposal) return;
    if (
      data.exercises.some(
        (e) =>
          e.name.trim().toLowerCase() === proposal.name.trim().toLowerCase(),
      )
    ) {
      setError(`${proposal.name} is already in your exercise library.`);
      setProposal(null);
      return;
    }
    onCreate({ id: uid(), ...proposal });
    setProposal(null);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `${proposal.name} is now in your exercise library.`,
      },
    ]);
  }
  if (!open)
    return (
      <section className="panel progress-coach-intro">
        <div>
          <Sparkles size={20} />
          <span>
            <strong>Your coach</strong>
            <small>
              Create an exercise, find a substitute, or explain any movement.
            </small>
          </span>
        </div>
        <button className="secondary" onClick={() => setOpen(true)}>
        {messages.length?'Continue conversation':'Ask coach'} <ArrowRight size={16} />
        </button>
      </section>
    );
  return (
    <section className="panel progress-coach">
      <div className="section-head">
        <div>
          <h2>
            <Sparkles size={19} /> Your coach
          </h2>
          <p>Create an exercise, find a substitute, or learn how to perform any movement.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close exercise coach"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
      </div>
      {messages.length > 0 && (
        <div className="progress-coach-messages">
          {messages.map((m, i) => (
            <div className={"plan-message " + m.role} key={i}>
              <strong>{m.role === "user" ? "You" : "Stride"}</strong>
              <p>{m.content}</p>
            </div>
          ))}
        </div>
      )}
      <CoachSaveOffer area="exercises"/>
      {proposal && (
        <div className="progress-proposal">
          <strong>Ready to add</strong>
          <span>
            {proposal.name} · {proposal.category}
          </span>
          <span>
            {proposal.baseSets} × {proposal.baseReps}
            {proposal.baseWeight ? ` at ${proposal.baseWeight} lb` : ""} ·
            Progress by {proposal.mode}
          </span>
          <button className="primary" onClick={create}>
            <Check size={16} /> Add exercise
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="exercise-coach-input">
          {messages.length
            ? "Reply to your coach"
            : "What would you like to do?"}
        </label>
        <textarea
          id="exercise-coach-input"
          rows={2}
          value={input}
          maxLength={4000}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder="For example: I only have resistance bands. What can replace a cable row?"
        />
        <button className="primary" disabled={busy || !input.trim()}>
          {busy ? (
            <Loader2 className="plan-spin" size={17} />
          ) : (
            <Send size={17} />
          )}{" "}
          Send
        </button>
        {error && (
          <p className="plan-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
