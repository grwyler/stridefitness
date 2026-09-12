import {getConnectionKey,saveConnection,removeConnection} from './ai-connection';
import {BILLING_SANDBOX_ACCOUNT} from './metronome-connection';

const connectionId='billing:stripe:sandbox';
export class StripeConnectionError extends Error {}
export async function stripeConnectionStatus(){return {connected:!!await getConnectionKey(connectionId),stripeAccountId:BILLING_SANDBOX_ACCOUNT,billingEnabled:true}}
export async function connectStripe(key:string){
 let response:Response;
 try{response=await fetch('https://api.stripe.com/v1/account',{headers:{Authorization:`Bearer ${key}`}})}
 catch{throw new StripeConnectionError('Stride could not contact Stripe to verify the key. The key was not saved.')}
 if(response.status===401||response.status===403)throw new StripeConnectionError('Stripe did not accept this key, or it cannot read account details. Check the restricted-key permissions and try again.');
 if(!response.ok)throw new StripeConnectionError('Stripe could not verify this key right now. Please try again.');
 const account=await response.json() as {id?:unknown};
 if(account.id!==BILLING_SANDBOX_ACCOUNT)throw new StripeConnectionError('This key belongs to a different Stripe account. Create it inside Stride sandbox and try again.');
 await saveConnection(connectionId,key);
 return stripeConnectionStatus();
}
export async function disconnectStripe(){await removeConnection(connectionId)}
