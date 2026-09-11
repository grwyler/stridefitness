'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {KeyRound,Loader2} from 'lucide-react';
export function AIConnection(){
 const [open,setOpen]=useState(false),[connected,setConnected]=useState(false),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let mounted=true;fetch('/api/ai-connection',{cache:'no-store'}).then(async r=>{const body=await r.json();if(mounted&&r.ok)setConnected(body.connected)}).catch(()=>{});return()=>{mounted=false}},[]);
 async function update(remove=false){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/ai-connection',{method:remove?'DELETE':'POST',headers:{'Content-Type':'application/json'},...(remove?{}:{body:JSON.stringify({apiKey:key})}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to save connection.');
   setConnected(result.connected);setKey('');setNotice(remove?'Key removed from Stride.':'Key saved. Close this window and describe your workout plan.');
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'The request timed out. Please try again.':e instanceof Error?e.message:'Unable to save connection.')}
  finally{setBusy(false)}
 }
 return <><button className="secondary" onClick={()=>{setOpen(true);setError('');setNotice('')}}><KeyRound size={16}/>{connected?'Manage AI':'Connect AI'}</button><Dialog open={open} onOpenChange={value=>{if(busy)return;setOpen(value);setKey('');setError('');setNotice('')}}><DialogContent className="app-dialog ai-connect"><DialogHeader><DialogTitle>{connected?'Your AI connection':'Connect AI'}</DialogTitle><DialogDescription>Use your OpenAI API key to create workout plans in Stride.</DialogDescription></DialogHeader><ol className="connection-steps"><li>Open <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API keys</a>.</li><li>Select “Create new secret key,” name it “Stride,” and copy the key.</li><li>Paste it below and select Save key.</li></ol><form onSubmit={e=>{e.preventDefault();void update()}}><label htmlFor="ai-secret">{connected?'Replace API key':'API key'}<input id="ai-secret" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" value={key} disabled={busy} onChange={e=>setKey(e.target.value)} placeholder="sk-…" maxLength={2048} required/></label><p className="form-help">Stored encrypted on the server for your signed-in account. The saved key is never shown again or included in your planning chat.</p><p className="form-help">OpenAI API usage is billed separately from ChatGPT. You may need to add credits in <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noopener noreferrer">API billing</a>.</p><button className="primary full" disabled={busy||!key.trim()}>{busy?<Loader2 size={16} className="plan-spin"/>:<KeyRound size={16}/>}Save key</button></form>{connected&&<button className="text-button full" disabled={busy} onClick={()=>void update(true)}>Disconnect AI and remove saved key</button>}{error&&<p className="plan-error" role="alert">{error}</p>}{notice&&<p className="connection-notice" role="status">{notice}</p>}</DialogContent></Dialog></>
}
