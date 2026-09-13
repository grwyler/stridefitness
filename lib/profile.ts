import {z} from 'zod';
export const profileSchema=z.object({name:z.string().trim().min(1).max(80),goal:z.string().trim().min(3).max(1000),experience:z.enum(['New to lifting','Some experience','Experienced']),days:z.number().int().min(1).max(7),minutes:z.number().int().min(10).max(180),equipment:z.string().trim().min(2).max(1000),limitations:z.string().trim().min(2).max(1000),ageRange:z.enum(['Under 18','18–29','30–44','45–59','60+','Prefer not to say'])});
export type CoachingProfile=z.infer<typeof profileSchema>;
