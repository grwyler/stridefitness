'use client';
import {useEffect,useRef} from 'react';
import {CoachMessage} from './coach-memory';
import {CopyConversation} from './copy-conversation';
export function CoachConversation({messages,testWorkspace,busy=false,streamingReply='',pendingUser}:{messages:CoachMessage[];testWorkspace?:boolean;busy?:boolean;streamingReply?:string;pendingUser?:string}){
 const log=useRef<HTMLDivElement>(null);useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[messages,busy,streamingReply,pendingUser]);
 if(!messages.length&&!pendingUser&&!busy)return null;
 return <>{messages.length>0&&<CopyConversation messages={messages} testWorkspace={testWorkspace}/>}<div className="progress-coach-messages" ref={log} role="log" aria-label="Conversation with your coach" aria-live="polite">{messages.map((m,i)=><div className={'plan-message '+m.role} key={i}><strong>{m.role==='user'?'You':'Stride'}</strong><p>{m.content}</p></div>)}{pendingUser&&<div className="plan-message user"><strong>You</strong><p>{pendingUser}</p><small className="message-delivery">Sent</small></div>}{busy&&<div className="plan-message assistant coach-typing" role="status" aria-label="Stride is typing">{streamingReply?<p>{streamingReply}<span className="typing-caret" aria-hidden="true"/></p>:<span className="typing-dots" aria-hidden="true"><i/><i/><i/></span>}</div>}</div></>
}
