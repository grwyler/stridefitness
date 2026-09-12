import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {completeTopUp} from '@/lib/billing';
export async function GET(request:Request){const user=await getChatGPTUser(request);if(!user)return Response.redirect(new URL(chatGPTSignInPath('/'),request.url));try{await completeTopUp(user,new URL(request.url).searchParams.get('session_id')||'');return Response.redirect(new URL('/?billing=success',request.url))}catch{return Response.redirect(new URL('/?billing=failed',request.url))}}
