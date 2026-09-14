import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {accountDataId} from './admin-activity';

export const TEST_WORKSPACE_COOKIE='stride_test_workspace';
export async function isOwner(user:ChatGPTUser){
 const config=env as unknown as {SITE_OWNER_USER_ID?:string;SITE_OWNER_EMAIL_HASH?:string};
 if(config.SITE_OWNER_USER_ID&&user.userId===config.SITE_OWNER_USER_ID)return true;
 return !!config.SITE_OWNER_EMAIL_HASH&&await accountDataId(user)===config.SITE_OWNER_EMAIL_HASH;
}
export function requestedTestWorkspace(request:Request){return request.headers.get('cookie')?.split(';').some(part=>part.trim()===TEST_WORKSPACE_COOKIE+'=1')||false}
export async function accountScope(user:ChatGPTUser,request?:Request){
 const primary=await accountDataId(user),test=!!request&&requestedTestWorkspace(request)&&await isOwner(user);
 return {primary,id:test?primary+':test':primary,mode:test?'test' as const:'live' as const};
}
