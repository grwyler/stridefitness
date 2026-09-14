'use client';
import {createContext,useContext,type Dispatch,type SetStateAction} from 'react';
import type {Data} from '@/lib/training';
import type {CoachingUpdates} from '@/lib/coaching-updates';
export type CoachMessage={role:'user'|'assistant';content:string};
const Context=createContext<{data:Data;change:(f:(d:Data)=>Data)=>void}|null>(null);
export function CoachMemoryProvider({data,change,children}:{data:Data;change:(f:(d:Data)=>Data)=>void;children:React.ReactNode}){return <Context.Provider value={{data,change}}>{children}</Context.Provider>}
export function useCoachMemory(area:string){const context=useContext(Context);if(!context)throw new Error('Coach memory unavailable');const {data,change}=context;
 const messages=data.coachChats?.[area]||[];
 const setMessages:Dispatch<SetStateAction<CoachMessage[]>>=action=>change(current=>{const old=current.coachChats?.[area]||[];const next=typeof action==='function'?action(old):action;return {...current,coachChats:{...current.coachChats,[area]:next.map(m=>({role:m.role,content:m.content})).slice(-200)}}});
 return {messages,setMessages,offer:data.coachOffers?.[area]||null,setOffer:(offer:CoachingUpdates)=>change(current=>({...current,coachOffers:{...current.coachOffers,[area]:offer}})),data,change};
}
