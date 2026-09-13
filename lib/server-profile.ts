import {adminDatabase,accountDataId} from './admin-activity';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {profileSchema} from './profile';
export async function getCoachingProfile(user:ChatGPTUser){const row=await adminDatabase().prepare('SELECT data FROM user_training_data WHERE user_id = ?').bind(await accountDataId(user)).first<{data:string}>();const parsed=profileSchema.safeParse(row?JSON.parse(row.data).profile:null);return parsed.success?parsed.data:null}
