import {z} from 'zod';

export const billingStatusResponseSchema=z.object({
 enabled:z.boolean(),
 ready:z.boolean(),
 balanceMicros:z.number().finite().int().nonnegative(),
});
export type BillingStatusResponse=z.infer<typeof billingStatusResponseSchema>;
export const adminActionResponseSchema=z.object({
 done:z.literal(true),
 action:z.enum(['reset','delete','grant_ai','revoke_ai']),
});
export function responseError(value:unknown,fallback:string):string{
 const parsed=z.object({error:z.string().min(1)}).safeParse(value);
 return parsed.success?parsed.data.error:fallback;
}
