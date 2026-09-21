import {z} from 'zod';
import type {Data,SetLog,Target,Workout} from './training';
import {adaptiveTarget} from './adaptive-coach';
import {dailyGoalHistory,goalProgress} from './goals';
import {isDayComplete} from './day-completion';
import {tracked} from './day-tracking';
import type {Operation,Receipt} from './account-operations';

export const targetSchema=z.object({weight:z.number().finite().min(0).max(2000),reps:z.number().int().min(1).max(100),sets:z.number().int().min(1).max(20)});
export type ReviewEvidence={key:string;kind:'workout'|'activity'|'measurement'|'nutrition'|'goal';recordId:string;date:string;title:string;detail:string};
export type Recommendation={key:string;kind:'collect'|'continue'|'hold'|'increase'|'reduce';text:string;why:string;evidenceKeys:string[];priority:number;exerciseId?:string;target?:Target;goal?:{title:string;target:number;start:number;unit:string;exerciseId:string;deadline:string}};
export type PriorOutcome={reviewId:string;recommendation:string;applied:boolean;status:'waiting'|'met'|'missed'|'mixed'|'different'|'unmeasurable';detail:string;evidence:ReviewEvidence[]};
export type WeeklyReview={basis?:string;trigger?:string;viewedAt?:string;proposedAt?:string;feedbackAt?:string;appliedAt?:string;outcome?:PriorOutcome;evaluatedAt?:string;lifecycle?:'ready'|'viewed'|'proposed'|'applied'|'dismissed'|'waiting'|'evaluated';id:string;createdAt:string;day:string;start:string;revision:string|null;summary:string;standout:string;coverage:string[];observations:string[];keepDoing:string|null;evidence:ReviewEvidence[];recommendation:Recommendation;prior:PriorOutcome[];selection:'rules'|'ai';feedback:'open'|'not_now'|'does_not_fit';prepared?:{operation:Operation;target:Target};receipt?:Receipt};
export type PriorReview={review:WeeklyReview;receipt?:Receipt};
const DAY=86400000;
const dayOf=(s:string)=>s.slice(0,10);
export const shiftDay=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
export const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&dayOf(new Date(day+'T12:00:00Z').toISOString())===day;
const attempted=(s:SetLog)=>s.status==='completed'||s.status==='modified'||s.status==='failed';
const met=(s:SetLog)=>s.status==='completed'&&s.weight>=s.targetWeight&&s.reps>=s.targetReps&&s.reps>0;
const hard=(s:SetLog)=>['Hard','Very Hard','Failed'].includes(s.difficulty);
const targetText=(t:Target)=>`${t.sets} × ${t.reps}${t.weight>0?` at ${t.weight} lb`:''}`;
function workoutEvidence(w:Workout,d:Data,exerciseId?:string):ReviewEvidence{
 const entries=w.entries.filter(e=>!exerciseId||e.exerciseId===exerciseId);
 return {key:'workout:'+w.id+(exerciseId?':'+exerciseId:''),recordId:w.id,kind:'workout',date:dayOf(w.date),title:w.name,detail:entries.map(e=>`${d.exercises.find(x=>x.id===e.exerciseId)?.name||'Exercise'}: ${e.sets.map(s=>`${s.weight} lb × ${s.reps} (${s.status}; ${s.difficulty}; target ${s.targetWeight} × ${s.targetReps})`).join('; ')}`).join('\n')+`\nSession effort: ${w.difficulty}`};
}
export function evaluatePrior(d:Data,prior:PriorReview,day:string):PriorOutcome{
 const r=prior.review,rec=r.recommendation,target=r.prepared?.target||rec.target,applied=!!prior.receipt;
 const result:PriorOutcome={reviewId:r.id,recommendation:rec.text,applied,status:'waiting',detail:'No subsequent comparable workout has been recorded yet.',evidence:[]};
 if(!target||!rec.exerciseId)return {...result,status:'unmeasurable',detail:'This was a focus or no-change recommendation. Saved records cannot confirm whether advice was followed.'};
 const cutoff=prior.receipt?.committedAt||r.createdAt;
 // Date-only history on the recommendation day has no ordering proof.
 const sessions=d.workouts.filter(w=>w.completed&&dayOf(w.date)<=day&&(w.date.includes('T')?Date.parse(w.date)>Date.parse(cutoff):dayOf(w.date)>dayOf(cutoff))&&w.entries.some(e=>e.exerciseId===rec.exerciseId)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
 if(!sessions.length)return result;
 const matching=sessions.filter(w=>{const sets=w.entries.find(e=>e.exerciseId===rec.exerciseId)!.sets;return sets.length===target.sets&&sets.every(s=>s.targetWeight===target.weight&&s.targetReps===target.reps)});
 result.evidence=sessions.map(w=>workoutEvidence(w,d,rec.exerciseId));
 if(!matching.length)return {...result,status:'different',detail:`${applied?'The change was saved, but':'No confirmed application was found, and'} subsequent recorded targets differ. Outcome is not comparable.`};
 const success=matching.filter(w=>w.entries.find(e=>e.exerciseId===rec.exerciseId)!.sets.every(met));
 const failures=matching.filter(w=>w.entries.find(e=>e.exerciseId===rec.exerciseId)!.sets.some(s=>s.status==='failed'||attempted(s)&&(s.weight<target.weight||s.reps<target.reps)));
 if(success.length&&success.length<matching.length)return {...result,status:'mixed',detail:`After the recommendation, ${success.length} of ${matching.length} comparable recorded sessions met every target; other sets were missed, modified, skipped, or unfinished. The available result is mixed and does not justify assuming the adjustment worked.`};
 if(failures.length)return {...result,status:'missed',detail:`${failures.length} of ${matching.length} subsequent matching recorded sessions did not meet every target. ${applied?'Application was confirmed.':'Matching records are evidence of performance, not proof that this advice was followed.'}`};
 if(success.length)return {...result,status:'met',detail:`The target was met in ${success.length} subsequent matching recorded session${success.length===1?'':'s'}. ${applied?'Application was confirmed.':'There is no confirmed application; this does not establish that the advice caused the result.'}`};
 return {...result,detail:'Matching targets were recorded, but modified, skipped, or unfinished sets prevent a complete outcome assessment.'};
}
export function analyzeWeek(d:Data,day:string,priorReviews:PriorReview[]=[]){
 if(!validDay(day))throw new Error('Choose a valid review date.');
 const start=shiftDay(day,-6),comparisonStart=shiftDay(start,-21);
 const within=(date:string)=>dayOf(date)>=start&&dayOf(date)<=day;
 const all=d.workouts.filter(w=>w.completed&&dayOf(w.date)>=comparisonStart&&dayOf(w.date)<=day).sort((a,b)=>b.date.localeCompare(a.date));
 const recent=all.filter(w=>within(w.date)),sets=recent.flatMap(w=>w.entries.flatMap(e=>e.sets));
 const count=(status:SetLog['status'])=>sets.filter(s=>s.status===status).length;
 const logs=(d.activityEnergy?.logs||[]).filter(l=>within(l.date));
 const olderLogs=(d.activityEnergy?.logs||[]).filter(l=>l.date>=comparisonStart&&l.date<start);
 const high=logs.filter(l=>l.intensity==='Vigorous'),olderHigh=olderLogs.filter(l=>l.intensity==='Vigorous');
 const highMinutes=high.reduce((n,l)=>n+l.durationMinutes,0),baseline=olderHigh.reduce((n,l)=>n+l.durationMinutes,0)/3;
 const unusual=olderHigh.length>=3&&high.length>=2&&highMinutes>baseline*1.5;
 const evidence:ReviewEvidence[]=[],coverage:string[]=[],observations:string[]=[];
 const add=(e:ReviewEvidence)=>{if(!evidence.some(x=>x.key===e.key))evidence.push(e);return e.key};
 const completeDays=Array.from({length:7},(_,index)=>shiftDay(day,-index)).filter(date=>isDayComplete(d.dayCompletions,date));
 const summary=`You logged ${recent.length} completed strength workout${recent.length===1?'':'s'} and ${logs.length} other activit${logs.length===1?'y':'ies'} in these seven days. ${completeDays.length} day${completeDays.length===1?' was':'s were'} confirmed complete. Strength sets: ${count('completed')} completed, ${count('modified')} modified, ${count('failed')} failed, ${count('skipped')} skipped${count('pending')?`, ${count('pending')} still unfinished`:''}.`;
 coverage.push(recent.length?'These are recorded sessions; missing workouts cannot be distinguished from rest days.':'No completed strength workouts were recorded this week. That does not establish that you did no training.');
 coverage.push(logs.length?`${logs.length} activities were logged. Logging completeness is unknown, so a decline in recorded minutes is not treated as a decline in actual activity.`:'No other activity was recorded. Unlogged activity and no activity cannot be distinguished.');
 if(tracked(d.dayTracking,'nutrition')||tracked(d.dayTracking,'activity'))coverage.push(completeDays.length?`${completeDays.length}/7 days were marked complete; zero logged calories or activity is confirmed as none for selected daily tracking.`:'No selected daily tracking days were confirmed, so missing values remain unknown.');
 const food=(d.nutrition?.entries||[]).filter(f=>within(f.date)),foodDays=[...new Set(food.map(f=>f.date))];
 const totals=foodDays.filter(date=>isDayComplete(d.dayCompletions,date));
 if(tracked(d.dayTracking,'nutrition')){if(totals.length>=5){observations.push(`${totals.length} days were marked complete: average ${Math.round(food.filter(f=>totals.includes(f.date)).reduce((n,f)=>n+(f.calories||0),0)/totals.length)} kcal and ${Math.round(food.filter(f=>totals.includes(f.date)).reduce((n,f)=>n+(f.protein||0),0)/totals.length)} g protein logged. This is reported intake, not evidence of an energy deficit or surplus.`);coverage.push(`Nutrition: ${totals.length}/7 days were confirmed complete. Other days are missing or partial.`)}
 else coverage.push(`Nutrition: entries on ${foodDays.length}/7 days, ${totals.length} confirmed complete days. There isn't enough confirmed full-day logging to judge weekly intake; a meal is not a day's diet.`)}
 food.filter(f=>totals.includes(f.date)).slice(-7).forEach(f=>add({key:'nutrition:'+f.id,kind:'nutrition',recordId:f.id,date:f.date,title:'Logged daily total',detail:`${f.calories} kcal; ${f.protein} g protein. User-entered total.`}));
 for(const metric of ['weight','bodyFat'] as const){
  // Existing accounts may already have useful measurement history. Preserve
  // that insight, but only an explicit tracking plan can ask for more data.
  if(d.dayTracking!==undefined&&!tracked(d.dayTracking,metric))continue;
  const points=(d.bodyMeasurements||[]).filter(m=>m.date>=comparisonStart&&m.date<=day&&m[metric]!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const unique=[...new Map(points.map(m=>[m.date,m])).values()];
  if(unique.length>=4&&Date.parse(unique.at(-1)!.date)-Date.parse(unique[0].date)>=7*DAY&&within(unique.at(-1)!.date)){
   const selected=unique.slice(-4);observations.push(`Last four recorded ${metric==='weight'?'bodyweights':'body-fat estimates'}: ${selected.map(m=>`${m[metric]}${metric==='weight'?' lb':'%'} (${m.date})`).join(', ')}. These show recorded variation, not a diagnosis or proof of tissue change.`);
   selected.forEach(m=>add({key:'measurement:'+m.id,kind:'measurement',recordId:m.id,date:m.date,title:'Body check-in',detail:`Weight: ${m.weight??'not logged'}${m.weight!==null?' lb':''}; body fat: ${m.bodyFat??'not logged'}${m.bodyFat!==null?'%':''}.`}));
  }else if(d.dayTracking!==undefined&&tracked(d.dayTracking,metric))coverage.push(`${metric==='weight'?'Bodyweight':'Body fat'}: not enough recent, spaced measurements to describe a trend (need four dates spanning at least a week, including a recent entry).`);
 }
 const bounded={...d,workouts:d.workouts.filter(w=>dayOf(w.date)<=day),bodyMeasurements:(d.bodyMeasurements||[]).filter(entry=>entry.date<=day)};
 const goals=(d.goals||[]).filter(g=>!g.archived).slice(0,5);
 for(const g of goals){
  if(g.kind==='daily'){
   const history=dailyGoalHistory(g,bounded,day),metDays=history.filter(row=>row.met).length,loggedDays=history.filter(row=>row.logged).length,average=loggedDays?Math.round(history.reduce((sum,row)=>sum+row.value,0)/loggedDays):0;
   const text=`${g.title}: met on ${metDays} of ${history.length} eligible days; ${loggedDays} days had a recorded value${loggedDays?`; recorded-day average ${average} ${g.unit}`:''}.`;
   observations.push(text);add({key:'goal:'+g.id,kind:'goal',recordId:g.id,date:g.started,title:g.title,detail:text+' Missing logs are not assumed to be missed behavior.'});
   if(g.dailyMetric==='hydration')for(const entry of d.nutrition?.hydration?.entries||[])if(within(entry.date))add({key:'nutrition:hydration:'+entry.id,kind:'nutrition',recordId:entry.id,date:entry.date,title:'Hydration log',detail:`${entry.ounces} fl oz recorded.`});
   if(g.dailyMetric==='activeCalories'){for(const log of logs)add({key:'activity:'+log.id,kind:'activity',recordId:log.id,date:log.date,title:log.name,detail:`${log.durationMinutes} minutes; ${log.caloriesBurned} activity kcal recorded.`});for(const workout of recent.filter(item=>item.caloriesBurned))add(workoutEvidence(workout,d));}
   if(g.dailyMetric==='protein'||g.dailyMetric==='calorieIntake')for(const entry of food)add({key:'nutrition:'+entry.id,kind:'nutrition',recordId:entry.id,date:entry.date,title:entry.name,detail:`${entry.calories??'unknown'} kcal; ${entry.protein??'unknown'} g protein.`});
   continue;
  }
  const progress=goalProgress({...g,checks:g.checks.filter(c=>c.date<=day)},bounded,day),text=`${g.title}: ${progress.current} ${g.unit} recorded toward ${g.target}${g.deadline?`; target date ${g.deadline}`:''}.`;
  observations.push(text);add({key:'goal:'+g.id,kind:'goal',recordId:g.id,date:g.started,title:g.title,detail:text+' This describes saved progress, not a prediction.'});}
 const prior=priorReviews.slice(0,5).map(p=>evaluatePrior(d,p,day));
 const candidates:Recommendation[]=[];
 for(const goal of goals.filter(goal=>goal.kind==='daily')){
  const history=dailyGoalHistory(goal,bounded,day),logged=history.filter(row=>row.logged),metDays=history.filter(row=>row.met),evidenceKey='goal:'+goal.id;
  if(logged.length<3)candidates.push({key:'daily:'+goal.id,kind:'collect',priority:55,text:`Keep logging ${goal.title.toLowerCase()} so Stride can evaluate the daily target.`,why:`Only ${logged.length} of ${history.length} eligible days contain a recorded value. Missing logs cannot be treated as missed goals.`,evidenceKeys:[evidenceKey]});
  else if(metDays.length>=Math.ceil(history.length*.7))candidates.push({key:'daily:'+goal.id,kind:'continue',priority:45,text:`Keep your ${goal.target} ${goal.unit} ${goal.title.toLowerCase()} target.`,why:`The saved logs meet this daily goal on ${metDays.length} of ${history.length} eligible days.`,evidenceKeys:[evidenceKey]});
  else {const action=goal.dailyMetric==='hydration'?'Try adding one planned water check-in earlier in the day.':goal.dailyMetric==='activeCalories'?'Plan a realistic activity block on a day that usually falls short.':goal.dailyMetric==='protein'?'Plan one repeatable protein serving earlier in the day.':'Compare the target with complete food-log days before changing it.';candidates.push({key:'daily:'+goal.id,kind:'hold',priority:85,text:`Your ${goal.title.toLowerCase()} goal needs attention. ${action}`,why:`The target was met on ${metDays.length} of ${history.length} eligible days with recorded values on ${logged.length} days. Keep the target for another week unless it no longer fits your situation.`,evidenceKeys:[evidenceKey]});}
 }
 for(const ex of d.exercises){
  const sessions=all.filter(w=>w.entries.some(e=>e.exerciseId===ex.id));if(!sessions.length||!within(sessions[0].date))continue;
  const last=sessions.slice(0,3),entrySets=(w:Workout)=>w.entries.find(e=>e.exerciseId===ex.id)!.sets;
  const usable=last.filter(w=>entrySets(w).some(attempted));if(usable.length<2)continue;
  const ref=entrySets(usable[0]),attempts=ref.filter(attempted),best=attempts.filter(s=>s.status==='completed'||s.status==='modified').sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0]||attempts[0];if(!best)continue;
  const repeated=usable.slice(0,2).every(w=>entrySets(w).some(s=>s.status==='failed'||s.difficulty==='Failed'));
  const clean=usable.slice(0,2).every(w=>entrySets(w).length>0&&entrySets(w).every(s=>met(s)&&!hard(s))&&!['Hard','Very Hard','Failed'].includes(w.difficulty));
  const failedPrior=prior.some(p=>p.status==='missed'&&priorReviews.find(x=>x.review.id===p.reviewId)?.review.recommendation.exerciseId===ex.id);
  const nearHigh=high.filter(l=>usable.some(w=>Math.abs(Date.parse(dayOf(w.date)+'T12:00:00Z')-Date.parse(l.date+'T12:00:00Z'))<=2*DAY));
  const conflict=clean&&nearHigh.length>=2;
  const current={weight:best.weight,reps:Math.max(1,best.reps),sets:Math.max(1,Math.min(20,ref.length))};
  // Reuse established progression, but require repeated evidence and exclude overrides from its inference.
  const adaptive=adaptiveTarget({...bounded,overrides:{}},ex);
  const reduceTarget=current.sets>1?{...current,sets:current.sets-1}:{...current,weight:Math.max(0,current.weight-(ex.increment||5)),reps:Math.max(1,Math.min(current.reps,adaptive.reps))};
  const kind:Recommendation['kind']=repeated?'reduce':conflict||failedPrior||!clean?'hold':adaptive.kind==='Increase'?'increase':'hold';
  const target=kind==='reduce'?reduceTarget:kind==='increase'?{weight:adaptive.weight,reps:adaptive.reps,sets:adaptive.sets}:current;
  const evidenceKeys=usable.map(w=>add(workoutEvidence(w,d,ex.id)));
  if(conflict||unusual)nearHigh.forEach(l=>evidenceKeys.push(add({key:'activity:'+l.id,kind:'activity',recordId:l.id,date:l.date,title:l.name,detail:`${l.durationMinutes} minutes, ${l.intensity} effort recorded. Date proximity alone does not show cause.`})));
  const why=repeated?'The last two recorded sessions include failed sets. A smaller amount of unfinished work is more conservative than another progression.':conflict?'Strength results support progressing, but at least two vigorous activities were logged within two calendar days of these sessions. Holding once acknowledges those conflicting signals without estimating fatigue.':failedPrior?'A previous recommended target was not fully met in subsequent matching records. Hold and reassess rather than automatically increasing again.':clean?'Targets were met without high recorded effort in at least two recent sessions. The existing progression guidance supports one small next step.':'Recent records include demanding, modified, missed, or skipped work. Confirm a controlled target before adding more.';
  candidates.push({key:ex.id,kind,priority:repeated?100:conflict?90:failedPrior?95:clean?60:70,exerciseId:ex.id,target,text:`${kind==='reduce'?'Try a lighter-volume session for':kind==='increase'?'Progress': 'Hold'} ${ex.name}: ${targetText(target)} next time.`,why,evidenceKeys});
 }
 for(const goal of goals.filter(goal=>goal.kind==='strength'&&goal.exerciseId)){
  const progress=goalProgress({...goal,checks:goal.checks.filter(check=>check.date<=day)},bounded);
  if(!progress.reached||goals.some(other=>other.id!==goal.id&&other.kind==='strength'&&other.exerciseId===goal.exerciseId&&other.target>goal.target))continue;
  const exercise=d.exercises.find(exercise=>exercise.id===goal.exerciseId);if(!exercise)continue;
  const nextTarget=Math.max(goal.target+(exercise.increment||5),Math.ceil((progress.current+(exercise.increment||5))/5)*5);
  const nextWorkoutTarget=adaptiveTarget({...bounded,overrides:{}},exercise);
  const evidenceKey=add({key:'goal:'+goal.id,kind:'goal',recordId:goal.id,date:goal.started,title:goal.title,detail:`${goal.title}: ${progress.current} ${goal.unit} recorded toward ${goal.target}. Goal reached; recommend the next target at ${nextTarget} ${goal.unit}.`});
  candidates.push({key:'goal:'+goal.id,kind:'continue',priority:110,exerciseId:exercise.id,target:{weight:nextWorkoutTarget.weight,reps:nextWorkoutTarget.reps,sets:nextWorkoutTarget.sets},text:`Goal achieved: set your next ${exercise.name} goal at ${nextTarget} ${goal.unit} and use ${targetText(nextWorkoutTarget)} next time.`,why:`Your recorded ${exercise.name} estimate is ${progress.current} ${goal.unit}, above the ${goal.target} ${goal.unit} goal. This proposes a higher goal and the next working target for that lift.`,evidenceKeys:[evidenceKey],goal:{title:`${exercise.name} strength`,start:progress.current,target:nextTarget,unit:goal.unit,exerciseId:exercise.id,deadline:goal.deadline}});
 }
 if(unusual)observations.unshift(`You logged ${highMinutes} vigorous-activity minutes this week versus ${Math.round(baseline)} per week across the preceding three weeks. That is more recorded activity, not a measured fatigue score.`);
 if(!candidates.length)candidates.push({key:'focus',kind:recent.length<2?'collect':'continue',priority:0,text:recent.length<2?'Complete another 1–2 workouts before changing your targets.':'Keep your current plan and record another comparable session.',why:recent.length<2?'There are not enough recent completed sessions to compare performance reliably. Missing records do not justify increasing or reducing training.':'No repeated exercise pattern justifies a specific adjustment from the records available.',evidenceKeys:recent.slice(0,3).map(w=>add(workoutEvidence(w,d)))});
 candidates.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));
 const selected=candidates[0];
 return {start,summary,coverage,observations,evidence,candidates,prior,standout:selected.kind==='collect'?'The useful next step is better comparison data.':selected.kind==='reduce'?'Repeated failed sets stand out more than a single difficult workout.':selected.kind==='increase'?'Repeated target completion supports a small progression.':selected.kind==='hold'?'The recorded pattern supports confirming your target before progressing.':'No repeated pattern calls for a change.',keepDoing:sets.some(met)?'Keep recording actual reps, load, effort, and unsuccessful sets; they make the next recommendation more useful.':null};
}

// Only evidence the review can interpret participates in its cache identity.
// Calendar passage, chat, profile, open sessions, overrides and partial meals do not.
export function reviewBasis(data:Data,day:string){
 const food=data.nutrition?.entries||[],latestFood=food.filter(f=>f.date<=day).map(f=>f.date).sort().at(-1);
 const analysis=analyzeWeek(data,latestFood||day);
 const sorted=<T extends {id:string}>(rows:T[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
 const completed=sorted(data.workouts.filter(w=>w.completed&&dayOf(w.date)<=day));
 const relevantExercises=data.exercises.filter(e=>completed.some(w=>w.entries.some(x=>x.exerciseId===e.id)));
 const useful=new Set(analysis.evidence.filter(e=>e.kind==='measurement'||e.kind==='nutrition').map(e=>e.recordId));
 const hasDaily=(metric:string)=>(data.goals||[]).some(goal=>!goal.archived&&goal.kind==='daily'&&goal.dailyMetric===metric);
 return JSON.stringify({goalProposalVersion:4,dayTracking:data.dayTracking,workouts:completed,exercises:sorted(relevantExercises),activities:sorted((data.activityEnergy?.logs||[]).filter(l=>l.date<=day&&(l.intensity==='Vigorous'||hasDaily('activeCalories')))),goals:sorted((data.goals||[]).filter(g=>!g.archived)),measurements:(data.bodyMeasurements||[]).length>=4?sorted((data.bodyMeasurements||[]).filter(m=>m.date<=day)):[],nutrition:sorted((data.nutrition?.entries||[]).filter(e=>useful.has(e.id)||hasDaily('protein')||hasDaily('calorieIntake'))),hydration:hasDaily('hydration')?sorted((data.nutrition?.hydration?.entries||[]).filter(entry=>entry.date<=day)):[],dayCompletions:(data.dayCompletions||[]).filter(row=>row.date<=day)});
}
export function reviewState(review:WeeklyReview):NonNullable<WeeklyReview['lifecycle']>{
 if(review.outcome&&['met','missed','mixed'].includes(review.outcome.status))return 'evaluated';
 if(review.receipt)return review.outcome?.status==='waiting'||review.outcome?.status==='different'?'waiting':'applied';
 if(review.appliedAt)return 'applied';
 if(review.feedback!=='open')return 'dismissed';
 if(review.prepared)return 'proposed';
 return review.viewedAt?'viewed':'ready';
}
export function overviewReview(review:WeeklyReview){
 const state=reviewState(review),rec=review.recommendation;
 if(state==='evaluated')return {title:review.outcome?.status==='met'?'Your recorded follow-up supports the target':'Your follow-up needs another look',text:review.outcome!.detail};
 if(state==='waiting'||state==='applied')return {title:'Review complete',text:`${rec.text} We’ll evaluate the result after a comparable recorded session.`};
 if(state==='dismissed')return {title:'Review set aside',text:'Your choice is kept. Stride will revisit this focus only when new evidence is available.'};
 if(rec.kind==='collect')return {title:'Keep logging',text:rec.text};
 if(rec.kind==='continue')return {title:"You’re on track",text:rec.text};
 return {title:state==='proposed'?'Recommendation ready to apply':'Your weekly review is ready',text:rec.text};
}
