'use client';
import {createContext,useContext,type Dispatch,type SetStateAction} from 'react';
import {applyOffer,offerOverwrites} from '@/lib/coach-offer';
import type {Operation} from '@/lib/account-operations';
import type {Data} from '@/lib/training';
import type {CoachingUpdates} from '@/lib/coaching-updates';
export type CoachMessage={role:'user'|'assistant';content:string};
type Stage=(action:Operation['action'],before:Data,next:Data,label:string,operationId?:string)=>string|null;
const Context=createContext<{data:Data;change:(f:(d:Data)=>Data)=>void;stage:Stage;review:()=>void}|null>(null);
export function CoachMemoryProvider({data,change,stage,review,children}:{data:Data;change:(f:(d:Data)=>Data)=>void;stage:Stage;review:()=>void;children:React.ReactNode}){return <Context.Provider value={{data,change,stage,review}}>{children}</Context.Provider>}
export function useCoachMemory(area:string){const context=useContext(Context);if(!context)throw new Error('Coach memory unavailable');const {data,change,stage,review}=context;
 const messages=data.coachChats?.[area]||[];
 const setMessages:Dispatch<SetStateAction<CoachMessage[]>>=action=>change(current=>{const old=current.coachChats?.[area]||[];const next=typeof action==='function'?action(old):action;return {...current,coachChats:{...current.coachChats,[area]:next.map(m=>({role:m.role,content:m.content})).slice(-200)}}});
 const applyNow=(action:Operation['action'],next:Data,label:string)=>new Promise<boolean>(resolve=>window.dispatchEvent(new CustomEvent('stride:apply-coach-change',{detail:{action,before:data,next,label,resolve}})));
 const confirmSaved=()=>setMessages(old=>[...old,{role:'assistant',content:'Saved to your account. We can keep going here.'}]);
 const setOffer=(offer:CoachingUpdates)=>{if(!offer)return;try{if(offerOverwrites(data,offer)){change(current=>({...current,coachOffers:{...current.coachOffers,[area]:offer}}));return}const next=applyOffer(data,offer);void applyNow('offer',next,'Profile, goal, nutrition or measurement updates').then(saved=>{if(saved)confirmSaved()})}catch{/* The endpoint response remains visible; invalid updates are not applied. */}};
 return {messages,setMessages,offer:data.coachOffers?.[area]||null,setOffer,applyNow,confirmSaved,data,change,stage,review};
}
