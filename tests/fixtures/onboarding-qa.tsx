import React from 'react';
import {createRoot} from 'react-dom/client';
import {Onboarding} from '../../components/onboarding';
import {emptyOnboarding} from '../../lib/onboarding';
import '../../app/globals.css';
// Disposable UI fixture. Provider responses are simulated; production uses the real API.
const read=()=>JSON.parse(localStorage.getItem('stride-onboarding-ui-fixture')||'null');
window.fetch=async(input,options)=>{
 const url=String(input);
 if(url==='/api/ai-connection')return Response.json({connected:true,source:'included'});
 if(url==='/api/onboarding'){
 if(!options?.method)return Response.json(read()||{draft:emptyOnboarding(),updatedAt:null,accountUpdatedAt:null,complete:false});
 const b=JSON.parse(String(options.body)),stored={draft:b.draft,updatedAt:String(Date.now()),accountUpdatedAt:null,complete:!!b.complete};localStorage.setItem('stride-onboarding-ui-fixture',JSON.stringify(stored));return Response.json(stored);
 }
 if(url==='/api/plan')return Response.json({message:'For this UI test, two short dumbbell sessions fit the sample brief. Start with a comfortable load and keep the first session manageable.',workouts:[{name:'Your first full-body workout',description:'A short practice session. Leave a few comfortable reps in reserve and skip anything painful.',entries:[{exerciseId:'e6',sets:2,reps:8,weight:null},{exerciseId:'e7',sets:2,reps:10,weight:null}]}],saveUpdates:{profile:[{field:'goal',value:'Build strength'},{field:'days',value:'2'},{field:'equipment',value:'Dumbbells at home'},{field:'experience',value:'New to lifting'}],goal:null,nutrition:null,measurement:null},progress:null});
 return Response.json({error:'Unavailable in fixture'},{status:503});
};
createRoot(document.getElementById('root')!).render(<><p style={{padding:12,fontSize:14}}>Isolated onboarding UI test · simulated provider responses</p><Onboarding onDone={intent=>{document.getElementById('root')!.textContent='Setup completed. Next action: '+intent}}/></>);
