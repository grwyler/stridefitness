'use client';
import {useEffect,useRef,useState} from 'react';
import {CoachMessage} from './coach-memory';
import {CopyConversation} from './copy-conversation';
export function CoachConversation({messages,testWorkspace}:{messages:CoachMessage[];testWorkspace?:boolean}){
 const [detectedTest,setDetectedTest]=useState(false),log=useRef<HTMLDivElement>(null);useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;setDetectedTest(!!document.querySelector('.test-workspace-banner'))},[messages]);
 if(!messages.length)return null;
 return <><CopyConversation messages={messages} testWorkspace={testWorkspace??detectedTest}/><div className="progress-coach-messages" ref={log} role="log" aria-label="Conversation with your coach" aria-live="polite">{messages.map((m,i)=><div className={'plan-message '+m.role} key={i}><strong>{m.role==='user'?'You':'Stride'}</strong><p>{m.content}</p></div>)}</div></>
}
