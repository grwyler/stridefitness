import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {hasAiAccess,recordActivity} from '@/lib/admin-activity';
import {consumeSharedAllowance,getSharedConnectionKey,getUserConnectionKey} from '@/lib/ai-connection';
import {classifyAIError} from '@/lib/ai-errors';

const inputSchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(4000)})).min(1).max(12),exercises:z.array(z.object({name:z.string().max(100),category:z.string().max(100),mode:z.enum(['weight','reps','volume'])})).max(1000)});
const proposal={type:['object','null'],properties:{name:{type:'string'},category:{type:'string'},mode:{type:'string',enum:['weight','reps','volume']},increment:{type:'number'},baseWeight:{type:'number'},baseReps:{type:'integer'},baseSets:{type:'integer'}},required:['name','category','mode','increment','baseWeight','baseReps','baseSets'],additionalProperties:false};
const outputSchema={type:'object',properties:{message:{type:'string'},proposal},required:['message','proposal'],additionalProperties:false};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Please use your exercise coach from Stride.'},403);
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in with ChatGPT to use your exercise coach.',signInUrl:chatGPTSignInPath('/')},401);
 if(!await hasAiAccess(user))return json({error:'AI access has been disabled for this Stride account.'},403);
 const settings=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
 try{
  const personalKey=await getUserConnectionKey(user),sharedKey=personalKey?null:await getSharedConnectionKey(),apiKey=personalKey||sharedKey||settings.OPENAI_API_KEY;
  if(!apiKey)return json({error:'AI is not configured for this account yet.'},503);
  if(sharedKey&&!await consumeSharedAllowance(request))return json({error:'You have reached today’s shared AI limit. Please try again tomorrow.'},429);
  const raw=await request.text();if(raw.length>500000)return json({error:'That request is too long.'},413);
  const parsed=inputSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Please shorten your question and try again.'},400);
  await recordActivity(user,true);
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({model:settings.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:1600,instructions:'You are Stride’s concise exercise coach. Answer questions about exercise selection, technique, muscles trained, equipment, and alternatives. Do not diagnose injuries; if pain or alarming symptoms are described, advise stopping and seeking appropriate professional care. When the user wants a movement not already in the supplied library, propose one exercise record for approval. Ask one focused question first when equipment, movement, or progression is unclear. Never create duplicates. Use mode weight when load is the normal progression, reps for bodyweight or fixed-load movements, and volume when adding sets is most appropriate. Set safe generic defaults only: baseWeight 0 unless the user explicitly gives a starting load; baseReps 8 and baseSets 3 unless the movement clearly requires another conventional starting point; increment 5 for weighted upper-body, 10 for weighted lower-body, or 1 for reps/volume. Return proposal null for explanation-only questions. Never claim an exercise was saved.',input:[{role:'developer',content:JSON.stringify({existingExercises:parsed.data.exercises})},...parsed.data.messages],text:{format:{type:'json_schema',name:'exercise_coach',strict:true,schema:outputSchema}}})});
  if(!response.ok){const failure=await response.json().catch(()=>({})) as {error?:{code?:string;type?:string;message?:string}};const problem=classifyAIError(response.status,failure,response.headers.get('retry-after'));return json(problem,response.status===429?429:502)}
  const result=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};if(result.status!=='completed')return json({error:'Your exercise coach could not finish. Please try again.'},502);
  const text=result.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');return json(JSON.parse(text||''));
 }catch(error){return json({error:error instanceof SyntaxError?'Please send a valid question.':'Your exercise coach is unavailable right now.'},error instanceof SyntaxError?400:502)}
}
