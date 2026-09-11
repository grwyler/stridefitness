import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
export async function GET(request:Request){const user=await getChatGPTUser(request);return Response.json(user?{signedIn:true,name:user.fullName||user.displayName,email:user.email,signOutUrl:chatGPTSignOutPath('/')}:{signedIn:false,signInUrl:chatGPTSignInPath('/')},{headers:{'Cache-Control':'no-store'}})}
