import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {createTopUpCheckout} from '@/lib/billing';
export async function POST(request:Request){const user=await getChatGPTUser(request);if(!user)return Response.json({error:'Sign in to add an AI balance.',signInUrl:chatGPTSignInPath('/')},{status:401});if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Start checkout from Stride.'},{status:403});try{return Response.json({url:await createTopUpCheckout(user,new URL(request.url).origin)})}catch(error){return Response.json({error:error instanceof Error?error.message:'Checkout is temporarily unavailable.'},{status:502})}}

