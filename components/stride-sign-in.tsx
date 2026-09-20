"use client";
import {useState} from 'react';
import {GoogleSignIn} from './google-sign-in';
import {TestAccessForm} from './test-access-form';

export function StrideSignIn({clientId}:{clientId:string|null}){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function guest(){setBusy(true);const response=await fetch('/api/auth/guest',{method:'POST'});if(response.ok)location.assign('/');else{setMessage('Guest access is temporarily unavailable.');setBusy(false)}}
 async function send(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');const response=await fetch('/api/auth/email/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}),body=await response.json().catch(()=>({}));setMessage(response.ok?'Check your inbox for a secure sign-in link.':body.error||'Email sign-in could not be started.');setBusy(false)}
 return <div className="stride-signin-options"><GoogleSignIn clientId={clientId}/><form onSubmit={send} className="email-signin"><label htmlFor="signin-email">Continue with email</label><div><input id="signin-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/><button className="secondary" disabled={busy}>Email me a link</button></div></form><button className="text-button guest-signin" disabled={busy} onClick={()=>void guest()}>Try Stride without an account</button><p className="form-help">No email required. Create an account later to protect your progress and use Stride across devices.</p><details className="test-access-entry"><summary>Private test access</summary><TestAccessForm/></details>{message&&<p className="signin-error" role="status">{message}</p>}</div>
}
