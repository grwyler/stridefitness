import type {Exercise,Template} from '@/lib/training';
import {exerciseMuscles,type MuscleRecovery,type RecoveryState} from '@/lib/muscle-recovery';

type ExerciseReadiness={exercise:Exercise;score:number|null;state:RecoveryState};

const stateScore:Record<RecoveryState,number|null>={Recovering:0,'Nearly recovered':65,'Likely ready':100,Unknown:null};

function exerciseReadiness(exercise:Exercise,recovery:MuscleRecovery[]):ExerciseReadiness{
 const muscles=exerciseMuscles(exercise),weighted=[...muscles.primary.flatMap(group=>[group,group]),...muscles.secondary];
 const states=weighted.map(group=>recovery.find(item=>item.group===group)?.state||'Unknown'),known=states.filter(state=>state!=='Unknown');
 const score=known.length?Math.round(known.reduce((sum,state)=>sum+(stateScore[state]||0),0)/known.length):null;
 const state:RecoveryState=score===null?'Unknown':score>=85?'Likely ready':score>=55?'Nearly recovered':'Recovering';
 return {exercise,score,state};
}

function templateExercises(template:Template,exercises:Exercise[],recovery:MuscleRecovery[]){
 return template.entries.map(entry=>exercises.find(exercise=>exercise.id===entry.exerciseId)).filter((exercise):exercise is Exercise=>Boolean(exercise)).map(exercise=>exerciseReadiness(exercise,recovery)).sort((a,b)=>(b.score??-1)-(a.score??-1));
}

function tone(state:RecoveryState){return state.toLowerCase().replaceAll(' ','-')}
function stateLabel(state:RecoveryState){return state==='Likely ready'?'Ready':state==='Nearly recovered'?'Nearly ready':state==='Unknown'?'No history':'Recovering'}

export function BestRecoveredExercise({templates,exercises,recovery}:{templates:Template[];exercises:Exercise[];recovery:MuscleRecovery[]}){
 const ranked=templates.flatMap(template=>templateExercises(template,exercises,recovery)).filter(item=>item.score!==null).sort((a,b)=>(b.score||0)-(a.score||0)),best=ranked[0];
 if(!best)return <div className="best-recovered unknown"><span className="best-recovered-label">Recovery ranking</span><strong>No workout history yet</strong><small>Complete a workout to start estimating readiness.</small></div>;
 return <div className={'best-recovered '+tone(best.state)}>
  <span className="best-recovered-label">Best recovered now</span>
  <span className="best-recovered-result"><strong>{best.exercise.name}</strong><b>{best.score}%</b></span>
  <span className="readiness-track" aria-hidden="true"><i style={{width:`${best.score}%`}} /></span>
  <small>{stateLabel(best.state)} based on its primary and supporting muscles</small>
 </div>;
}

export function TemplateRecovery({template,exercises,recovery}:{template:Template;exercises:Exercise[];recovery:MuscleRecovery[]}){
 const ranked=templateExercises(template,exercises,recovery),known=ranked.filter(item=>item.score!==null);
 const score=known.length?Math.round(known.reduce((sum,item)=>sum+(item.score||0),0)/known.length):null;
 const state:RecoveryState=score===null?'Unknown':score>=85?'Likely ready':score>=55?'Nearly recovered':'Recovering';
 return <span className="template-recovery">
  <span className="template-readiness-head"><strong>{score===null?'No history':`${score}% ready`}</strong><span className={'readiness-status '+tone(state)}>{stateLabel(state)}</span></span>
  <span className={'readiness-track '+tone(state)} aria-hidden="true"><i style={{width:`${score??0}%`}} /></span>
  <span className="exercise-readiness-list">{ranked.map(item=><span className="exercise-readiness" key={item.exercise.id}><span className={'readiness-dot '+tone(item.state)} /><span className="exercise-readiness-name">{item.exercise.name}</span><strong>{item.score===null?'—':`${item.score}%`}</strong></span>)}</span>
 </span>;
}
