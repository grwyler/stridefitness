'use client';
import {useEffect,useState} from 'react';
type Status={connected:boolean;verifiedAt:string|null;billingEnabled:false};
export function AdminBillingSetup(){
 const [status,setStatus]=useState<Status|null>(null),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function request(method='GET',body?:object){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/metronome',{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
   const result=await response.json() as Status&{error?:string};
   if(!response.ok)throw new Error(result.error||'Unable to update the connection.');
   setStatus(result);
   if(method!=='GET'){setToken('');setMessage(method==='DELETE'?'Saved token removed from Stride.':body&&'token' in body?'Token saved. Stride sandbox connection verified. Billing is still off.':'Stride sandbox connection verified. Billing is still off.')}
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'The check timed out. Try again to confirm the saved status.':e instanceof Error?e.message:'Could not check the connection.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void request()},[]);
 return <section id="billing-setup" className="panel" style={{marginBottom:24,scrollMarginTop:24}}><h2>Usage billing setup</h2><p>Token cost only · No monthly fee · No markup</p><p className="connection-notice">{status?.connected?'Metronome token saved.':'Connect Metronome to prepare usage billing.'} Billing is not enabled.</p><details open={!status?.connected}><summary>{status?.connected?'Manage sandbox connection':'Connect Metronome sandbox'}</summary><ol className="connection-steps"><li>In Metronome, stay in <strong>Sandbox</strong> and open <strong>Developer → API tokens → + Add</strong>.</li><li>Name it <strong>Stride sandbox</strong>, create the token, and copy it.</li><li>Paste it below. Stride will check the token’s access to your Stripe sandbox.</li></ol><form onSubmit={e=>{e.preventDefault();void request('POST',{token})}}><label htmlFor="metronome-token">Metronome sandbox API token<input id="metronome-token" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={4096} value={token} onChange={e=>setToken(e.target.value)} disabled={busy} required placeholder="Paste your sandbox token"/></label><p className="form-help">Stored encrypted on the server. Only the owner can manage this connection; the saved token is never displayed.</p><button className="primary" disabled={busy||!token.trim()}>{busy?'Checking…':'Verify and save token'}</button></form>{status?.connected&&<div className="button-group" style={{marginTop:16,flexWrap:'wrap'}}><button className="secondary" disabled={busy} onClick={()=>void request('POST',{action:'check'})}>Check connection</button><button className="text-button" disabled={busy} onClick={()=>void request('DELETE')}>Remove saved token</button></div>}</details>{status?.verifiedAt&&<p className="form-help">Last verified: {new Date(status.verifiedAt).toLocaleString()}</p>}<p className="form-help">This step checks and saves the connection only. Usage tracking, payment setup, and billing tests must be completed before anyone can be charged. Complimentary AI stays unchanged.</p>{error&&<p className="plan-error" role="alert">{error}</p>}{error&&!status&&<button className="secondary" disabled={busy} onClick={()=>void request()}>Retry connection status</button>}{message&&<p role="status">{message}</p>}</section>
}
