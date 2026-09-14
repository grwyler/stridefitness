'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {z} from 'zod';
import {UserRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Data} from '@/lib/training';
import {AccountCoordinator} from '@/lib/account-coordinator';
import {CoachBoundary} from './coach-boundary';
import {CoachOperationCard} from './coach-operation-card';
import type {Operation} from '@/lib/account-operations';
export type AccountSyncHandle={stage:(action:Operation['action'],before:Data,next:Data,label:string,operationId?:string)=>string|null;apply:(id:string)=>Promise<boolean>;discard:(id:string)=>Promise<boolean>;flush:()=>Promise<boolean>;saveNow:(next:Data)=>Promise<boolean>};
export const AccountSync=forwardRef<AccountSyncHandle,{data:Data;onLoad:(data:Data)=>void;onView?:(target:string)=>void}>(function AccountSync({data,onLoad,onView},ref){
 const [coordinator,setCoordinator]=useState<AccountCoordinator|null>(null),[,render]=useState(0),[account,setAccount]=useState<any>(null),[open,setOpen]=useState(false);const load=useRef(onLoad);load.current=onLoad;
 useEffect(()=>{const c=new AccountCoordinator(localStorage);c.onData=next=>load.current(next);setCoordinator(c);const unsubscribe=c.subscribe(()=>render(n=>n+1));void c.initialize().then(()=>{if(c.getSnapshot().ready)window.dispatchEvent(new Event('stride:weekly-review'))});fetch('/api/account',{cache:'no-store'}).then(r=>r.json()).then(setAccount).catch(()=>{});const focus=()=>void c.checkIdentity();window.addEventListener('focus',focus);const online=()=>void c.flush();window.addEventListener('online',online);return()=>{unsubscribe();window.removeEventListener('focus',focus);window.removeEventListener('online',online)}},[]);
 useEffect(()=>{coordinator?.update(data)},[data,coordinator]);
 useEffect(()=>{if(!coordinator)return;const read=(event:Event)=>{(event as CustomEvent).detail.resolve(coordinator.getData().profile)};const save=(event:Event)=>{const {profile,before,resolve}=(event as CustomEvent).detail;try{void coordinator.saveProfile(before,profile).then(resolve)}catch{resolve(false)}};window.addEventListener('stride:profile-read',read);window.addEventListener('stride:profile-save',save);return()=>{window.removeEventListener('stride:profile-read',read);window.removeEventListener('stride:profile-save',save)}},[coordinator]);

 useImperativeHandle(ref,()=>({stage:(action,before,next,label,operationId)=>{if(!coordinator)throw new Error('Your account is still loading.');return coordinator.stage(action,before,next,label,operationId)},apply:id=>coordinator?.apply(id)||Promise.resolve(false),discard:id=>discard(id),flush:()=>coordinator?.flush()||Promise.resolve(false),saveNow:async next=>{if(!coordinator)return false;const id=coordinator.stage('progress',data,next,'Progress updates');return id?coordinator.apply(id):true}}),[coordinator,data]);
 const state=coordinator?.getSnapshot();
 const [discardError,setDiscardError]=useState('');
 async function discard(id:string){
  if(!coordinator)return false;
  const op=coordinator.getSnapshot().operations.find(x=>x.id===id);
  if(!op)return true;
  if(op.status==='Saving'||op.submitted&&!op.receipt)return false;
  try{
   if(op.label.startsWith('Weekly Review')&&!op.receipt){
    const accountResponse=await fetch('/api/weekly-review',{cache:'no-store'}),accountBody=z.object({accountId:z.string()}).parse(await accountResponse.json());
    if(!accountResponse.ok||!accountBody.accountId)throw new Error('Your review could not be set aside. Please retry.');
    const response=await fetch('/api/weekly-review',{method:'POST',headers:{'Content-Type':'application/json','X-Stride-Account':accountBody.accountId},body:JSON.stringify({intent:'feedback',id,feedback:'not_now'})});
    if(!response.ok)throw new Error('Your review could not be set aside. Please retry.');
   }
   coordinator.discard(id);if(coordinator.getSnapshot().operations.some(x=>x.id===id))return false;setDiscardError('');window.dispatchEvent(new Event('stride:weekly-review'));return true;
  }catch(e){setDiscardError(e instanceof Error?e.message:'Please retry setting aside this review.');return false}
 }

 function backup(){if(!coordinator)return;const url=URL.createObjectURL(new Blob([coordinator.backup()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='stride-recovery.json';a.click();URL.revokeObjectURL(url)}
 return <>
 {discardError&&<p role="alert" className="notice">{discardError}</p>}
 {!state?.ready&&<div className="sync-loading-gate" role="status"><p>{state?.error||'Loading your saved training…'}</p>{state?.error&&<button className="primary" onClick={()=>location.reload()}>Reload Stride</button>}</div>}
 {state?.ready&&<p role="status" className="muted account-save-status">{state.status}</p>}
 {state?.ready&&state.error&&<div className="notice" role="alert"><span>{state.error}</span><button className="text-button" onClick={()=>void (state.conflict?coordinator?.recover():coordinator?.flush())}>{state.conflict?'Load current data & keep compatible edits':'Retry sync'}</button>{state.conflict&&<button className="text-button" onClick={()=>{if(window.confirm('Discard unsynced local edits and load account data? Pending coach actions will be kept.'))void coordinator?.recover(true)}}>Discard local edits</button>}<button className="text-button" onClick={backup}>Download recovery copy</button></div>}
 {state?.ready&&state.operations.length>0&&<section id="coach-account-actions" className="panel" aria-label="Coach account actions"><h2>Coach changes</h2>{state.operations.map(op=><CoachBoundary key={op.id}><CoachOperationCard op={op} data={data} onApply={id=>coordinator?.apply(id)} onDiscard={id=>void discard(id)} onView={onView}/></CoachBoundary>)}</section>}
 <button className="account-button" aria-label="Account" onClick={()=>setOpen(true)}>{account?.name?.charAt(0)||<UserRound size={18}/>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog account-dialog"><DialogHeader><DialogTitle>Your Stride account</DialogTitle><DialogDescription>{account?.email||'Account connection'}</DialogDescription></DialogHeader><p role="status">{state?.status}</p>{account?.isAdmin&&<a className="secondary full" href="/admin">Admin · Users & activity</a>}<button className="secondary" onClick={backup}>Download recovery copy</button>{account?.signOutUrl&&<a className="secondary full" href={account.signOutUrl} target="_top">Log out</a>}</DialogContent></Dialog>
 </>;
});
