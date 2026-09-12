import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase,includedAiByDefault} from '@/lib/admin-activity';
import {ResetUserButton} from '@/components/reset-user-button';
import {AdminFeedback} from '@/components/admin-feedback';
import {AdminAiPolicy} from '@/components/admin-ai-policy';
export const dynamic='force-dynamic';
const when=(value:string|null)=>value?new Date(value).toLocaleString('en-US',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC':'Not recorded';
export default async function Admin({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const user=await getChatGPTUser();
 if(!user)return <main><h1>Admin sign-in</h1><p>Sign in with the Stride owner account.</p><a className="primary" href={chatGPTSignInPath('/admin')} target="_top">Sign in</a></main>;
 if(!await isSiteOwner(user))return <main><h1>Owner access only</h1><p>This page is available only to the Stride owner.</p><a href="/">Back to Stride</a></main>;
 const params=await searchParams,q=(params.q||'').slice(0,100),page=Math.max(1,Math.min(100000,Number.parseInt(params.page||'1')||1));
 try{
 const db=adminDatabase(),aiDefault=await includedAiByDefault();
 const base=`WITH ids AS (SELECT user_id FROM site_users UNION SELECT user_id FROM user_training_data) SELECT ids.user_id,p.name,p.email,p.first_seen,p.last_seen,p.ai_requests,p.last_ai_at,t.data,t.updated_at,(b.user_id IS NOT NULL OR COALESCE(f.included,1) = 0) AS ai_revoked FROM ids LEFT JOIN site_users p ON p.user_id=ids.user_id LEFT JOIN user_training_data t ON t.user_id=ids.user_id LEFT JOIN ai_access_blocks b ON b.user_id=ids.user_id LEFT JOIN ai_account_funding f ON f.user_id=ids.user_id`;
 const result=await db.prepare(base+" WHERE (?='' OR instr(lower(COALESCE(p.name,'')||' '||COALESCE(p.email,'')),lower(?))>0) ORDER BY COALESCE(p.last_seen,t.updated_at) DESC LIMIT 51 OFFSET ?").bind(q,q,(page-1)*50).all<any>();
 const total=await db.prepare('SELECT COUNT(*) AS count FROM (SELECT user_id FROM site_users UNION SELECT user_id FROM user_training_data)').first<{count:number}>();
 return <main className="admin-page"><a className="text-button" href="/">← Back to Stride</a><div className="page-heading"><div><span className="eyebrow">OWNER ADMIN</span><h1>Users & activity</h1><p>{total?.count||0} known accounts · Updated when you refresh this page</p></div><a className="secondary" href={'/admin?q='+encodeURIComponent(q)}>Refresh</a></div><p className="notice">Names, visits, and AI request counts are recorded from this update onward. Earlier accounts appear from saved training data; identity fills in when they next visit. Guest activity is not attributed to an account.</p><AdminAiPolicy initialIncluded={aiDefault}/><AdminFeedback/><form className="admin-search"><label htmlFor="admin-search">Find a user</label><input id="admin-search" name="q" defaultValue={q} placeholder="Name or email"/><button className="primary">Search</button></form><div className="admin-users">{result.results.slice(0,50).map(row=>{
 let data:any={};try{data=JSON.parse(row.data||'{}')}catch{}
 const workouts:any[]=Array.isArray(data.workouts)?data.workouts.filter((w:any)=>w&&typeof w==='object'):[],templates=Array.isArray(data.templates)?data.templates.length:0,completed=workouts.filter(w=>w.completed).length;
 const displayName=row.name||data.user?.name||'this account';
 return <article className="panel admin-user" key={row.user_id}><div><h2>{row.name||data.user?.name||'Earlier account'}</h2><p>{row.email||'Email available after their next visit'}</p></div><div className="admin-metrics"><span><b>{completed}</b> workouts completed</span><span><b>{workouts.length-completed}</b> unfinished</span><span><b>{templates}</b> templates</span><span><b>{row.ai_requests||0}</b> AI requests</span></div><p>Last visit: {when(row.last_seen)} · Last sync: {when(row.updated_at)}</p><details><summary>View activity</summary><p>First observed: {when(row.first_seen)}<br/>Last AI request: {when(row.last_ai_at)}</p><h3>Recent saved workouts</h3>{workouts.length?workouts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10).map((w,i)=><div className="admin-workout" key={i}><strong>{typeof w.name==='string'?w.name:'Workout'}</strong><span>{w.completed?'Completed':'Unfinished'} · {when(w.date||null)}</span></div>):<p>No synced workouts yet.</p>}</details><ResetUserButton userId={row.user_id} name={displayName} aiRevoked={!!row.ai_revoked}/></article>
 })}</div>{!result.results.length&&<p className="empty">No accounts match this search.</p>}<nav className="button-group" aria-label="User pages">{page>1&&<a className="secondary" href={'/admin?q='+encodeURIComponent(q)+'&page='+(page-1)}>Previous</a>}<span>Page {page}</span>{result.results.length>50&&<a className="secondary" href={'/admin?q='+encodeURIComponent(q)+'&page='+(page+1)}>Next</a>}</nav></main>
 }catch{return <main><h1>Users & activity</h1><p>Activity is temporarily unavailable. Please refresh to try again.</p><a href="/">Back to Stride</a></main>}
}
