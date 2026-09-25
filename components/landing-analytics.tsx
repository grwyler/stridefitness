'use client';
import {useCallback,useEffect,useRef} from 'react';
type EventType='page_view'|'click'|'scroll'|'engagement'|'try_guest';
type Payload={sessionId:string;eventType:EventType;target?:string;durationSeconds:number;maxScrollPercent:number;referrer:string|null;utmSource:string|null;utmMedium:string|null;utmCampaign:string|null;utmContent:string|null;utmTerm:string|null;googleAdsClick:boolean};
export function useLandingAnalytics(page?:string){
 const sessionId=useRef(''),activeMs=useRef(0),priorActiveMs=useRef(0),visibleAt=useRef<number|null>(null),maxScroll=useRef(0),sentMilestones=useRef(new Set<number>());
 const track=useCallback(async(eventType:EventType,target?:string)=>{
  if(!sessionId.current)return;
  const now=Date.now(),active=priorActiveMs.current+activeMs.current+(visibleAt.current===null?0:Math.max(0,now-visibleAt.current)),query=new URLSearchParams(window.location.search),payload:Payload={sessionId:sessionId.current,eventType,target,durationSeconds:Math.min(14400,Math.floor(active/1000)),maxScrollPercent:maxScroll.current,referrer:(()=>{try{return document.referrer?new URL(document.referrer).origin:null}catch{return null}})(),utmSource:query.get('utm_source'),utmMedium:query.get('utm_medium'),utmCampaign:query.get('utm_campaign'),utmContent:query.get('utm_content'),utmTerm:query.get('utm_term'),googleAdsClick:!!(query.get('gclid')||query.get('gbraid')||query.get('wbraid'))};
  try{await fetch('/api/landing-analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true})}catch{}
 },[]);
 useEffect(()=>{
  try{const saved=sessionStorage.getItem('stride_landing_session');sessionId.current=saved&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(saved)?saved:crypto.randomUUID();sessionStorage.setItem('stride_landing_session',sessionId.current)}catch{sessionId.current=crypto.randomUUID()}
  try{priorActiveMs.current=Math.min(14_400_000,Number(sessionStorage.getItem('stride_landing_active_ms'))||0)}catch{}
  if(document.visibilityState==='visible')visibleAt.current=Date.now();
  void track('page_view',page||window.location.pathname.replace(/^\/+|\/+$/g,'')||'landing');
  const measure=()=>{if(visibleAt.current!==null)activeMs.current+=Math.max(0,Date.now()-visibleAt.current);visibleAt.current=document.visibilityState==='visible'?Date.now():null;priorActiveMs.current=Math.min(14_400_000,priorActiveMs.current+activeMs.current);activeMs.current=0;try{sessionStorage.setItem('stride_landing_active_ms',String(priorActiveMs.current))}catch{}void track('engagement')};
  const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-track]'):null;if(target?.dataset.track)void track('click',target.dataset.track)};
  const scroll=()=>{const root=document.documentElement,range=Math.max(1,root.scrollHeight-window.innerHeight),next=Math.min(100,Math.round((window.scrollY/range)*100));maxScroll.current=Math.max(maxScroll.current,next);for(const mark of [25,50,75,100])if(maxScroll.current>=mark&&!sentMilestones.current.has(mark)){sentMilestones.current.add(mark);void track('scroll',String(mark))}};
  const flush=()=>{measure()};
  document.addEventListener('visibilitychange',measure);document.addEventListener('click',click,true);window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('pagehide',flush);const timer=window.setInterval(()=>void track('engagement'),15000);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',measure);document.removeEventListener('click',click,true);window.removeEventListener('scroll',scroll);window.removeEventListener('pagehide',flush);flush()};
 },[track,page]);
 return track;
}
