import {coachStyleSchema,coachIntensitySchema} from "./coach-style";
import { z } from "zod";
export const sexSchema = z.enum(["Male", "Female"]);
// Old stored profiles remain readable; completion and new profile writes require sex.
export const profileSchema = z.object({
  coachStyle: coachStyleSchema.nullable().optional(),
  coachIntensity: coachIntensitySchema.nullable().optional(),
  useStyle: z
    .enum(["Guided coaching", "Just log workouts", "Explore at my own pace"])
    .nullable()
    .default(null),
  name: z.string().trim().min(1).max(80).nullable().default(null),
  sex: sexSchema.nullable().default(null),
  goal: z.string().trim().min(3).max(1000).nullable().default(null),
  experience: z
    .enum(["New to lifting", "Some experience", "Experienced"])
    .nullable()
    .default(null),
  days: z.number().int().min(1).max(7).nullable().default(null),
  minutes: z.number().int().min(10).max(180).nullable().default(null),
  equipment: z.string().trim().min(2).max(1000).nullable().default(null),
  limitations: z.string().trim().min(2).max(1000).nullable().default(null),
  ageRange: z
    .enum(["Under 18", "18–29", "30–44", "45–59", "60+", "Prefer not to say"])
    .nullable()
    .default(null),
});
export const profileCompleteSchema = profileSchema.extend({ sex: sexSchema });
export type CoachingProfile = z.infer<typeof profileSchema>;
