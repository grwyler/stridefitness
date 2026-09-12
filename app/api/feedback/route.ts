import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase,accountDataId} from '@/lib/admin-activity';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const schema=z.object({message:z.string().trim().min(1).max(5000),area:z.string().max(80),screenshots:z.array(z.string().max(1500000).regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/)).max(3)});
const bucket=()=>{const b=(env as unknown as {FILES?:R2Bucket}).FILES;if(!b)throw new Error('Uploads unavailable');return b};
export async function POST(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Please sign in to send feedback.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Please send feedback from Stride.'},403);
 try{const raw=await request.text();if(raw.length>4600000)return json({error:'Attachments are too large.'},413);const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Add a message and up to three screenshots.'},400);
 const {message,area,screenshots}=parsed.data,id=crypto.randomUUID(),db=adminDatabase(),key='feedback/'+id;
 if(screenshots.length)await bucket().put(key,JSON.stringify(screenshots),{httpMetadata:{contentType:'application/json'}});
 try{await db.prepare('INSERT INTO feedback (id,user_id,name,email,message,area,created_at,screenshot_count) VALUES (?,?,?,?,?,?,?,?)').bind(id,await accountDataId(user),user.fullName||user.displayName||user.email,user.email,message,area,new Date().toISOString(),screenshots.length).run()}catch(e){if(screenshots.length)await bucket().delete(key);throw e}
 return json({saved:true});
 }catch{return json({error:'Feedback could not be saved. Your draft is still here; please try again.'},503)}
}
export async function GET(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in required.'},401);
 if(new URL(request.url).searchParams.get('mine')==='1'){try{const rows=await adminDatabase().prepare("SELECT id,message,area,notified_at FROM feedback WHERE user_id=? AND status='awaiting' ORDER BY notified_at DESC").bind(await accountDataId(user)).all();return json({items:rows.results})}catch{return json({error:'Feedback updates unavailable.'},503)}}
 if(!await isSiteOwner(user))return json({error:'Owner access required.'},403);
 try{const url=new URL(request.url),id=url.searchParams.get('id');if(id){if(!z.string().uuid().safeParse(id).success)return json({error:'Invalid submission.'},400);const row=await adminDatabase().prepare('SELECT id,screenshot_count FROM feedback WHERE id=?').bind(id).first<{id:string;screenshot_count:number}>();if(!row)return json({error:'Feedback no longer exists.'},404);if(!row.screenshot_count)return json({screenshots:[]});const object=await bucket().get('feedback/'+id);if(!object)return json({error:'Screenshots unavailable.'},404);return json({screenshots:await object.json()})}
 const page=Math.max(0,Number.parseInt(url.searchParams.get('page')||'0')||0),archived=url.searchParams.get('archived')==='1',cutoff=new Date(Date.now()-7*86400000).toISOString(),archiveCondition="(status='resolved' OR (status='awaiting' AND notified_at<=?))",rows=await adminDatabase().prepare(`SELECT id,name,email,message,area,created_at,screenshot_count,notified_at,responded_at,followups,CASE WHEN status='awaiting' AND notified_at<=? THEN 'expired' ELSE status END AS status FROM feedback WHERE ${archived?'':'NOT '}${archiveCondition} ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?`).bind(cutoff,cutoff,page*20).all();return json({items:rows.results.slice(0,20),hasMore:rows.results.length>20});
 }catch{return json({error:'Feedback is temporarily unavailable.'},503)}
}
export async function DELETE(request:Request){
 const user=await getChatGPTUser(request);if(!user||!await isSiteOwner(user))return json({error:'Owner access required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Please delete feedback from Stride.'},403);
 const id=new URL(request.url).searchParams.get('id');if(!z.string().uuid().safeParse(id).success)return json({error:'Invalid submission.'},400);
 try{const row=await adminDatabase().prepare('SELECT screenshot_count FROM feedback WHERE id=?').bind(id).first<{screenshot_count:number}>();if(row?.screenshot_count)await bucket().delete('feedback/'+id);await adminDatabase().prepare('DELETE FROM feedback WHERE id=?').bind(id).run();return json({deleted:true})}catch{return json({error:'Feedback could not be deleted. Please try again.'},503)}
}

export async function PATCH(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in required.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Please respond from Stride.'},403);
 const parsed=z.object({id:z.string().uuid(),action:z.enum(['notify','resolved','unresolved']),notifiedAt:z.string().optional(),comment:z.string().trim().max(5000).optional()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({error:'Invalid feedback action.'},400);
 try{const {id,action,notifiedAt,comment}=parsed.data,db=adminDatabase(),now=new Date().toISOString();
 if(action==='notify'){
 if(!await isSiteOwner(user))return json({error:'Owner access required.'},403);
 const result=await db.prepare("UPDATE feedback SET status='awaiting',notified_at=?,responded_at=NULL WHERE id=? AND status IN ('open','unresolved')").bind(now,id).run();if(!result.meta.changes)return json({error:'This request is already awaiting a response, archived, or deleted. Refresh the inbox.'},409);
 }else{
 if(action==='unresolved'&&!comment)return json({error:'Please explain what still needs fixing.'},400);
 const result=await db.prepare("UPDATE feedback SET status=?,responded_at=?,followups=json_insert(followups,'$[#]',json(?)) WHERE id=? AND user_id=? AND status='awaiting' AND notified_at=?").bind(action,now,JSON.stringify({date:now,resolved:action==='resolved',comment:comment||''}),id,await accountDataId(user),notifiedAt||'').run();if(!result.meta.changes)return json({error:'This update has changed or was already answered. Refresh and try again.'},409);
 }
 return json({saved:true});
 }catch{return json({error:'The feedback update could not be saved. Please try again.'},503)}
}
