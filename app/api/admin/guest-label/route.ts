import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {ensureLandingAnalyticsTables} from '@/lib/landing-analytics';
const input=z.object({accountId:z.string().regex(/^guest:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i),label:z.enum(['unclassified','owner_test','likely_visitor'])});
export async function POST(request:Request){
 const user=await getChatGPTUser(request);if(!user||!await isSiteOwner(user))return Response.json({error:'Owner access is required.'},{status:403});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Update labels from Stride.'},{status:403});
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Choose a valid guest label.'},{status:400});
 try{const db=await ensureLandingAnalyticsTables();await db.prepare('INSERT INTO guest_account_labels (account_id,label,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET label=excluded.label,updated_at=excluded.updated_at').bind(parsed.data.accountId,parsed.data.label,new Date().toISOString()).run();return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Guest label could not be saved. Please retry.'},{status:503})}
}
