import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {billingStatus} from '@/lib/billing';
export async function GET(request:Request){const user=await getChatGPTUser(request);if(!user)return Response.json({error:'Sign in to view billing.',signInUrl:chatGPTSignInPath('/')},{status:401});try{return Response.json(await billingStatus(user),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Billing is temporarily unavailable.'},{status:503})}}

