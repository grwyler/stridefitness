import { env } from "cloudflare:workers";
import { ensureIdentityTables } from "@/lib/auth-identities";
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function hash(value:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,"0")).join("")}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Use Stride to continue."},{status:403});
 const email=String((await request.json().catch(()=>({}))).email||"").trim().toLowerCase(); if(!emailPattern.test(email)||email.length>254)return Response.json({error:"Enter a valid email address."},{status:400});
 const config=env as unknown as {DB?:D1Database;RESEND_API_KEY?:string;EMAIL_FROM?:string}; if(!config.DB||!config.RESEND_API_KEY||!config.EMAIL_FROM)return Response.json({error:"Email sign-in is not configured yet. Please use Google or guest access."},{status:503});
 try{await ensureIdentityTables();const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token),now=new Date(),expiry=new Date(now.getTime()+15*60_000).toISOString(),origin=new URL(request.url).origin,link=`${origin}/api/auth/email/verify?token=${encodeURIComponent(token)}`;
 await config.DB.prepare("INSERT INTO email_login_challenges (token_hash,email,expires_at,requested_at) VALUES (?,?,?,?)").bind(tokenHash,email,expiry,now.toISOString()).run();
 const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:config.EMAIL_FROM,to:[email],subject:"Sign in to Stride",html:`<p>Use this secure link to sign in to Stride:</p><p><a href="${link}">Continue to Stride</a></p><p>This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>`})});if(!sent.ok)throw new Error();
 return Response.json({ok:true});}catch{return Response.json({error:"We couldn't send that sign-in email right now. Please try again."},{status:503});}}
