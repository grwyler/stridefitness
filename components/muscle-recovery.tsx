'use client';
import {useMemo,useState} from 'react';
import {Info,RotateCcw} from 'lucide-react';
import type {Data} from '@/lib/training';
import type {StrengthProfile} from '@/lib/goals';
import {muscleRecovery,type MuscleGroup} from '@/lib/muscle-recovery';

const positions:Record<MuscleGroup,{front?:[number,number,number,number];back?:[number,number,number,number]}>= {
 Chest:{front:[25,22,16,8]},Shoulders:{front:[25,19,25,7],back:[75,20,24,7]},Triceps:{back:[75,28,27,8]},Back:{back:[75,27,19,17]},Biceps:{front:[25,28,26,8]},Core:{front:[25,34,12,15]},Glutes:{back:[75,48,17,10]},Quadriceps:{front:[25,54,18,18]},Hamstrings:{back:[75,57,17,17]},Calves:{front:[25,76,17,14],back:[75,76,17,14]}
};
const tone=(state:string)=>state==='Recovering'?'recovering':state==='Nearly recovered'?'nearly':state==='Likely ready'?'ready':'unknown';

export function MuscleRecoveryMap({data,profile,onProfile}:{data:Data;profile?:StrengthProfile;onProfile:(profile:StrengthProfile)=>void}){
 const recovery=useMemo(()=>muscleRecovery(data),[data]);
 const [selected,setSelected]=useState<MuscleGroup>(()=>recovery.find(x=>x.state==='Recovering')?.group||'Chest');
 const current=recovery.find(x=>x.group===selected)!;
 const figure=profile?.recoveryFigure||(profile?.comparison==='men'?'masculine':profile?.comparison==='women'?'feminine':'neutral');
 const setFigure=(recoveryFigure:NonNullable<StrengthProfile['recoveryFigure']>)=>onProfile({...profile,bodyweight:profile?.bodyweight??null,comparison:profile?.comparison||'general',recoveryFigure});
 return <section className="panel muscle-recovery" id="muscle-recovery">
  <div className="section-head"><div><h2><RotateCcw size={19}/> Muscle recovery</h2><p>Estimated from your completed sets, effort, muscle involvement, and time since training.</p></div></div>
  <div className="figure-choice" aria-label="Body map figure"><span>Figure</span>{(['masculine','neutral','feminine'] as const).map(value=><button key={value} className={figure===value?'selected':''} aria-pressed={figure===value} onClick={()=>setFigure(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
  <div className="muscle-recovery-layout">
   <div className={'muscle-figure figure-'+figure}>
    <img src="/muscle-map-figures.png" alt={`${figure} front and back muscle map`}/>
    <div className="muscle-overlays">{recovery.flatMap(item=>(['front','back'] as const).flatMap(side=>{
     const pos=positions[item.group][side];
     return pos?[<button key={item.group+side} title={`${item.group}: ${item.state}`} aria-label={`${item.group}, ${item.state}`} className={'muscle-region '+tone(item.state)+(selected===item.group?' selected':'')} style={{left:`${pos[0]}%`,top:`${pos[1]}%`,width:`${pos[2]}%`,height:`${pos[3]}%`}} onClick={()=>setSelected(item.group)}/>]:[];
    }))}</div>
    <span className="figure-side front">Front</span><span className="figure-side back">Back</span>
   </div>
   <div className="muscle-recovery-detail"><div className={'recovery-state '+tone(current.state)}>{current.state}</div><h3>{current.group}</h3><p>{current.detail}</p><div className="recovery-legend">{['Recovering','Nearly recovered','Likely ready','Unknown'].map(state=><span key={state}><i className={tone(state)}/>{state}</span>)}</div><p className="recovery-caution"><Info size={15}/> This is a training estimate, not a measurement of soreness or biological recovery. How you feel still matters.</p></div>
  </div>
 </section>;
}
