'use client';
import {useState} from 'react';
import {Clipboard,Check} from 'lucide-react';
import type {CoachMessage} from './coach-memory';
export function CopyConversation({messages,testWorkspace}:{messages:CoachMessage[];testWorkspace:boolean}){const [copied,setCopied]=useState(false);if(!testWorkspace||!messages.length)return null;return <button type="button" className="text-button copy-conversation" onClick={async()=>{await navigator.clipboard.writeText(messages.map(message=>`${message.role==='user'?'USER':'STRIDE'}: ${message.content}`).join('\n\n'));setCopied(true);setTimeout(()=>setCopied(false),1800)}}>{copied?<Check size={15}/>:<Clipboard size={15}/>} {copied?'Copied':'Copy conversation log'}</button>}
