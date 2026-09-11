'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {KeyRound,Loader2} from 'lucide-react';
export function AIConnection(){
 const [open,setOpen]=useState(false),[connected,setConnected]=useState(false),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [auth,setAuth]=useState<'checking'|'signed-in'|'sign-in'|'unavailable'>('checking');
 const [signInUrl,setSignInUrl]=useState('/signin-with-chatgpt?return_to=%2F%3FconnectAI%3D1');
 function requireSignIn(body:{signInUrl?:string}){
  setAuth('sign-in');setConnected(false);setKey('');
  if(body.signInUrl?.startsWith('/signin-with-chatgpt?'))setSignInUrl(body.signInUrl);
 }
 async function checkConnection(){
  setAuth('checking');setError('');
  try{
   const response=await fetch('/api/ai-connection',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
   const body=await response.json();
   if(response.status===401){requireSignIn(body);return}
   if(!response.ok)throw new Error(body.error||'Unable to check your connection.');
   setConnected(body.connected);setAuth('signed-in');
  }catch{setAuth('unavailable');setError('Could not check your sign-in. Please try again.')}
 }
 useEffect(()=>{void checkConnection();if(new URLSearchParams(window.location.search).get('connectAI')==='1'){setOpen(true);const url=new URL(window.location.href);url.searchParams.delete('connectAI');window.history.replaceState(null,'',url.pathname+url.search+url.hash)}},[]);
 async function update(remove=false){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/ai-connection',{method:remove?'DELETE':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(remove?{}:{body:JSON.stringify({apiKey:key})}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(response.status===401){requireSignIn(result);return}
   if(!response.ok)throw new Error(result.error||'Unable to save connection.');
   setConnected(result.connected);setKey('');setNotice(remove?'Key removed from Stride.':'Key saved. Close this window and describe your workout plan.');
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'The request timed out. Please try again.':e instanceof Error?e.message:'Unable to save connection.')}
  finally{setBusy(false)}
 }
 return <><button className="secondary" onClick={()=>{setOpen(true);setError('');setNotice('');void checkConnection()}}><KeyRound size={16}/>{connected?'Manage AI':'Connect AI'}</button><Dialog open={open} onOpenChange={value=>{if(busy)return;setOpen(value);setKey('');setError('');setNotice('')}}><DialogContent className="app-dialog ai-connect"><DialogHeader><DialogTitle>{connected?'Your AI connection':'Connect AI'}</DialogTitle><DialogDescription>Use your OpenAI API key to create workout plans in Stride.</DialogDescription></DialogHeader>
 {auth==='checking'&&<p role="status">Checking your sign-in…</p>}
 {auth==='sign-in'&&<div className="connection-sign-in"><p>Sign in with ChatGPT before adding your key. You’ll return here afterward.</p><a className="primary full" href={signInUrl} target="_top">Sign in with ChatGPT</a><p className="form-help">Your key has not been saved. Keep your copy available to paste after signing in.</p><button className="text-button full" onClick={()=>void checkConnection()}>I’ve signed in — check again</button></div>}
 {auth==='unavailable'&&<button className="secondary" onClick={()=>void checkConnection()}>Try again</button>}
 {auth==='signed-in'&&<><ol className="connection-steps"><li>Open <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API keys</a> if you need a key.</li><li>Select “Create new secret key,” name it “Stride,” and copy the key. If you already copied a key, use that one.</li><li>Paste it below and select Save key.</li></ol><form onSubmit={e=>{e.preventDefault();void update()}}><label htmlFor="ai-secret">{connected?'Replace API key':'API key'}<input id="ai-secret" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" value={key} disabled={busy} onChange={e=>setKey(e.target.value)} placeholder="sk-…" maxLength={2048} required/></label><p className="form-help">Stored encrypted on the server for your signed-in account. The saved key is never shown again or included in your planning chat.</p><p className="form-help">OpenAI API usage is billed separately from ChatGPT. You may need to add credits in <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noopener noreferrer">API billing</a>.</p><button className="primary full" disabled={busy||!key.trim()}>{busy?<Loader2 size={16} className="plan-spin"/>:<KeyRound size={16}/>}Save key</button></form>{connected&&<button className="text-button full" disabled={busy} onClick={()=>void update(true)}>Disconnect AI and remove saved key</button>}</>}
 {error&&<p className="plan-error" role="alert">{error}</p>}{notice&&<p className="connection-notice" role="status">{notice}</p>}</DialogContent></Dialog></>
}
