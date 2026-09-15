import {z} from 'zod';
import {profileSchema,profileCompleteSchema,type CoachingProfile} from './profile';
import {planSchema,applyPlan,applyProgressProposal,type GeneratedPlan} from './plan';
import {initialData,type Data} from './training';
export const onboardingSchema=z.object({
 mode:z.enum(['coach','routine','manual']).default('coach'),
 brief:z.string().max(3000).default(''),
 reply:z.string().max(3000).default(''),
 profile:profileSchema,
 messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(4000)})).max(100).default([]),
 plan:planSchema.nullable().default(null),
 stage:z.enum(['brief','review']).default('brief'),
});
export type OnboardingDraft=z.infer<typeof onboardingSchema>;
export function emptyOnboarding(name=''):OnboardingDraft{return onboardingSchema.parse({profile:{name:name||null}})}
export function hasExistingTraining(data:Partial<Data>|null){return !!(data?.profile || data?.workouts?.length || data?.templates?.length || data?.coachPlanner?.messages?.length || data?.goals?.length || data?.nutrition?.entries?.length || data?.activityEnergy?.logs?.length || data?.bodyMeasurements?.length)}
export function extractedProfile(profile:CoachingProfile,plan:GeneratedPlan):CoachingProfile{
 const next={...profile};for(const item of plan.saveUpdates?.profile||[]){const value=item.field==='days'||item.field==='minutes'?Number(item.value):item.value;const parsed=profileSchema.shape[item.field].safeParse(value);if(parsed.success)(next as Record<string,unknown>)[item.field]=parsed.data;}return next;
}
// The user reviews this entire payload before it enters ordinary training data.
export function completeOnboarding(current:Data|null,draft:OnboardingDraft,acceptPlan:boolean){
 if(hasExistingTraining(current))throw new Error('This account is already set up. Open Stride to continue.');
 const profile=profileCompleteSchema.parse({...draft.profile,useStyle:draft.mode==='manual'?'Just log workouts':'Guided coaching'});
 let data:Data={...(current||initialData()),profile};
 let ids:string[]=[];
 if(acceptPlan&&draft.plan){const result=applyPlan(data,draft.plan);data=result.data;ids=result.ids;if(draft.plan.progress)data=applyProgressProposal(data,draft.plan.progress);}
 // Preserve the conversation and any declined draft for later review, never apply it silently.
 if(draft.messages.length)data={...data,coachPlanner:{messages:draft.messages,plan:draft.plan,ids,draft:!acceptPlan}};
 return data;
}
