import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {hasUserConnection,saveUserConnection,removeUserConnection,hasSharedConnection,isSiteOwner} from '@/lib/ai-connection';
import {hasAiAccess} from '@/lib/admin-activity';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await getChatGPTUser(request);try{const shared=await hasSharedConnection();if(!user)return json({connected:false,shared:false,canShare:false});if(!await hasAiAccess(user))return json({connected:false,shared:false,canShare:false,accessRevoked:true});return json({connected:await hasUserConnection(user)||shared,shared,canShare:await isSiteOwner(user)})}catch{return json({error:'Connection settings are temporarily unavailable. Please try again.'},503)}
}
async function mutate(request:Request,remove=false){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in with ChatGPT to connect AI.',signInUrl:chatGPTSignInPath('/?connectAI=1')},401);
 if(!await hasAiAccess(user))return json({error:'AI access has been disabled for this Stride account.'},403);
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)return json({error:'Please update your connection from Stride.'},403);
 try{
  if(remove){await removeUserConnection(user);return json({connected:false})}
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Invalid connection request.'},400);
  const raw=await request.text();if(raw.length>4096)return json({error:'Please enter a valid OpenAI API key.'},400);
  const body=JSON.parse(raw);const key=typeof body.apiKey==='string'?body.apiKey.trim():'';
  if(!/^sk-[A-Za-z0-9_-]{20,2000}$/.test(key))return json({error:'Enter the complete secret key beginning with sk-.'},400);
  await saveUserConnection(user,key);return json({connected:true});
 }catch{return json({error:'Could not save the connection. Please try again.'},503)}
}
export async function POST(request:Request){return mutate(request)}
export async function DELETE(request:Request){return mutate(request,true)}
