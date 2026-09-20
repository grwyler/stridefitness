import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {AdminJulieMigration} from '@/components/admin-julie-migration';
export const dynamic='force-dynamic';
export default async function MigrateJulie(){const user=await getChatGPTUser();if(!user)return <main><h1>Owner sign-in required</h1><a className="primary" href={chatGPTSignInPath('/admin/migrate-julie')} target="_top">Sign in</a></main>;if(!await isSiteOwner(user))return <main><h1>Owner access only</h1><p>Use the Stride owner account to continue.</p></main>;return <AdminJulieMigration/>}
