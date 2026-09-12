import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {connectStripe,disconnectStripe,stripeConnectionStatus,StripeConnectionError} from '@/lib/stripe-connection';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function owner(request:Request){const user=await getChatGPTUser(request);return !!user&&await isSiteOwner(user)}
export async function GET(request:Request){if(!await owner(request))return json({error:'Owner access is required.'},403);try{return json(await stripeConnectionStatus())}catch{return json({error:'Stripe connection settings are unavailable.'},503)}}
export async function POST(request:Request){
 if(!await owner(request))return json({error:'Owner access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Update the connection from Stride.'},403);
 try{
  const raw=await request.text();if(raw.length>8192)return json({error:'This key is too long.'},400);
  const body=JSON.parse(raw) as {key?:unknown},key=typeof body?.key==='string'?body.key.trim():'';
  if(!/^rk_test_[A-Za-z0-9_]{20,}$/.test(key))return json({error:'Paste a Stripe sandbox restricted key beginning with rk_test_.'},400);
  return json(await connectStripe(key));
 }catch(error){return json({error:error instanceof StripeConnectionError?error.message:'Could not verify and save the Stripe key.'},error instanceof StripeConnectionError?400:503)}
}
export async function DELETE(request:Request){if(!await owner(request))return json({error:'Owner access is required.'},403);if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Update the connection from Stride.'},403);try{await disconnectStripe();return json(await stripeConnectionStatus())}catch{return json({error:'Could not remove the saved Stripe key.'},503)}}
