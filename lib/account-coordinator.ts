import {profileSchema,type CoachingProfile} from './profile';
import type {Data} from './training';
import {initialData,migrateData} from './training';
import {applyChanges,changes,validateOperation,type Operation,type PendingOperation,type Receipt} from './account-operations';

type AccountResponse={data?:Data;updatedAt?:string|null;accountId?:string;accountEmail?:string;resetAt?:string;error?:string;receipt?:Receipt};
type Snapshot={ready:boolean;status:string;error:string;operations:PendingOperation[];conflict:boolean};
function valueAt(root:unknown,path:string[]){let value:any=root;for(const part of path){value=part.startsWith('@')&&Array.isArray(value)?value.find(row=>(row.id??row.exerciseId)===part.slice(1)):value?.[part]}return value}
export class AccountCoordinator{
 private consumedRecovery=new Map<string,string>();
 private listeners=new Set<()=>void>();
 private snapshot:Snapshot={ready:false,status:'Loading your saved training…',error:'',operations:[],conflict:false};
 private queue:Promise<unknown>=Promise.resolve();
 private active=new Map<string,Promise<boolean>>();
 private base:Data=initialData();private local:Data=this.base;private revision:string|null=null;
 private conflictCopy:{base:Data;local:Data}|null=null;
 getData=()=>this.local;
 private legacyPrefix='';private identity='';private generation=0;private recovery='';private lastWrite='';private stopped=false;
 onData:(data:Data)=>void=()=>{};
 constructor(private storage:Storage,private request:typeof fetch=(...args)=>fetch(...args)){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn)}};
 getSnapshot=()=>this.snapshot;
 private emit(patch:Partial<Snapshot>={}){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(fn=>fn())}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const task=this.queue.then(fn,fn);this.queue=task.catch(()=>{});return task}
 private prefix(){return 'stride-coach:'+this.identity+':'}
 private remember(){if(!this.identity)return;const value=JSON.stringify(this.conflictCopy||{base:this.base,local:this.local});if(value===this.lastWrite)return;this.storage.setItem(this.recovery,value);this.lastWrite=value}
 private put(op:PendingOperation){this.storage.setItem(this.prefix()+op.id,JSON.stringify(op));this.emit({operations:[...this.snapshot.operations.filter(x=>x.id!==op.id),op]})}
 private clearConsumed(){for(const [key,value] of this.consumedRecovery)if(this.storage.getItem(key)===value)this.storage.removeItem(key);this.consumedRecovery.clear()}
 private reconcile(authoritative:Data,revision:string|null,captured:Data){
  const edits=changes(captured,this.local);
  this.base=authoritative;this.revision=revision;
  try{this.local=applyChanges(authoritative,edits);this.emit({conflict:false})}catch(e){this.conflictCopy={base:captured,local:this.local};this.emit({conflict:true,error:'Your local edits overlap newer account data. They are preserved. Review recovery before continuing.'});this.remember();return}
  this.remember();this.onData(this.local);
 }
 async initialize(){
  const generation=++this.generation;this.emit({ready:false});
  try{
   const response=await this.request('/api/training-data',{cache:'no-store'}),body=await response.json() as AccountResponse;if(!response.ok||!body.accountId)throw new Error(body.error||'Your account data could not be loaded.');if(generation!==this.generation)return;
   this.identity=body.accountId!;this.legacyPrefix='stride-unsynced:'+body.accountEmail+':';this.stopped=false;this.recovery='stride-recovery:'+this.identity+':'+crypto.randomUUID();
   this.base=body.data&&!body.resetAt?migrateData(body.data):initialData();this.local=this.base;this.revision=body.updatedAt??null;
   const ops:PendingOperation[]=[];let error='';
   for(const k of Object.keys(this.storage)){
    try{
     if(k.startsWith(this.prefix())){const op=JSON.parse(this.storage.getItem(k)!);if(op.status==='Saving'){op.status='Needs attention';op.error='The save was interrupted. Retry to check whether it saved.'}ops.push(op)}
     if(k.startsWith('stride-recovery:'+this.identity+':')){const copy=JSON.parse(this.storage.getItem(k)!);if(body.resetAt)continue;try{this.local=applyChanges(this.local,changes(copy.base,copy.local));this.consumedRecovery.set(k,this.storage.getItem(k)!)}catch{error='An earlier local edit overlaps newer account data. Download the recovery copy or discard local edits to continue.'}}
    }catch{error='A local recovery copy could not be opened. It has been retained.'}
   }
   this.onData(this.local);this.emit({ready:true,operations:ops,status:'Account loaded',error,conflict:!!error});this.remember();void this.flush();
  }catch(e){this.emit({error:(e as Error).message,status:'Needs attention'})}
 }
 update(data:Data){if(!this.snapshot.ready||this.stopped)return;this.local=data;if(this.conflictCopy)this.conflictCopy.local=data;try{this.remember()}catch{this.emit({error:'Device storage is full. Keep this page open until your changes save.'})}void this.flush()}
 stage(action:Operation['action'],before:Data,next:Data,label:string,operationId?:string){
  if(!this.snapshot.ready||this.stopped)throw new Error('Wait for your account to load.');
  const payload=changes(before,next);if(!payload.length)return null;
  const existing=this.snapshot.operations.find(x=>operationId?x.id===operationId:x.status!=='Saved to your account'&&x.action===action&&JSON.stringify(x.payload)===JSON.stringify(payload));if(existing){if(existing.action!==action||JSON.stringify(existing.payload)!==JSON.stringify(payload))throw new Error('This proposal changed. Open a fresh review.');return existing.id;}
  const op:PendingOperation={id:operationId||crypto.randomUUID(),action,payload,expectedRevision:this.revision,label,status:'Proposed'};
  validateOperation(before,next,op);this.put(op);return op.id;
 }
 editSetProposal(id:string,weight:number,reps:number){
  const op=this.snapshot.operations.find(x=>x.id===id);
  if(!op||op.action!=='set'||op.submitted||op.receipt||op.status==='Saving'||this.active.has(id))throw new Error('This save is already underway. Check its result before editing.');
  if(!Number.isFinite(weight)||weight<0||weight>2000||!Number.isInteger(reps)||reps<1||reps>100)throw new Error('Use a weight from 0–2,000 lb and 1–100 whole reps.');
  const path=op.payload[0].path,entryPath=path.slice(0,5).join('/');
  if(path.length!==7||path[0]!=='workouts'||path[2]!=='entries'||path[4]!=='sets'||!op.payload.every(p=>p.path.length===7&&p.path.slice(0,5).join('/')===entryPath))throw new Error('Edit this change through the session coach.');
  const next=applyChanges(this.local,op.payload);
  const entry=next.workouts.find(w=>'@'+w.id===path[1])?.entries.find(e=>'@'+e.exerciseId===path[3]);
  const setIds=new Set(op.payload.map(p=>p.path[5]));
  const sets=entry?.sets.filter(set=>setIds.has('@'+set.id));
  // A grouped calibration remains editable as one target for every affected unfinished set.
  if(!sets?.length||sets.some(set=>set.status!=='pending'))throw new Error('That set is no longer unfinished. Ask for a fresh suggestion.');
  for(const set of sets){set.weight=weight;set.targetWeight=weight;set.reps=reps;set.targetReps=reps}
  const payload=changes(this.local,next);if(!payload.length){this.discard(id);return null}
  const revised:PendingOperation={...op,id:crypto.randomUUID(),payload,expectedRevision:this.revision,status:'Proposed',error:''};
  validateOperation(this.local,next,revised);this.put(revised);this.discard(id);return revised.id;
 }
 discard(id:string){const op=this.snapshot.operations.find(x=>x.id===id);if(!op||op.status==='Saving'||op.submitted&&!op.receipt)return;this.storage.removeItem(this.prefix()+id);this.emit({operations:this.snapshot.operations.filter(x=>x.id!==id)})}
 private async saveLocal(){
  if(!this.snapshot.ready||this.stopped||this.snapshot.conflict)return false;if(this.snapshot.operations.some(op=>op.submitted&&!op.receipt&&op.status!=='Saving')){this.emit({status:'Needs attention',error:'Check the interrupted coach save to continue syncing. Your manual edits are kept on this device.'});return false;}
  const captured=this.local;if(JSON.stringify(captured)===JSON.stringify(this.base)&&this.revision!==null){this.clearConsumed();return true;}
  this.emit({status:'Saving'});
  try{
   const response=await this.request('/api/training-data',{method:'PUT',headers:{'Content-Type':'application/json','X-Stride-Account':this.identity},body:JSON.stringify({data:captured,baseUpdatedAt:this.revision})}),body=await response.json() as AccountResponse;
   if(response.status===401||response.status===403){this.stopped=true;this.emit({ready:false,operations:[]});throw new Error('Your account session changed. Reload Stride to continue.')}
   if(response.status===409){this.emit({conflict:true});throw new Error('Newer account data exists. Review it to continue saving.');}
   if(!response.ok||!body.updatedAt)throw new Error(body.error||'Changes need attention. Retry when you are connected.');
   this.reconcile(body.data||captured,body.updatedAt??null,captured);this.clearConsumed();this.emit({status:'Saved to your account',...(!this.snapshot.conflict?{error:''}:{})});return !this.snapshot.conflict;
  }catch(e){this.emit({status:'Needs attention',error:(e as Error).message});return false}
 }
 saveProfile(before:CoachingProfile|undefined,profile:CoachingProfile){return this.serial(async()=>{try{const parsed=profileSchema.parse(profile);this.local=applyChanges(this.local,changes({profile:before},{profile:parsed}));this.remember();this.onData(this.local);return await this.saveLocal()}catch(e){this.emit({status:'Needs attention',error:e instanceof Error?e.message:'Your profile could not be saved.'});return false}})}
 flush=()=>this.serial(()=>this.saveLocal());
 private rebasePlan(op:PendingOperation){
  let next=this.local;
  for(const patch of op.payload){
   try{next=applyChanges(next,[patch])}
   catch(error){
    // Planner metadata may be autosaved after the proposal was created. Reapplying
    // deliberately selects this reviewed plan, while template conflicts stay guarded.
    if(patch.path[0]!=='coachPlanner'||!['plan','ids','draft'].includes(patch.path[1]))throw error;
    const before=valueAt(next,patch.path);
    const rebased={path:patch.path,...(before===undefined?{}:{before}),...(patch.after===undefined?{}:{after:patch.after})};
    next=applyChanges(next,[rebased]);
   }
  }
  const payload=changes(this.local,next);if(!payload.length)throw new Error('This plan is already reflected in your current data. Ask your coach for a fresh plan to create a verified save.');
  const revised:PendingOperation={...op,payload,status:'Proposed',submitted:false,error:''};validateOperation(this.local,next,revised);this.put(revised);return revised;
 }
 apply(id:string):Promise<boolean>{
  const running=this.active.get(id);if(running)return running;
  const task=this.serial(async()=>{
   let op=this.snapshot.operations.find(x=>x.id===id);if(!op||this.stopped)return false;if(op.receipt)return true;
   try{
    if(!op.submitted){if(!await this.saveLocal())throw new Error(this.snapshot.error||'Resolve account sync before applying.');if(op.action==='plan'&&op.status==='Needs attention')op=this.rebasePlan(op);op={...op,expectedRevision:this.revision};}
    // Journal submission before network I/O. An uncertain result must retain this exact ID/payload.
    op={...op,status:'Saving',submitted:true,error:''};this.put(op);
    const captured=this.base;
    const response=await this.request('/api/coach-operations',{method:'POST',headers:{'Content-Type':'application/json','X-Stride-Account':this.identity},body:JSON.stringify({id:op.id,action:op.action,payload:op.payload,expectedRevision:op.expectedRevision})}),body=await response.json() as AccountResponse;
    if(response.status===401||response.status===403){this.stopped=true;this.emit({ready:false,operations:[]});throw new Error('Your account session changed. Reload to continue.')}
    if(response.status===409||response.status===422){op={...op,submitted:false};if(response.status===409){this.emit({conflict:true});await this.loadCurrent(false)}}
    if(!response.ok||!body.receipt||body.receipt.id!==id)throw new Error(body.error||'No save confirmation received. Retry to check whether your change saved.');
    const receipt=body.receipt as Receipt;
    this.reconcile(body.data||initialData(),body.updatedAt??null,captured);
    this.put({...op,status:'Saved to your account',receipt,error:''});this.emit({status:'Saved to your account'});
    // The receipt is durable even if saving edits made during the request fails.
    await this.saveLocal();return true;
   }catch(e){if(op&&!this.stopped)this.put({...op,status:'Needs attention',error:(e as Error).message});return false}
  });this.active.set(id,task);void task.finally(()=>this.active.delete(id));return task;
 }
 private async loadCurrent(discard:boolean){
  const response=await this.request('/api/training-data',{cache:'no-store'}),body=await response.json() as AccountResponse;if(!response.ok||body.accountId!==this.identity)throw new Error('The account changed. Reload before continuing.');
  const fresh=body.data&&!body.resetAt?migrateData(body.data):initialData();
  const edits=changes(this.conflictCopy?.base||this.base,this.conflictCopy?.local||this.local);
  if(discard){this.base=fresh;this.local=fresh;this.revision=body.updatedAt??null}
  else{const merged=applyChanges(fresh,edits);this.base=fresh;this.local=merged;this.revision=body.updatedAt??null}
  this.conflictCopy=null;this.remember();this.onData(this.local);this.emit({conflict:false,error:'',status:'Current account data loaded. Review your pending actions before applying.'});
 }
 recover=(discard=false)=>this.serial(async()=>{try{await this.loadCurrent(discard);if(discard)for(const k of Object.keys(this.storage))if(k.startsWith('stride-recovery:'+this.identity+':')&&k!==this.recovery)this.storage.removeItem(k);return await this.saveLocal()}catch(e){this.emit({conflict:true,error:(e as Error).message});return false}});
 async checkIdentity(){try{const r=await this.request('/api/training-data',{cache:'no-store'}),b=await r.json() as AccountResponse;if(r.status===401||r.ok&&b.accountId!==this.identity){this.stopped=true;this.emit({ready:false,operations:[],error:'Your account changed. Reload Stride to continue.'})}}catch{}}
 backup(){return JSON.stringify(Object.fromEntries(Object.keys(this.storage).filter(k=>k.startsWith('stride-recovery:'+this.identity+':')||k.startsWith(this.prefix())||k.startsWith(this.legacyPrefix)).map(k=>[k,JSON.parse(this.storage.getItem(k)!)])),null,2)}
}
