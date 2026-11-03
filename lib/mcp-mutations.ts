import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { profileSchema } from '@/lib/profile';
import { validateOperation, changes, operationSchema } from '@/lib/account-operations';
import type { Data, Template } from '@/lib/training';

type Args = Record<string, unknown>;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const time=Date.parse(`${value}T00:00:00Z`);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value; }, 'Use a valid YYYY-MM-DD date.');
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const number = (min: number, max: number) => z.number().finite().min(min).max(max);
const base = z.object({ mutationId: z.string().uuid(), expectedRevision: z.string().min(1).max(64).nullable() });
const profiles = profileSchema.partial();
const goalInput = z.object({ title: z.string().trim().min(1).max(100), kind: z.enum(['measurement','daily','sessions','strength','compound','milestone']), unit: z.string().trim().min(1).max(20), start: number(-100000,100000), target: number(-100000,100000), started: day, deadline: day.optional().default(''), exerciseId: id.optional(), measurementMetric: z.enum(['weight','bodyFat']).optional(), dailyMetric: z.enum(['hydration','activeCalories','protein','calorieIntake']).optional() }).superRefine((value, ctx) => {
  if (value.kind === 'strength' && !value.exerciseId) ctx.addIssue({ code: 'custom', path: ['exerciseId'], message: 'A strength goal needs an existing exercise ID.' });
  if (value.kind !== 'strength' && value.exerciseId) ctx.addIssue({ code: 'custom', path: ['exerciseId'], message: 'Only strength goals use exerciseId.' });
  if (value.kind === 'daily' && !value.dailyMetric) ctx.addIssue({ code: 'custom', path: ['dailyMetric'], message: 'A daily goal needs a supported daily metric.' });
  if (value.kind !== 'daily' && value.dailyMetric) ctx.addIssue({ code: 'custom', path: ['dailyMetric'], message: 'dailyMetric is only used for daily goals.' });
  if (value.deadline && value.deadline < value.started) ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Deadline must be on or after the start date.' });
});
const tier=z.object({order:number(1,20).int(),targetWeight:number(0,2000),minReps:number(1,100).int(),maxReps:number(1,100).int(),targetRir:number(0,10).optional()});
const prescription=z.object({id:id.optional(),role:z.enum(['unclassified','warmup','ramp','working','top','backoff','amrap','technique','drop']),countsTowardProgression:z.boolean(),targetWeight:number(0,2000),minReps:number(1,100).int(),maxReps:number(1,100).int(),repTargetMode:z.enum(['range','amrap']).optional(),targetRir:number(0,10).optional(),targetRpe:number(1,10).optional(),group:z.string().max(80).optional(),tiers:z.array(tier).max(20).optional()});
const entryInput = z.object({ exerciseId: id, weight: number(0,2000).default(0), reps: number(1,100).int().default(8), sets: number(1,20).int().default(3), repScheme: z.array(number(1,100).int()).max(100).optional(), setPrescriptions:z.array(prescription).max(100).optional(), setScheme: z.enum(['straight','ascending_pyramid','reverse_pyramid','amrap','drop_multi_tier']).optional(), repRange: z.object({min:number(1,100).int(),max:number(1,100).int()}).refine(v=>v.max>=v.min).optional(), progressionPolicy: z.object({kind:z.enum(['fixed','rep_range']),scope:z.enum(['group','independent']).optional(),advanceBy:z.enum(['auto','load','reps','sets']).optional(),successSessions:number(1,5).int().optional(),failureAction:z.enum(['hold','reduce_load','reduce_volume']).optional()}).optional() });
const templateInput = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).default(''), entries: z.array(entryInput).min(1).max(20) });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const db = () => { const database = (env as unknown as { DB?: D1Database }).DB; if (!database) throw new Error('Stride account storage is unavailable.'); return database; };
const blank = (): Data => ({ user: { id:'account', name:'Stride account' }, exercises:[], workouts:[], templates:[], overrides:{}, dark:false });
function uniqueId(prefix: string) { return `${prefix}_${crypto.randomUUID().replace(/-/g,'')}`; }

async function commit(accountId: string, args: Args, action: 'progress'|'offer'|'template', update: (data: Data) => { next: Data; value: unknown }) {
  const parsed = base.safeParse(args); if (!parsed.success) throw new Error('Provide a unique mutationId and the latest expectedRevision returned by a Stride read tool.');
  const database = db();
  await database.prepare('CREATE TABLE IF NOT EXISTS mcp_mutations (account_id TEXT NOT NULL, mutation_id TEXT NOT NULL, response TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(account_id, mutation_id))').run();
  await database.prepare('DELETE FROM mcp_mutations WHERE created_at < ?').bind(new Date(Date.now()-90*86400000).toISOString()).run();
  const prior = await database.prepare('SELECT response FROM mcp_mutations WHERE account_id=? AND mutation_id=?').bind(accountId, parsed.data.mutationId).first<{response:string}>();
  if (prior) return JSON.parse(prior.response);
  const row = await database.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(accountId).first<{data:string;updated_at:string}>();
  if ((row?.updated_at ?? null) !== parsed.data.expectedRevision) throw new Error('Stride data changed since it was read. Fetch the latest profile or plan and retry with a new mutationId.');
  const before = (row ? JSON.parse(row.data) : blank()) as Data, { next } = update(before);
  const patches = changes(before, next);
  if (!patches.length) return { changed:false, before:null, after:null, revision:row?.updated_at??null };
  const operation = operationSchema.parse({ id: parsed.data.mutationId, action, payload: patches, expectedRevision: row?.updated_at ?? null });
  validateOperation(before, next, operation);
  const revision = new Date(Math.max(Date.now(), row ? Date.parse(row.updated_at)+1 : 0)).toISOString();
  const response = { changed:true, before:patches.map(p=>({path:p.path,before:p.before??null})), after:patches.map(p=>({path:p.path,after:p.after??null})), revision };
  const write = row
    ? database.prepare('UPDATE user_training_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=?').bind(JSON.stringify(next), revision, accountId, row.updated_at)
    : database.prepare('INSERT OR IGNORE INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?)').bind(accountId, JSON.stringify(next), revision);
  const batch = await database.batch([
    write,
    database.prepare('INSERT INTO mcp_mutations (account_id,mutation_id,response,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(accountId, parsed.data.mutationId, JSON.stringify(response), revision),
  ]);
  if (!(batch[1]?.meta?.changes)) {
    const replay = await database.prepare('SELECT response FROM mcp_mutations WHERE account_id=? AND mutation_id=?').bind(accountId, parsed.data.mutationId).first<{response:string}>();
    if (replay) return JSON.parse(replay.response);
    throw new Error('Stride data changed during the update. Read the latest value and try again.');
  }
  return response;
}

export async function writeTool(name: string, args: Args, accountId: string) {
  if (name === 'update_fitness_profile') {
    const { mutationId, expectedRevision, fields, strengthProfile } = args;
    const parsed = profiles.safeParse(fields); if (!parsed.success || !fields || typeof fields !== 'object') throw new Error('fields must contain only editable Stride profile fields with valid values.');
    const strength = strengthProfile === undefined ? undefined : z.object({ bodyweight:number(50,1500).nullable().optional(), heightInches:number(36,96).nullable().optional(), comparison:z.enum(['general','men','women']).optional(), recoveryFigure:z.enum(['masculine','neutral','feminine']).optional() }).strict().safeParse(strengthProfile);
    if (strength && !strength.success) throw new Error('Strength profile accepts bodyweight 50–1500 lb, height 36–96 inches, comparison general/men/women, and recoveryFigure masculine/neutral/feminine.');
    return commit(accountId,{mutationId,expectedRevision},'offer',data=>{
      const before={profile:data.profile??null,strengthProfile:data.strengthProfile??null};
      const profile=profileSchema.parse({...data.profile,...parsed.data});
      const next={...data,profile,...(strength&&strength.success?{strengthProfile:{bodyweight:data.strengthProfile?.bodyweight??null,comparison:data.strengthProfile?.comparison??'general',...data.strengthProfile,...strength.data}}:{})};
      return {next,value:before};
    });
  }
  if (name === 'set_nutrition_targets') {
    const fields = z.object({calorieTarget:number(800,10000).int().nullable().optional(),proteinTarget:number(20,1000).int().nullable().optional(),carbTarget:number(1,1000).nullable().optional(),fatTarget:number(1,1000).nullable().optional(),activityCalorieAdjustment:z.union([z.literal(0),z.literal(50),z.literal(100)]).optional(),hydrationTargetOz:number(8,400).nullable().optional()}).strict().safeParse(args.fields);
    if(!fields.success) throw new Error('Invalid nutrition target. Calories must be 800–10,000, protein 20–1,000 g, optional carbs/fat 1–1,000 g, and hydration 8–400 fl oz. To clear a target, pass null.');
    if ((fields.data.carbTarget===undefined)!==(fields.data.fatTarget===undefined)) throw new Error('Stride requires carbohydrate and fat targets together. Set both, or clear both.');
    return commit(accountId,args,'progress',data=>{
      const n=data.nutrition||{entries:[],calorieTarget:null,proteinTarget:null}; const before={calorieTarget:n.calorieTarget,proteinTarget:n.proteinTarget,carbTarget:n.carbTarget??null,fatTarget:n.fatTarget??null,activityCalorieAdjustment:n.activityCalorieAdjustment??0,hydrationTargetOz:n.hydration?.dailyTargetOz??null};
      const f=fields.data, hydration=f.hydrationTargetOz===undefined?n.hydration:{...(n.hydration||{entries:[]}),dailyTargetOz:f.hydrationTargetOz};
      const nutrition={...n,...(f.calorieTarget!==undefined?{calorieTarget:f.calorieTarget}:{}),...(f.proteinTarget!==undefined?{proteinTarget:f.proteinTarget}:{}),...(f.carbTarget!==undefined?{carbTarget:f.carbTarget}:{}),...(f.fatTarget!==undefined?{fatTarget:f.fatTarget}:{}),...(f.activityCalorieAdjustment!==undefined?{activityCalorieAdjustment:f.activityCalorieAdjustment}:{}),...(f.hydrationTargetOz!==undefined?{hydration}: {})};
      return {next:{...data,nutrition},value:before};
    });
  }
  if (name === 'create_fitness_goal') {
    const parsed=goalInput.safeParse(args.goal);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||'Invalid goal.');
    return commit(accountId,args,'progress',data=>{const goals=data.goals||[];if(goals.filter(g=>!g.archived).length>=50)throw new Error('Stride supports at most 50 active goals.');const g={id:uniqueId('goal'),...parsed.data,checks:[],archived:false};return {next:{...data,goals:[...goals,g]},value:{created:g}}});
  }
  if (name === 'update_fitness_goal') {
    const goalId=id.parse(args.goalId), patch=z.object({title:z.string().trim().min(1).max(100).optional(),kind:z.enum(['measurement','daily','sessions','strength','compound','milestone']).optional(),unit:z.string().trim().min(1).max(20).optional(),start:number(-100000,100000).optional(),target:number(-100000,100000).optional(),started:day.optional(),deadline:day.or(z.literal('')).optional(),exerciseId:id.nullable().optional(),measurementMetric:z.enum(['weight','bodyFat']).nullable().optional(),dailyMetric:z.enum(['hydration','activeCalories','protein','calorieIntake']).nullable().optional()}).strict().safeParse(args.fields);
    if(!patch.success||!Object.keys(patch.data).length)throw new Error('Provide at least one valid goal field to update.');
    return commit(accountId,args,'progress',data=>{const goals=data.goals||[],old=goals.find(g=>g.id===goalId);if(!old)throw new Error('Goal not found in this Stride account.');const updated={...old,...Object.fromEntries(Object.entries(patch.data).map(([k,v])=>[k,v===null?undefined:v]))};if(updated.kind==='strength'&&!updated.exerciseId)throw new Error('A strength goal needs an existing exerciseId.');if(updated.kind==='daily'&&!updated.dailyMetric)throw new Error('A daily goal needs a supported daily metric.');if(updated.deadline&&updated.deadline<updated.started)throw new Error('Deadline must be on or after start date.');return {next:{...data,goals:goals.map(g=>g.id===goalId?updated:g)},value:{goalId,before:old}}});
  }
  if (name === 'record_goal_progress') {
    const goalId=id.parse(args.goalId), check=z.object({date:day,value:number(-100000,100000),note:z.string().max(300).default('')}).safeParse(args.check);if(!check.success)throw new Error(check.error.issues[0]?.message||'Invalid progress check.');
    if(check.data.date>new Date().toISOString().slice(0,10))throw new Error('A goal progress check cannot be in the future.');
    return commit(accountId,args,'progress',data=>{const goals=data.goals||[],old=goals.find(g=>g.id===goalId);if(!old)throw new Error('Goal not found in this Stride account.');if(old.checks.some(item=>item.date===check.data.date))throw new Error('A progress check already exists for this goal on that date.');if(old.checks.length>=500)throw new Error('Stride supports at most 500 progress checks per goal.');const updated={...old,checks:[...old.checks,{id:uniqueId('check'),...check.data}]};return {next:{...data,goals:goals.map(g=>g.id===goalId?updated:g)},value:{goalId,before:old}}});
  }
  if (name === 'add_body_measurement') {
    const measurement=z.object({date:day,weight:number(50,1500).nullable().optional(),bodyFat:number(1,75).nullable().optional()}).refine(v=>v.weight!=null||v.bodyFat!=null,'Provide weight or bodyFat.').safeParse(args.measurement);if(!measurement.success)throw new Error(measurement.error.issues[0]?.message||'Invalid body measurement.');if(measurement.data.date>new Date().toISOString().slice(0,10))throw new Error('A body measurement date cannot be in the future.');
    return commit(accountId,args,'offer',data=>{const rows=data.bodyMeasurements||[];if(rows.some(item=>item.date===measurement.data.date))throw new Error('Stride allows one body check-in per date. Update the existing measurement in Stride first.');if(rows.length>=10000)throw new Error('Measurement history limit reached.');const item={id:uniqueId('measurement'),date:measurement.data.date,weight:measurement.data.weight??null,bodyFat:measurement.data.bodyFat??null};const latestWeight=[...rows,...[item]].filter(row=>row.weight!==null).sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight??data.strengthProfile?.bodyweight??null;const strengthProfile={bodyweight:latestWeight,comparison:data.strengthProfile?.comparison??'general',...(data.strengthProfile?.heightInches!==undefined?{heightInches:data.strengthProfile.heightInches}:{}),...(data.strengthProfile?.recoveryFigure?{recoveryFigure:data.strengthProfile.recoveryFigure}:{})};return {next:{...data,bodyMeasurements:[...rows,item],strengthProfile},value:{added:item}}});
  }
  if (name === 'set_fitness_goal_status' || name === 'delete_fitness_goal') {
    const goalId=id.parse(args.goalId);if(name==='delete_fitness_goal'&&args.confirmDelete!==true)throw new Error('Deletion requires confirmDelete=true after the user explicitly requested deletion.');
    return commit(accountId,args,'progress',data=>{const goals=data.goals||[],old=goals.find(g=>g.id===goalId);if(!old)throw new Error('Goal not found in this Stride account.');if(name==='delete_fitness_goal')return {next:{...data,goals:goals.filter(g=>g.id!==goalId)},value:{goalId,before:old}};const status=z.enum(['completed','archived','active']).parse(args.status),updated={...old,archived:status==='archived'||status==='completed',...(status==='completed'?{completedAt:new Date().toISOString()}:{})};if(status==='active')delete (updated as typeof updated & {completedAt?:string}).completedAt;return {next:{...data,goals:goals.map(g=>g.id===goalId?updated:g)},value:{goalId,before:old}}});
  }
  if (name === 'create_workout_plan') {
    const parsed=templateInput.safeParse(args.plan);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||'Invalid workout plan.');
    return commit(accountId,args,'template',data=>{if((data.templates||[]).length>=100)throw new Error('Stride supports at most 100 saved plans.');for(const entry of parsed.data.entries)if(!data.exercises.some(e=>e.id===entry.exerciseId))throw new Error(`Exercise ${entry.exerciseId} is not in your Stride exercise library.`);const plan:Template={id:uniqueId('plan'),name:parsed.data.name,description:parsed.data.description,revision:1,entries:parsed.data.entries};return {next:{...data,templates:[...(data.templates||[]),plan]},value:{created:plan}}});
  }
  if (name === 'update_workout_plan') {
    const planId=id.parse(args.planId),patch=z.object({name:z.string().trim().min(1).max(100).optional(),description:z.string().max(500).optional()}).strict().safeParse(args.fields);if(!patch.success||!Object.keys(patch.data).length)throw new Error('Provide a plan name or description to update.');
    return commit(accountId,args,'template',data=>{const plans=data.templates||[],old=plans.find(p=>p.id===planId);if(!old)throw new Error('Workout plan not found in this Stride account.');const updated={...old,...patch.data,revision:(old.revision||1)+1};return {next:{...data,templates:plans.map(p=>p.id===planId?updated:p)},value:{planId,before:old}}});
  }
  if (name === 'edit_workout_plan_exercises') {
    const planId=id.parse(args.planId), action=z.enum(['add','remove','replace','reorder']).parse(args.action);
    return commit(accountId,args,'template',data=>{const plans=data.templates||[],old=plans.find(p=>p.id===planId);if(!old)throw new Error('Workout plan not found in this Stride account.');let entries=[...old.entries];
      if(action==='add'){const p=entryInput.safeParse(args.exercise);if(!p.success)throw new Error(p.error.issues[0]?.message||'Invalid exercise prescription.');if(!data.exercises.some(e=>e.id===p.data.exerciseId))throw new Error('Exercise is not available in your Stride library.');if(entries.length>=20)throw new Error('Plans support at most 20 exercises.');entries.splice(Math.min(Number(args.position??entries.length),entries.length),0,p.data);}
      else if(action==='remove'){const index=entries.findIndex(e=>e.exerciseId===args.exerciseId);if(index<0)throw new Error('Exercise not found in this plan.');entries.splice(index,1);if(!entries.length)throw new Error('A saved plan must contain at least one exercise.');}
      else if(action==='replace'){const index=entries.findIndex(e=>e.exerciseId===args.exerciseId);const next=entryInput.safeParse(args.exercise);if(index<0||!next.success)throw new Error('Provide an existing exerciseId and a valid replacement exercise prescription.');if(!data.exercises.some(e=>e.id===next.data.exerciseId))throw new Error('Replacement exercise is not available in your Stride library.');entries[index]=next.data;}
      else {const order=z.array(id).min(1).max(20).safeParse(args.exerciseIds);if(!order.success||order.data.length!==entries.length||new Set(order.data).size!==entries.length||order.data.some(exerciseId=>!entries.some(e=>e.exerciseId===exerciseId)))throw new Error('exerciseIds must list every exercise exactly once in the desired order.');entries=order.data.map(exerciseId=>entries.find(e=>e.exerciseId===exerciseId)!);}
      const updated={...old,entries,revision:(old.revision||1)+1};return {next:{...data,templates:plans.map(p=>p.id===planId?updated:p)},value:{planId,before:old}};});
  }
  if (name === 'duplicate_workout_plan') {
    const planId=id.parse(args.planId),newName=z.string().trim().min(1).max(100).parse(args.name);
    return commit(accountId,args,'template',data=>{const plans=data.templates||[],old=plans.find(p=>p.id===planId);if(!old)throw new Error('Workout plan not found in this Stride account.');if(plans.length>=100)throw new Error('Stride supports at most 100 saved plans.');const copy={...structuredClone(old),id:uniqueId('plan'),name:newName,revision:1};return {next:{...data,templates:[...plans,copy]},value:{source:old.id,created:copy}}});
  }
  if (name === 'archive_workout_plan') {
    const planId=id.parse(args.planId);if(args.confirmArchive!==true)throw new Error('Archiving requires confirmArchive=true after the user explicitly requested it.');
    return commit(accountId,args,'template',data=>{const plans=data.templates||[],old=plans.find(p=>p.id===planId);if(!old)throw new Error('Workout plan not found in this Stride account.');return {next:{...data,templates:plans.filter(p=>p.id!==planId)},value:{archived:old}}});
  }
  throw new Error('Unknown write tool.');
}
