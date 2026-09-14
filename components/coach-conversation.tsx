'use client';
import {useEffect,useRef} from 'react';
import {CoachMessage} from './coach-memory';
export function CoachConversation({messages}:{messages:CoachMessage[]}){
 const log=useRef<HTMLDivElement>(null);useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[messages]);
 if(!messages.length)return null;
 return <div className="progress-coach-messages" ref={log} role="log" aria-label="Conversation with your coach" aria-live="polite">{messages.map((m,i)=><div className={'plan-message '+m.role} key={i}><strong>{m.role==='user'?'You':'Stride'}</strong><p>{m.content}</p></div>)}</div>
}
