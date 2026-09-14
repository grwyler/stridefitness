import {adminDatabase,accountDataId} from './admin-activity';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {profileSchema} from './profile';
import {accountScope} from './account-scope';
export async function getCoachingProfile(user:ChatGPTUser,request?:Request){const row=await adminDatabase().prepare('SELECT data FROM user_training_data WHERE user_id = ?').bind((await accountScope(user,request)).id).first<{data:string}>();const parsed=profileSchema.safeParse(row?JSON.parse(row.data).profile:null);return parsed.success?parsed.data:null}

export async function getCoachContext(user:ChatGPTUser,request?:Request){
 const row=await adminDatabase().prepare('SELECT data FROM user_training_data WHERE user_id = ?').bind((await accountScope(user,request)).id).first<{data:string}>();if(!row)return null;
 const data=JSON.parse(row.data),profile=profileSchema.safeParse(data.profile);if(!profile.success)return null;
 const threads=Object.entries(data.coachChats||{}).map(([area,messages])=>({area,messages:(Array.isArray(messages)?messages:[]).slice(-30).map((m:any)=>({role:m.role,content:String(m.content||'').slice(0,1500)}))}));
 const legacySessions=(data.workouts||[]).filter((w:any)=>w.coachMessages?.length&&!data.coachChats?.['session:'+w.id]).slice(0,5).map((w:any)=>({area:'session:'+w.name,messages:w.coachMessages.slice(-6)}));
 return {...profile.data,conversationMemory:JSON.stringify([...threads,...legacySessions]).slice(-45000),trackedGoals:(data.goals||[]).filter((g:any)=>!g.archived),nutritionTargets:data.nutrition?{calories:data.nutrition.calorieTarget,protein:data.nutrition.proteinTarget}:null,memoryGuidance:'Use relevant earlier user statements across areas. Old assistant advice is not an accepted fact. Prefer the newest explicit correction and saved profile. Do not claim to recall details outside this context.'};
}
