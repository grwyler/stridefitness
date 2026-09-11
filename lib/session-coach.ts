import {z} from 'zod';
export const sessionChangeSchema=z.object({type:z.enum(['replace_exercise','adjust_exercise','add_exercise','remove_exercise','rename_workout']),exerciseId:z.string(),replacementExerciseId:z.string().nullable(),sets:z.number().int().min(1).max(20).nullable(),reps:z.number().int().min(1).max(100).nullable(),weight:z.number().min(0).max(2000).nullable(),name:z.string().max(100).nullable()});
export const sessionCoachSchema=z.object({message:z.string(),changes:z.array(sessionChangeSchema).max(12)});
export type SessionCoachReply=z.infer<typeof sessionCoachSchema>;
