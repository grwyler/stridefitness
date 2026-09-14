"use client";
import {CoachLauncher} from './coach-launcher';
import {CoachConversation} from './coach-conversation';
import { useState } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { Data } from "@/lib/training";
import { ProgressProposal, applyProgressProposal } from "@/lib/plan";

import {coachingContext} from '@/lib/adaptive-coach';
import {goalProgress} from '@/lib/goals';
import {useCoachMemory} from '@/components/coach-memory';
import type {CoachingUpdates} from '@/lib/coaching-updates';
import {CoachSaveOffer} from '@/components/coach-save-offer';
type Message = { role: "user" | "assistant"; content: string };
export function ProgressCoach({
  data,
  onApply,
}: {
  data: Data;
  onApply: (data: Data) => void;
}) {
  const {messages,setMessages,setOffer}=useCoachMemory('progress');
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [proposal, setProposal] = useState<ProgressProposal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function send(prompt = input) {
    if (!prompt.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: prompt.trim() },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    setProposal(null);
    try {
      const response = await fetch("/api/progress-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-12),
            context: {
              performance: JSON.stringify({...coachingContext(data),goalProgress:(data.goals||[]).filter(g=>!g.archived).map(g=>({title:g.title,...goalProgress(g,data)}))}).slice(0,100000),
              goals: (data.goals || []).map((g) => ({
                title: g.title,
                kind: g.kind,
                target: g.target,
                unit: g.unit,
                deadline: g.deadline,
              })),
              nutrition: {
                calorieTarget: data.nutrition?.calorieTarget ?? null,
                proteinTarget: data.nutrition?.proteinTarget ?? null,
              },
              exercises: data.exercises.map((e) => ({
                id: e.id,
                name: e.name,
              })),
            },
          }),
        }),
        body = await response.json() as {message:string;proposal:ProgressProposal|null;saveUpdates?:CoachingUpdates;error?:string};
      if (!response.ok)
        throw new Error(body.error || "Your coach could not respond.");
      setMessages([...next, { role: "assistant", content: body.message }]);
      setProposal(null);setOffer(body.proposal?{profile:body.saveUpdates?.profile||[],goal:body.proposal.goal,nutrition:body.proposal.nutrition}:body.saveUpdates||null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your coach could not respond.",
      );
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!proposal) return;
    onApply(applyProgressProposal(data, proposal));
    setProposal(null);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content:
          "Saved. I’ll use these targets as context when helping with your training.",
      },
    ]);
  }
  if (!open)return <CoachLauncher hint="Questions about your progress, goals, or nutrition." hasMessages={messages.length>0} onOpen={()=>setOpen(true)}/>;
  return (
    <section className="panel progress-coach">
      <div className="section-head">
        <div>
          <h2>
            <Sparkles size={19} /> Your coach
          </h2>
          <p>
            Ask questions about your progress, goals, or nutrition. Your coach can help set targets too.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close progress coach"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
      </div>
      {!messages.length&&<div className="coach-prompts">{["Review my progress and suggest my next goal","Am I on track with my goals?"].map(prompt=><button className="secondary" key={prompt} disabled={busy} onClick={()=>void send(prompt)}>{prompt}</button>)}</div>}
      <CoachConversation messages={messages}/>
      <CoachSaveOffer area="progress"/>
      {proposal && (
        <div className="progress-proposal">
          <strong>Ready to add</strong>
          {proposal.goal && (
            <span>
              {proposal.goal.title} · Target {proposal.goal.target}{" "}
              {proposal.goal.unit}
            </span>
          )}
          {proposal.nutrition?.calorieTarget && (
            <span>{proposal.nutrition.calorieTarget} calories per day</span>
          )}
          {proposal.nutrition?.proteinTarget && (
            <span>{proposal.nutrition.proteinTarget} g protein per day</span>
          )}
          <button className="primary" onClick={apply}>
            <Check size={16} /> Apply targets
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="progress-coach-input">
          {messages.length
            ? "Reply to your coach"
            : "What would you like to change?"}
        </label>
        <textarea
          id="progress-coach-input"
          rows={2}
          value={input}
          maxLength={4000}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your progress, goals, or nutrition…"
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
