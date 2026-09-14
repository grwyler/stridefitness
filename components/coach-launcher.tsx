'use client';
import {Sparkles,ArrowRight} from 'lucide-react';
export function CoachLauncher({hint,onOpen,onCreate,hasMessages=false}:{hint:string;onOpen:()=>void;onCreate?:()=>void;hasMessages?:boolean}){
 return <section className="panel coach-launcher"><div><Sparkles size={20}/><span><strong>Your coach</strong><small>{hint}</small></span></div><div className="coach-launcher-actions"><button className="secondary" onClick={onOpen}>{hasMessages?'Continue chat':'Ask coach'}<ArrowRight size={16}/></button>{onCreate&&<button className="text-button" onClick={onCreate}>Create a plan</button>}</div></section>
}
