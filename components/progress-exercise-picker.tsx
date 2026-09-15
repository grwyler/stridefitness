'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Search,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {Command,CommandInput,CommandList,CommandItem,CommandEmpty} from './ui/command';
import type {Exercise} from '@/lib/training';
export function ProgressExercisePicker({exercises,value,onChange}:{exercises:Exercise[];value:string;onChange:(id:string)=>void}){
 const [open,setOpen]=useState(false);
 const dialog=useRef<HTMLDivElement>(null);
 const [viewport,setViewport]=useState({height:0,top:0});
 useEffect(()=>{if(!open)return;const view=window.visualViewport;const update=()=>setViewport({height:view?.height||window.innerHeight,top:view?.offsetTop||0});update();view?.addEventListener('resize',update);view?.addEventListener('scroll',update);return()=>{view?.removeEventListener('resize',update);view?.removeEventListener('scroll',update)}},[open]);
 const viewportStyle=viewport.height?{'--picker-height':`${viewport.height}px`,'--picker-top':`${viewport.top+12}px`} as CSSProperties:undefined;
 return <><button className="secondary progress-picker-trigger" onClick={()=>setOpen(true)} aria-label="Search logged exercises"><Search size={17}/><span>{exercises.find(e=>e.id===value)?.name||'Choose logged exercise'}</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent ref={dialog} style={viewportStyle} onOpenAutoFocus={event=>{if(window.matchMedia("(max-width:760px)").matches){event.preventDefault();dialog.current?.focus({preventScroll:true})}}} className="app-dialog progress-picker-dialog"><DialogHeader><DialogTitle>Your logged exercises</DialogTitle><DialogDescription>Your recorded workouts, most recent first.</DialogDescription></DialogHeader><Command><CommandInput autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Search name or muscle group…"/><CommandList><CommandEmpty>No logged exercises match your search.</CommandEmpty>{exercises.map(e=><CommandItem key={e.id} value={e.id} keywords={[e.name,e.category]} onSelect={()=>{onChange(e.id);setOpen(false)}}><span><strong>{e.name}</strong><small>{e.category}</small></span>{e.id===value&&<Check size={17}/>}</CommandItem>)}</CommandList></Command></DialogContent></Dialog></>;
}
