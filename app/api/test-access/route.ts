import {env} from 'cloudflare:workers';
import {createStrideSessionCookie} from '@/app/chatgpt-auth';
import {legacyAccountId} from '@/lib/auth-identities';
import {adminDatabase} from '@/lib/admin-activity';
import {reviewerDemoData} from '@/lib/test-scenarios';
const TEST_EMAIL='test-operator@stride.local';
const REVIEWER_USERNAME='reviewer';
const MAX_ATTEMPTS=10,WINDOW_SECONDS=15*60;
async function hash(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function matches(left:string,right:string){const [a,b]=await Promise.all([hash(left),hash(right)]);let difference=0;for(let index=0;index<a.length;index+=1)difference|=a[index]^b[index];return difference===0}
async function allowAttempt(request:Request){
 const ip=request.headers.get('cf-connecting-ip')||'unknown',key=Array.from(await hash(ip),b=>b.toString(16).padStart(2,'0')).join(''),now=Math.floor(Date.now()/1000),db=adminDatabase();
 await db.prepare('CREATE TABLE IF NOT EXISTS test_access_attempts (key TEXT PRIMARY KEY,window_started INTEGER NOT NULL,attempts INTEGER NOT NULL)').run();
 const row=await db.prepare('INSERT INTO test_access_attempts (key,window_started,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_started=CASE WHEN test_access_attempts.window_started+?<=? THEN ? ELSE test_access_attempts.window_started END,attempts=CASE WHEN test_access_attempts.window_started+?<=? THEN 1 ELSE test_access_attempts.attempts+1 END RETURNING attempts').bind(key,now,WINDOW_SECONDS,now,now,WINDOW_SECONDS,now).first<{attempts:number}>();
 return (row?.attempts||MAX_ATTEMPTS+1)<=MAX_ATTEMPTS;
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Open test access from Stride.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>4096)return Response.json({error:'Request too large.'},{status:413});
 let payload:{username?:unknown;password?:unknown;code?:unknown};try{payload=await request.json() as typeof payload}catch{return Response.json({error:'Enter valid test credentials.'},{status:400})}
 if(!await allowAttempt(request))return Response.json({error:'Too many sign-in attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':'900','Cache-Control':'no-store'}});
 const config=env as unknown as {TEST_ACCESS_SECRET?:string;REVIEWER_DEMO_PASSWORD?:string},username=String(payload.username||''),password=typeof payload.password==='string'?payload.password:'',code=typeof payload.code==='string'?payload.code:'';
 const reviewerConfigured=!!config.REVIEWER_DEMO_PASSWORD&&config.REVIEWER_DEMO_PASSWORD.length>=32,reviewerMatch=reviewerConfigured&&username===REVIEWER_USERNAME&&await matches(password,config.REVIEWER_DEMO_PASSWORD!);
 const legacyConfigured=!!config.TEST_ACCESS_SECRET&&config.TEST_ACCESS_SECRET.length>=24,legacyMatch=legacyConfigured&&await matches(code||password,config.TEST_ACCESS_SECRET!);
 if(!reviewerMatch&&!legacyMatch){const configured=reviewerConfigured||legacyConfigured;return Response.json({error:configured?'Those test credentials are not valid.':'Test access is not configured.'},{status:configured?401:503,headers:{'Cache-Control':'no-store'}})}
 const accountId=await legacyAccountId(TEST_EMAIL);
 if(reviewerMatch){const db=adminDatabase(),now=new Date().toISOString(),demoId=accountId+':test';await db.prepare('INSERT OR IGNORE INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?)').bind(demoId,JSON.stringify(reviewerDemoData()),now).run()}
 const cookie=await createStrideSessionCookie({userId:'test:automation',accountId,accountType:'test',email:TEST_EMAIL,displayName:reviewerMatch?'Stride Demo Reviewer':'Test operator',fullName:null});
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}})
}
