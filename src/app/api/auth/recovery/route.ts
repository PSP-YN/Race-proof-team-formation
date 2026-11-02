import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {database} from "@/lib/db";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const blocked=await guardMutation(req,"password-recovery",10000,60_000,undefined,5,true);if(blocked)return blocked;
 const body=await req.json().catch(()=>null),email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
 const db=await database(),user=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?await db.collection("users").findOne({email,emailVerified:true},{projection:{_id:1,email:1}}):null;
 if(user&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
  const token=randomBytes(32).toString("base64url"),now=new Date();
  await db.collection("authTokens").deleteMany({userId:user._id,purpose:"password-reset"});
  await db.collection("authTokens").insertOne({userId:user._id,purpose:"password-reset",tokenHash:createHash("sha256").update(token).digest("hex"),createdAt:now,expiresAt:new Date(now.getTime()+30*60*1000)});
  await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:"Reset your CrewForge password",text:"This link expires in 30 minutes: "+(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/reset-password?token="+token})});
 }
 return NextResponse.json({ok:true,message:"If a verified account exists for that address, a recovery email will be sent."});
}
