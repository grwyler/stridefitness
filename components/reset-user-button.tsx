'use client';
import {useState} from 'react';
import {Loader2,RotateCcw} from 'lucide-react';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,AlertDialogTrigger} from '@/components/ui/alert-dialog';
import styles from './reset-user-button.module.css';

export function ResetUserButton({userId,name}:{userId:string;name:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function reset(){
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/reset-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})}),body=await response.json();if(!response.ok)throw new Error(body.error||'Reset failed');window.location.reload()}
  catch(err){setError(err instanceof Error?err.message:'Reset failed');setBusy(false)}
 }
 return <div className={styles.reset}><AlertDialog><AlertDialogTrigger className={styles.danger}><RotateCcw size={16}/> Reset account</AlertDialogTrigger><AlertDialogContent className="app-dialog"><AlertDialogHeader><AlertDialogTitle>Reset {name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes their synced workouts, templates, goals, nutrition logs, settings, and personal AI key. Their next signed-in visit will start fresh. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction className={styles.danger} disabled={busy} onClick={event=>{event.preventDefault();void reset()}}>{busy?<Loader2 size={16} className="plan-spin"/>:<RotateCcw size={16}/>} Reset all data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{error&&<p className={styles.error} role="alert">{error}</p>}</div>
}
