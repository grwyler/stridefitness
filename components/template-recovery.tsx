import type {Exercise,Template} from '@/lib/training';
import {exerciseMuscles,type MuscleRecovery,type MuscleGroup,type RecoveryState} from '@/lib/muscle-recovery';

const statuses:RecoveryState[]=['Recovering','Nearly recovered','Likely ready','Unknown'];
export function TemplateRecovery({template,exercises,recovery}:{template:Template;exercises:Exercise[];recovery:MuscleRecovery[]}){
 const involved=new Set<MuscleGroup>();
 let unmapped=false;
 for(const entry of template.entries){
  const exercise=exercises.find(e=>e.id===entry.exerciseId);
  if(!exercise){unmapped=true;continue;}
  const {primary,secondary}=exerciseMuscles(exercise);
  if(!primary.length&&!secondary.length)unmapped=true;
  for(const group of [...primary,...secondary])involved.add(group);
 }
 return <span className="template-recovery">
  {statuses.map(state=>{const groups=recovery.filter(item=>involved.has(item.group)&&item.state===state);return groups.length>0?<span className="template-recovery-line" key={state}><strong>{state==='Unknown'?'No history':state}:</strong> {groups.map(item=>item.group).join(', ')}</span>:null;})}
  {unmapped&&<span className="template-recovery-line">Some exercises have no muscle mapping.</span>}
 </span>;
}
