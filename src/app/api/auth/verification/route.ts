import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {database} from "@/lib/db";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null),email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
 const blocked=await guardMutation(req,"email-verification",30,60_000,email||undefined,3,true);if(blocked)return blocked;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({ok:true});
 const db=await database(),user=await db.collection("users").findOne({email,emailVerified:{$ne:true}},{projection:{_id:1,email:1}});
 if(user&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
  const token=randomBytes(32).toString("base64url"),now=new Date();
  await db.collection("authTokens").deleteMany({userId:user._id,purpose:"verify-email"});
  await db.collection("authTokens").insertOne({userId:user._id,purpose:"verify-email",tokenHash:createHash("sha256").update(token).digest("hex"),createdAt:now,expiresAt:new Date(now.getTime()+86400000)});
  await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:"Verify your CrewForge email",text:"Verify your email within 24 hours: "+(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/verify?token="+token})});
 }
 return NextResponse.json({ok:true,message:"If the account needs verification, an email will be sent."});
}
