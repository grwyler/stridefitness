'use client';
import {useState} from 'react';
import {Search,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {Command,CommandInput,CommandList,CommandItem,CommandEmpty} from './ui/command';
import type {Exercise} from '@/lib/training';
export function ProgressExercisePicker({exercises,value,onChange}:{exercises:Exercise[];value:string;onChange:(id:string)=>void}){
 const [open,setOpen]=useState(false);
 return <><button className="secondary progress-picker-trigger" onClick={()=>setOpen(true)} aria-label="Search logged exercises"><Search size={17}/><span>{exercises.find(e=>e.id===value)?.name||'Choose logged exercise'}</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog progress-picker-dialog"><DialogHeader><DialogTitle>Your logged exercises</DialogTitle><DialogDescription>Recently trained first. Only exercises with attempted sets in completed workouts appear here.</DialogDescription></DialogHeader><Command><CommandInput placeholder="Search name or muscle group…"/><CommandList><CommandEmpty>No logged exercises match your search.</CommandEmpty>{exercises.map(e=><CommandItem key={e.id} value={e.id} keywords={[e.name,e.category]} onSelect={()=>{onChange(e.id);setOpen(false)}}><span><strong>{e.name}</strong><small>{e.category}</small></span>{e.id===value&&<Check size={17}/>}</CommandItem>)}</CommandList></Command></DialogContent></Dialog></>;
}
