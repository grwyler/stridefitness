import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {connectMetronome,disconnectMetronome,getMetronomeConnection,metronomeConnectionStatus,MetronomeConnectionError} from '@/lib/metronome-connection';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function owner(request:Request){const user=await getChatGPTUser(request);return !!user&&await isSiteOwner(user)}
export async function GET(request:Request){
 if(!await owner(request))return json({error:'Owner access is required.'},403);
 try{return json(await metronomeConnectionStatus())}catch{return json({error:'Billing connection settings are unavailable. Please try again.'},503)}
}
export async function POST(request:Request){
 if(!await owner(request))return json({error:'Owner access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Update the connection from Stride.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Invalid connection request.'},400);
 try{
  const raw=await request.text();if(raw.length>8192)return json({error:'This token is too long.'},400);
  const body=JSON.parse(raw) as {token?:unknown;action?:unknown};
  if(body?.action==='check'){
   const saved=await getMetronomeConnection();
   if(!saved)return json({error:'Save your Metronome sandbox token first.'},400);
   return json(await connectMetronome(saved.token));
  }
  const token=typeof body?.token==='string'?body.token.trim():'';
  if(token.length<20||token.length>4096||/\s/.test(token))return json({error:'Paste the complete Metronome API token.'},400);
  return json(await connectMetronome(token));
 }catch(error){
  if(error instanceof SyntaxError)return json({error:'Invalid connection request.'},400);
  return json({error:error instanceof MetronomeConnectionError?error.message:'Could not verify and save the connection. Please try again.'},error instanceof MetronomeConnectionError?400:503);
 }
}
export async function DELETE(request:Request){
 if(!await owner(request))return json({error:'Owner access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Update the connection from Stride.'},403);
 try{await disconnectMetronome();return json(await metronomeConnectionStatus())}catch{return json({error:'Could not remove the saved token. Please try again.'},503)}
}
