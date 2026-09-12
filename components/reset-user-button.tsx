'use client';
import {useState} from 'react';
import {Loader2,RotateCcw,ShieldCheck,ShieldOff,Trash2} from 'lucide-react';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,AlertDialogTrigger} from '@/components/ui/alert-dialog';
import styles from './reset-user-button.module.css';

type Action='reset'|'delete'|'grant_ai'|'revoke_ai';
export function ResetUserButton({userId,name,aiRevoked}:{userId:string;name:string;aiRevoked:boolean}){
 const [busy,setBusy]=useState<Action|null>(null),[error,setError]=useState('');
 async function change(action:Action){
  setBusy(action);setError('');
  try{const response=await fetch('/api/admin/reset-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,action})}),body=await response.json();if(!response.ok)throw new Error(body.error||'Account change failed');window.location.reload()}
  catch(err){setError(err instanceof Error?err.message:'Account change failed');setBusy(null)}
 }
 const spinner=<Loader2 size={16} className="plan-spin"/>;
 return <div className={styles.reset}>
  <div className={styles.aiStatus}><span>Complimentary AI: <strong>{aiRevoked?'Not included':'Included'}</strong></span><button className={aiRevoked?styles.grant:styles.revoke} disabled={!!busy} onClick={()=>void change(aiRevoked?'grant_ai':'revoke_ai')}>{busy==='grant_ai'||busy==='revoke_ai'?spinner:aiRevoked?<ShieldCheck size={16}/>:<ShieldOff size={16}/>} {aiRevoked?'Grant complimentary AI':'Revoke complimentary AI'}</button></div>
  <div className={styles.actions}>
   <AlertDialog><AlertDialogTrigger className={styles.danger}><RotateCcw size={16}/> Reset account</AlertDialogTrigger><AlertDialogContent className="app-dialog"><AlertDialogHeader><AlertDialogTitle>Reset {name}?</AlertDialogTitle><AlertDialogDescription>This permanently clears their workouts, templates, goals, nutrition logs, settings, and personal AI key, but keeps the account in your user list. Their next signed-in visit starts fresh.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel><AlertDialogAction className={styles.danger} disabled={!!busy} onClick={event=>{event.preventDefault();void change('reset')}}>{busy==='reset'?spinner:<RotateCcw size={16}/>} Reset all data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
   <AlertDialog><AlertDialogTrigger className={styles.delete}><Trash2 size={16}/> Delete account</AlertDialogTrigger><AlertDialogContent className="app-dialog"><AlertDialogHeader><AlertDialogTitle>Permanently delete {name}?</AlertDialogTitle><AlertDialogDescription>This removes the account from your admin list along with all synced workouts, templates, goals, nutrition logs, settings, activity history, and their personal AI key. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel><AlertDialogAction className={styles.delete} disabled={!!busy} onClick={event=>{event.preventDefault();void change('delete')}}>{busy==='delete'?spinner:<Trash2 size={16}/>} Permanently delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>{error&&<p className={styles.error} role="alert">{error}</p>}
 </div>
}
