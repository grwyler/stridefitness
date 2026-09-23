'use client';
import {useState} from 'react';
type Label='unclassified'|'owner_test'|'likely_visitor';
export function GuestAccountLabel({accountId,initialLabel}:{accountId:string;initialLabel:Label}){
 const [label,setLabel]=useState<Label>(initialLabel),[status,setStatus]=useState('');
 async function update(next:Label){const previous=label;setLabel(next);setStatus('Saving…');try{const response=await fetch('/api/admin/guest-label',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId,label:next})}),body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Could not update label.');setStatus('Saved')}catch(error){setLabel(previous);setStatus(error instanceof Error?error.message:'Could not update label.')}}
 return <label className="guest-label-control"><span>Guest label</span><select aria-label={'Guest label for '+accountId.slice(-8)} value={label} onChange={event=>void update(event.target.value as Label)}><option value="unclassified">Not sure yet</option><option value="owner_test">My test account</option><option value="likely_visitor">Likely visitor</option></select><small role="status">{status}</small></label>;
}
