import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase,includedAiByDefault} from '@/lib/admin-activity';
import {ResetUserButton} from '@/components/reset-user-button';
import {AdminFeedback} from '@/components/admin-feedback';
import {AdminBillingSetup} from '@/components/admin-billing-setup';
import {AdminAiPolicy} from '@/components/admin-ai-policy';
import {AdminWorkoutCalories} from '@/components/admin-workout-calories';
import {AdminLandingAnalytics} from '@/components/admin-landing-analytics';
import {GuestAccountLabel} from '@/components/guest-account-label';
import {LocalTime} from '@/components/local-time';
import {ensureLandingAnalyticsTables,landingAnalyticsReport} from '@/lib/landing-analytics';
export const dynamic='force-dynamic';
type AdminView='users'|'analytics'|'feedback'|'settings';
const adminViews:{id:AdminView;label:string;description:string}[]=[
 {id:'users',label:'Users',description:'Accounts, activity, and access'},
 {id:'analytics',label:'Landing analytics',description:'Ad visits, trials, and sign-ups'},
 {id:'feedback',label:'Feedback',description:'Bug reports and requests'},
 {id:'settings',label:'Settings',description:'AI access and billing connections'},
];
export default async function Admin({searchParams}:{searchParams:Promise<{q?:string;page?:string;view?:string}>}){
 const user=await getChatGPTUser();
 if(!user)return <main><h1>Admin sign-in</h1><p>Sign in with the Stride owner account.</p><a className="primary" href={chatGPTSignInPath('/admin')} target="_top">Sign in</a></main>;
 if(!await isSiteOwner(user))return <main><h1>Owner access only</h1><p>This page is available only to the Stride owner.</p><a href="/">Back to Stride</a></main>;
 const params=await searchParams,view:AdminView=adminViews.some(item=>item.id===params.view)?params.view as AdminView:'users',q=(params.q||'').slice(0,100),page=Math.max(1,Math.min(100000,Number.parseInt(params.page||'1')||1));
 const viewHref=(id:AdminView)=>id==='users'?'/admin':'/admin?view='+id;
 const header=<><a className="text-button" href="/">← Back to Stride</a><div className="page-heading"><div><span className="eyebrow">OWNER ADMIN</span><h1>Admin</h1><p>Manage Stride without losing your place.</p></div></div><nav className="admin-nav" aria-label="Admin sections">{adminViews.map(item=><a key={item.id} className={view===item.id?'admin-nav-active':'admin-nav-link'} href={viewHref(item.id)} aria-current={view===item.id?'page':undefined}><span>{item.label}</span><small>{item.description}</small></a>)}</nav></>;
 if(view==='feedback')return <main className="admin-page">{header}<section className="admin-section-heading"><h2>Feedback inbox</h2><p>Review reports and change requests separately from account management.</p></section><AdminFeedback/></main>;
 if(view==='analytics')try{return <main className="admin-page">{header}<AdminLandingAnalytics report={await landingAnalyticsReport()}/></main>}catch{return <main className="admin-page">{header}<p className="notice">Landing page analytics are temporarily unavailable. Please refresh to try again.</p></main>}
 if(view==='settings'){
  const aiDefault=await includedAiByDefault();
  return <main className="admin-page">{header}<section className="admin-section-heading"><h2>Settings</h2><p>Control default AI access and sandbox billing connections.</p></section><div className="admin-settings-stack"><AdminAiPolicy initialIncluded={aiDefault}/><AdminBillingSetup/></div></main>;
 }
 try{
 const db=adminDatabase();await ensureLandingAnalyticsTables();
 const base=`WITH ids AS (SELECT user_id FROM site_users UNION SELECT user_id FROM user_training_data UNION SELECT id AS user_id FROM stride_users) SELECT ids.user_id,p.name,p.email,p.first_seen,p.last_seen,p.ai_requests,p.last_ai_at,t.data,t.updated_at,(b.user_id IS NOT NULL OR COALESCE(f.included,1) = 0) AS ai_revoked,su.account_type,su.created_at AS account_created_at,su.last_active_at,su.converted_at,gl.label AS guest_label,(SELECT COUNT(*) FROM landing_sessions ls WHERE ls.guest_account_id=ids.user_id) AS landing_trials FROM ids LEFT JOIN site_users p ON p.user_id=ids.user_id LEFT JOIN user_training_data t ON t.user_id=ids.user_id LEFT JOIN ai_access_blocks b ON b.user_id=ids.user_id LEFT JOIN ai_account_funding f ON f.user_id=ids.user_id LEFT JOIN stride_users su ON su.id=ids.user_id LEFT JOIN guest_account_labels gl ON gl.account_id=ids.user_id`;
 const result=await db.prepare(base+" WHERE (?='' OR instr(lower(COALESCE(p.name,'')||' '||COALESCE(p.email,'')||' '||ids.user_id),lower(?))>0) ORDER BY COALESCE(su.last_active_at,p.last_seen,t.updated_at) DESC LIMIT 51 OFFSET ?").bind(q,q,(page-1)*50).all<any>();
 const total=await db.prepare('SELECT COUNT(*) AS count FROM (SELECT user_id FROM site_users UNION SELECT user_id FROM user_training_data UNION SELECT id AS user_id FROM stride_users)').first<{count:number}>();
 return <main className="admin-page">{header}<div className="admin-section-heading admin-users-heading"><div><h2>Users & activity</h2><p>{total?.count||0} known accounts · Updated when you refresh this page</p></div><a className="secondary" href={'/admin?q='+encodeURIComponent(q)}>Refresh</a></div><p className="notice">Guest trials have a unique guest ID. Set its label to “My test account” or “Likely visitor” as you identify it; new and older guests start as “Not sure yet.”</p><form className="admin-search"><label htmlFor="admin-search">Find a user</label><input id="admin-search" name="q" defaultValue={q} placeholder="Name or email or guest ID"/><button className="primary">Search</button></form><div className="admin-users">{result.results.slice(0,50).map(row=>{
 let data:any={};try{data=JSON.parse(row.data||'{}')}catch{}
 const workouts:any[]=Array.isArray(data.workouts)?data.workouts.filter((w:any)=>w&&typeof w==='object'):[],templates=Array.isArray(data.templates)?data.templates.length:0,completed=workouts.filter(w=>w.completed).length;
 const displayName=row.account_type==='guest'?`Guest · ${String(row.user_id).slice(-8)}`:row.name||data.user?.name||'this account',missingCalories=workouts.filter((w:any)=>w.completed&&w.caloriesBurned===undefined).map((w:any)=>({id:w.id,name:typeof w.name==='string'?w.name:'Workout'}));
 return <article className="panel admin-user" key={row.user_id}><div><h2>{row.account_type==='guest'?`Guest · ${String(row.user_id).slice(-8)}`:row.name||data.user?.name||'Earlier account'}</h2><p>{row.account_type==='guest'?'No email · guest account':row.email||'Email available after their next visit'}</p></div>{row.account_type==='guest'&&<><p className="guest-account-id">Guest ID: {row.user_id} · Created <LocalTime value={row.account_created_at}/> · Last active <LocalTime value={row.last_active_at}/> · Landing trials: {row.landing_trials||0}</p><GuestAccountLabel accountId={row.user_id} initialLabel={row.guest_label||'unclassified'}/></>}<div className="admin-metrics"><span><b>{completed}</b> workouts completed</span><span><b>{workouts.length-completed}</b> unfinished</span><span><b>{templates}</b> templates</span><span><b>{row.ai_requests||0}</b> AI requests</span></div><p>Last visit: <LocalTime value={row.last_seen}/> · Last sync: <LocalTime value={row.updated_at}/></p><AdminWorkoutCalories userId={row.user_id} workouts={missingCalories}/><details><summary>View activity</summary><p>First observed: <LocalTime value={row.first_seen}/><br/>Last AI request: <LocalTime value={row.last_ai_at}/></p><h3>Recent saved workouts</h3>{workouts.length?workouts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10).map((w,i)=><div className="admin-workout" key={i}><strong>{typeof w.name==='string'?w.name:'Workout'}</strong><span>{w.completed?'Completed':'Unfinished'} · <LocalTime value={w.date||null}/>{w.caloriesBurned===undefined?' · calories not recorded':` · ${w.caloriesBurned} kcal`}</span></div>):<p>No synced workouts yet.</p>}</details><ResetUserButton userId={row.user_id} name={displayName} aiRevoked={!!row.ai_revoked}/></article>
 })}</div>{!result.results.length&&<p className="empty">No accounts match this search.</p>}<nav className="button-group" aria-label="User pages">{page>1&&<a className="secondary" href={'/admin?q='+encodeURIComponent(q)+'&page='+(page-1)}>Previous</a>}<span>Page {page}</span>{result.results.length>50&&<a className="secondary" href={'/admin?q='+encodeURIComponent(q)+'&page='+(page+1)}>Next</a>}</nav></main>
 }catch{return <main><h1>Users & activity</h1><p>Activity is temporarily unavailable. Please refresh to try again.</p><a href="/">Back to Stride</a></main>}
}
