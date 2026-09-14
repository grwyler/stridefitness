'use client';
import {useState} from 'react';

export function AdminAiPolicy({initialIncluded}:{initialIncluded:boolean}){
 const [included,setIncluded]=useState(initialIncluded),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function update(){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/ai-policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({included:!included})});
   const body=await response.json() as {included:boolean;error?:string};
   if(!response.ok)throw new Error(body.error||'Could not update this setting.');
   setIncluded(body.included);setMessage('Signup default saved. Existing accounts keep their current access.');
  }catch(e){setError(e instanceof Error?e.message:'Could not update this setting.')}
  finally{setBusy(false)}
 }
 return <section className="panel admin-settings"><h2>AI access for new accounts</h2><p>{included?'New users receive complimentary AI, funded by your connection.':'New users need their own API key. You can grant complimentary AI individually below.'}</p><button className="secondary" disabled={busy} onClick={()=>void update()}>{busy?'Saving…':included?'Stop including AI for new accounts':'Include AI for new accounts'}</button><p className="form-help">Existing accounts keep their access. Revoking complimentary AI never blocks a user’s personal key.</p><p className="form-help">Paid AI is not enabled yet. Continue setup in Usage billing setup below.</p>{message&&<p role="status">{message}</p>}{error&&<p className="plan-error" role="alert">{error}</p>}</section>
}
