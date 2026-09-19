import {isSiteOwner} from '@/lib/ai-connection';
import {recordActivity} from '@/lib/admin-activity';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {accountScope} from '@/lib/account-scope';
export async function GET(request:Request){const user=await getChatGPTUser(request);if(user)await recordActivity(user);const admin=!!user&&!!user.email&&await isSiteOwner(user),scope=user?await accountScope(user,request):null;const appSession=user&&["google","email","guest"].includes(user.accountType||"");return Response.json(user?{signedIn:true,isAdmin:admin,testWorkspace:admin&&scope?.mode==='test',name:user.fullName||user.displayName,email:user.email||null,accountType:user.accountType||'chatgpt',signOutUrl:appSession?'/api/auth/google/signout':chatGPTSignOutPath('/')}:{signedIn:false,signInUrl:chatGPTSignInPath('/')},{headers:{'Cache-Control':'no-store'}})}
