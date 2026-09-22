"use client";
import {CoachLauncher} from './coach-launcher';
import {CoachConversation} from './coach-conversation';
import { useState } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { Data, uid } from "@/lib/training";
import { ProgressProposal, applyProgressProposal, planSchema } from "@/lib/plan";

import {coachingContext} from '@/lib/adaptive-coach';
import {goalProgress} from '@/lib/goals';
import {useCoachMemory} from '@/components/coach-memory';
import type {CoachingUpdates} from '@/lib/coaching-updates';
import {CoachSaveOffer} from '@/components/coach-save-offer';
import type {MuscleGroup} from '@/lib/muscle-recovery';
import {emptyNutrition,localDay} from '@/lib/nutrition';
import {bestKnownWeight,emptyActivityEnergy,estimateActivityCalories} from '@/lib/activity-energy';
type Message = { role: "user" | "assistant"; content: string };
type LogProposal={food:{name:string;date:string|null;calories:number|null;protein:number|null;carbs:number|null;fat:number|null}[];hydrationOz:number[];activities:{name:string;date:string|null;durationMinutes:number;intensity:'Light'|'Moderate'|'Vigorous';met:number;notes:string}[]};
const sameActivity=(a:ProgressProposal['activityTemplates'][number],b:NonNullable<Data['activityEnergy']>['templates'][number])=>a.name.trim().toLowerCase()===b.name.trim().toLowerCase()&&a.description===b.description&&a.durationMinutes===b.durationMinutes&&a.intensity===b.intensity&&a.met===b.met&&a.scheduleHint===b.scheduleHint;
export function ProgressCoach({
  data,
  area="progress",
  logsMode=false,
}: {
  data: Data;
  area?:string;
  logsMode?:boolean;
}) {
  const {messages,setMessages,setOffer,stage,applyNow}=useCoachMemory(area);
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [proposal, setProposal] = useState<ProgressProposal | null>(null),
    [logProposal,setLogProposal]=useState<LogProposal|null>(null),
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
    setLogProposal(null);
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
        body = await response.json() as {message:string;proposal:ProgressProposal|null;recovery?:{group:MuscleGroup}|null;logs?:LogProposal;saveUpdates?:CoachingUpdates;error?:string};
      if (!response.ok)
        throw new Error(body.error || "Your coach could not respond.");
      setMessages([...next, { role: "assistant", content: body.message }]);
      const parsedProposal=body.proposal?planSchema.shape.progress.parse(body.proposal):null;
      const nativeProposal=parsedProposal?{...parsedProposal,activityTemplates:parsedProposal.activityTemplates.filter(activity=>!(data.activityEnergy?.templates||[]).some(saved=>sameActivity(activity,saved)))}:null;
      const hasNativeProposal=!!nativeProposal&&(!!nativeProposal.goal||!!nativeProposal.nutrition||nativeProposal.activityTemplates.length>0);
      setProposal(hasNativeProposal?nativeProposal:null);
      setRecoveryProposal(body.recovery?.group||null);
      setLogProposal(body.logs&&(body.logs.food.length||body.logs.hydrationOz.length||body.logs.activities.length)?body.logs:null);
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
  if (!open)return <CoachLauncher hint={logsMode?"Log food, water, activity, or update your account with AI.":"Questions about progress, nutrition, or any activity you do."} hasMessages={messages.length>0} onOpen={()=>setOpen(true)}/>;
  return (
    <section className="panel progress-coach">
      <div className="section-head">
        <div>
          <h2>
            <Sparkles size={19} /> {logsMode?'Log with AI':'Your coach'}
          </h2>
          <p>
            {logsMode?'Describe food, water, activity, or an account update. Review every change before it is saved.':'Ask about progress, nutrition, or an activity you want to track. Your coach can create reusable activities too.'}
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
      {!messages.length&&<div className="coach-prompts">{(logsMode?["Log a meal with estimated macros","Log water or an activity","Update my weight or account details"]:["Create a reusable activity I can log","Review my progress and suggest my next goal"]).map(prompt=><button className="secondary" key={prompt} disabled={busy} onClick={()=>void send(prompt)}>{prompt}</button>)}</div>}
      <CoachConversation messages={messages} testWorkspace={data.user?.id==='test-user'}/>
      {proposal&&<div className="session-proposal"><h3>Proposed tracking changes</h3>{proposal.goal&&<p>Goal: {proposal.goal.title} · target {proposal.goal.target} {proposal.goal.unit}</p>}{proposal.nutrition&&<p>Daily targets: {proposal.nutrition.calorieTarget??'unchanged'} calories · {proposal.nutrition.proteinTarget??'unchanged'} g protein</p>}{proposal.activityTemplates.map(a=><p key={a.name}>Add activity: {a.name} · {a.durationMinutes} minutes · {a.intensity}</p>)}<button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{if(await applyNow('progress',applyProgressProposal(data,proposal),'Tracking changes')){setProposal(null);setMessages(old=>[...old,{role:'assistant',content:'Tracking changes saved. We can keep going here.'}])}else setError('Changes were not saved. Please retry.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Approve and save</button><button className="text-button" disabled={busy} onClick={()=>setProposal(null)}>Discard</button></div>}
      {recoveryProposal&&<div className="session-proposal"><h3>Ready to update recovery</h3><p>Mark <strong>{recoveryProposal}</strong> as recovering for the next 72 hours.</p><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const next={...data,recoveryOverrides:[...(data.recoveryOverrides||[]).filter(item=>item.group!==recoveryProposal),{group:recoveryProposal,reportedAt:new Date().toISOString()}]};if(await applyNow('progress',next,`Recovery map · ${recoveryProposal}`)){setRecoveryProposal(null);setMessages(old=>[...old,{role:'assistant',content:`${recoveryProposal} is marked as recovering for the next 72 hours.`}])}else setError('Recovery was not updated. Please retry.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Approve and update</button><button className="text-button" disabled={busy} onClick={()=>setRecoveryProposal(null)}>Discard</button></div>}
      {logProposal&&<div className="session-proposal"><h3>Ready to update your logs</h3><ul>{logProposal.food.map((x,i)=><li key={'food'+i}><b>{x.name}</b> · {x.calories??'—'} kcal · {x.protein??'—'} g protein{x.carbs!=null?` · ${x.carbs} g carbs`:''}{x.fat!=null?` · ${x.fat} g fat`:''}</li>)}{logProposal.hydrationOz.map((oz,i)=><li key={'water'+i}><b>Water</b> · {oz} fl oz</li>)}{logProposal.activities.map((x,i)=><li key={'activity'+i}><b>{x.name}</b> · {x.durationMinutes} min · {x.intensity}</li>)}</ul><div className="operation-actions"><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const today=localDay(),nutrition=data.nutrition||emptyNutrition(),hydration=nutrition.hydration||{dailyTargetOz:null,entries:[]},activity=data.activityEnergy||emptyActivityEnergy();const next:Data={...data,nutrition:{...nutrition,entries:[...nutrition.entries,...logProposal.food.map(x=>({...x,id:uid(),date:x.date&&x.date<=today?x.date:today}))],hydration:{...hydration,entries:[...hydration.entries,...logProposal.hydrationOz.map(ounces=>({id:uid(),date:today,ounces}))]}},activityEnergy:{...activity,logs:[...activity.logs,...logProposal.activities.map(x=>{const date=x.date&&x.date<=today?x.date:today,weight=bestKnownWeight(data,date);return{id:uid(),name:x.name,date,durationMinutes:x.durationMinutes,intensity:x.intensity,met:x.met,caloriesBurned:weight?estimateActivityCalories(weight,x.durationMinutes,x.met):0,calorieSource:'estimate' as const,energyWeightLb:weight,notes:x.notes}})]}};if(await applyNow('progress',next,'Food, hydration & activity logs')){setLogProposal(null);setMessages(old=>[...old,{role:'assistant',content:'Saved to your logs. We can keep going here.'}])}else setError('Those logs were not saved. Please retry.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Approve and save</button><button className="text-button" disabled={busy} onClick={()=>setLogProposal(null)}>Discard</button></div></div>}
      <CoachSaveOffer area={area}/>
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
          placeholder={logsMode?"For example: I drank 24 oz of water and walked briskly for 30 minutes.":"Ask about progress, nutrition, a sport, walk, class, or other activity…"}
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
