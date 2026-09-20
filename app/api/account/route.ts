import {isSiteOwner} from '@/lib/ai-connection';
import {recordActivity} from '@/lib/admin-activity';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {accountScope,canUseTestWorkspace} from '@/lib/account-scope';
export async function GET(request:Request){const user=await getChatGPTUser(request);if(user)await recordActivity(user);const admin=!!user&&!!user.email&&await isSiteOwner(user),testAccess=!!user&&await canUseTestWorkspace(user),scope=user?await accountScope(user,request):null;return Response.json(user?{signedIn:true,isAdmin:admin,testWorkspace:testAccess&&scope?.mode==='test',name:user.fullName||user.displayName,email:user.email||null,accountType:user.accountType||'chatgpt',signOutUrl:'/api/auth/signout'}:{signedIn:false,signInUrl:chatGPTSignInPath('/')},{headers:{'Cache-Control':'no-store'}})}
