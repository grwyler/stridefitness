"use client";
import {CoachLauncher} from './coach-launcher';
import {CoachConversation} from './coach-conversation';
import { useState } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { Data } from "@/lib/training";
import { ProgressProposal, applyProgressProposal, planSchema } from "@/lib/plan";

import {coachingContext} from '@/lib/adaptive-coach';
import {goalProgress} from '@/lib/goals';
import {useCoachMemory} from '@/components/coach-memory';
import type {CoachingUpdates} from '@/lib/coaching-updates';
import {CoachSaveOffer} from '@/components/coach-save-offer';
import type {MuscleGroup} from '@/lib/muscle-recovery';
type Message = { role: "user" | "assistant"; content: string };
const sameActivity=(a:ProgressProposal['activityTemplates'][number],b:NonNullable<Data['activityEnergy']>['templates'][number])=>a.name.trim().toLowerCase()===b.name.trim().toLowerCase()&&a.description===b.description&&a.durationMinutes===b.durationMinutes&&a.intensity===b.intensity&&a.met===b.met&&a.scheduleHint===b.scheduleHint;
export function ProgressCoach({
  data,
}: {
  data: Data;
}) {
  const {messages,setMessages,setOffer,stage,applyNow}=useCoachMemory('progress');
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [proposal, setProposal] = useState<ProgressProposal | null>(null),
    [recoveryProposal, setRecoveryProposal] = useState<MuscleGroup | null>(null),
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
    setRecoveryProposal(null);
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
                activityCalorieAdjustment: data.nutrition?.activityCalorieAdjustment ?? 0,
              },
              exercises: data.exercises.map((e) => ({
                id: e.id,
                name: e.name,
              })),
              activityTemplates: (data.activityEnergy?.templates||[]).map(({id,...template})=>template),
            },
          }),
        }),
        body = await response.json() as {message:string;proposal:ProgressProposal|null;recovery?:{group:MuscleGroup}|null;saveUpdates?:CoachingUpdates;error?:string};
      if (!response.ok)
        throw new Error(body.error || "Your coach could not respond.");
      setMessages([...next, { role: "assistant", content: body.message }]);
      const parsedProposal=body.proposal?planSchema.shape.progress.parse(body.proposal):null;
      const nativeProposal=parsedProposal?{...parsedProposal,activityTemplates:parsedProposal.activityTemplates.filter(activity=>!(data.activityEnergy?.templates||[]).some(saved=>sameActivity(activity,saved)))}:null;
      const hasNativeProposal=!!nativeProposal&&(!!nativeProposal.goal||!!nativeProposal.nutrition||nativeProposal.activityTemplates.length>0);
      setProposal(hasNativeProposal?nativeProposal:null);
      setRecoveryProposal(body.recovery?.group||null);
      const profile=(body.saveUpdates?.profile||[]).filter(update=>update.value.trim());
      const separateOffer=body.saveUpdates?{...body.saveUpdates,profile,...(nativeProposal?.goal?{goal:null}:{}),...(nativeProposal?.nutrition?{nutrition:null}:{})}:null;
      setOffer(separateOffer&&(profile.length||separateOffer.goal||separateOffer.nutrition||separateOffer.measurement)?separateOffer:null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your coach could not respond.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!open)return <CoachLauncher hint="Questions about progress, nutrition, or any activity you do." hasMessages={messages.length>0} onOpen={()=>setOpen(true)}/>;
  return (
    <section className="panel progress-coach">
      <div className="section-head">
        <div>
          <h2>
            <Sparkles size={19} /> Your coach
          </h2>
          <p>
            Ask about progress, nutrition, or an activity you want to track. Your coach can create reusable activities too.
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
      {!messages.length&&<div className="coach-prompts">{["Create a reusable activity I can log","Review my progress and suggest my next goal"].map(prompt=><button className="secondary" key={prompt} disabled={busy} onClick={()=>void send(prompt)}>{prompt}</button>)}</div>}
      <CoachConversation messages={messages} testWorkspace={data.user?.id==='test-user'}/>
      {proposal&&<div className="session-proposal"><h3>Proposed tracking changes</h3>{proposal.goal&&<p>Goal: {proposal.goal.title} · target {proposal.goal.target} {proposal.goal.unit}</p>}{proposal.nutrition&&<p>Daily targets: {proposal.nutrition.calorieTarget??'unchanged'} calories · {proposal.nutrition.proteinTarget??'unchanged'} g protein</p>}{proposal.activityTemplates.map(a=><p key={a.name}>Add activity: {a.name} · {a.durationMinutes} minutes · {a.intensity}</p>)}<button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{if(await applyNow('progress',applyProgressProposal(data,proposal),'Tracking changes')){setProposal(null);setMessages(old=>[...old,{role:'assistant',content:'Tracking changes saved. We can keep going here.'}])}else setError('Changes were not saved. Please retry.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Approve and save</button><button className="text-button" disabled={busy} onClick={()=>setProposal(null)}>Discard</button></div>}
      {recoveryProposal&&<div className="session-proposal"><h3>Ready to update recovery</h3><p>Mark <strong>{recoveryProposal}</strong> as recovering for the next 72 hours.</p><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const next={...data,recoveryOverrides:[...(data.recoveryOverrides||[]).filter(item=>item.group!==recoveryProposal),{group:recoveryProposal,reportedAt:new Date().toISOString()}]};if(await applyNow('progress',next,`Recovery map · ${recoveryProposal}`)){setRecoveryProposal(null);setMessages(old=>[...old,{role:'assistant',content:`${recoveryProposal} is marked as recovering for the next 72 hours.`}])}else setError('Recovery was not updated. Please retry.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Approve and update</button><button className="text-button" disabled={busy} onClick={()=>setRecoveryProposal(null)}>Discard</button></div>}
      <CoachSaveOffer area="progress"/>
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
          placeholder="Ask about progress, nutrition, a sport, walk, class, or other activity…"
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
