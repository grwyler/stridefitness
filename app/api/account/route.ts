import {isSiteOwner} from '@/lib/ai-connection';
import {recordActivity} from '@/lib/admin-activity';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
export async function GET(request:Request){const user=await getChatGPTUser(request);if(user)await recordActivity(user);return Response.json(user?{signedIn:true,isAdmin:await isSiteOwner(user),name:user.fullName||user.displayName,email:user.email,signOutUrl:chatGPTSignOutPath('/')}:{signedIn:false,signInUrl:chatGPTSignInPath('/')},{headers:{'Cache-Control':'no-store'}})}
