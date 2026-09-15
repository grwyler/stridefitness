"use client";
import {CoachLauncher} from './coach-launcher';
import {CoachConversation} from './coach-conversation';
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
}: {
  data: Data;
}) {
  const {messages,setMessages,setOffer,stage}=useCoachMemory('exercises');
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
      if(body.proposal){if(data.exercises.some(e=>e.name.trim().toLowerCase()===body.proposal!.name.trim().toLowerCase()))throw new Error('This exercise is already in your library.');stage('exercise',data,{...data,exercises:[...data.exercises,{...body.proposal,id:uid()}]},'Add exercise · '+body.proposal.name)}setOffer(body.saveUpdates||null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your coach could not respond.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!open)return <CoachLauncher hint="Exercise advice, alternatives, or help adding a movement." hasMessages={messages.length>0} onOpen={()=>setOpen(true)}/>;
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
      <CoachConversation messages={messages} testWorkspace={data.user?.id==='test-user'}/>
      <CoachSaveOffer area="exercises"/>
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
