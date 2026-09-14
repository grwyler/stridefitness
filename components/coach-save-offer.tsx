 'use client';
import {useState} from 'react';
import {useCoachMemory} from './coach-memory';
import {applyOffer} from '@/lib/coach-offer';
export function CoachSaveOffer({area}:{area:string}){const {offer,data,change,stage}=useCoachMemory(area);const [error,setError]=useState('');if(!offer)return null;return <div className="session-proposal"><strong>Earlier proposed updates</strong><button className="secondary" onClick={()=>{try{stage('offer',data,applyOffer(data,offer),'Earlier coach updates');change(d=>({...d,coachOffers:{...d.coachOffers,[area]:null}}))}catch(e){setError((e as Error).message)}}}>Review pending updates</button>{error&&<p role="alert">{error}</p>}</div>}
