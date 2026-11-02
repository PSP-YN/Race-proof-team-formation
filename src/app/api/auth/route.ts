import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {database} from "@/lib/db";
import {z} from "zod";
import {createSession,loginUser,registerUser,getSession} from "@/lib/auth";
import {cookies} from "next/headers";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function GET(){try{return NextResponse.json({user:await getSession()},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({user:null},{headers:{"Cache-Control":"no-store"}})}}
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("register"),email:z.email().max(254),name:z.string().trim().min(2).max(60),password:z.string().min(10).max(100)}),
 z.object({action:z.literal("login"),email:z.email().max(254),password:z.string().min(1).max(100)}),
 z.object({action:z.literal("logout")})
]);
export async function POST(req:NextRequest){
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 const identity=parsed.success&&"email" in parsed.data?parsed.data.email:undefined;
 const blocked=await guardMutation(req,"auth",15000,15*60_000,identity,10,true);if(blocked)return blocked;
 if(!parsed.success)return NextResponse.json({error:"Please check the submitted fields."},{status:400});
 const d=parsed.data;
 const db=await database();
 try{
  if(d.action==="logout"){(await cookies()).delete("crewforge_session");return NextResponse.json({ok:true})}
  const user=d.action==="register"?await registerUser(d.email,d.name,d.password):await loginUser(d.email,d.password);
  if(d.action==="register"){
   const token=randomBytes(32).toString("base64url"),now=new Date();
   await db.collection("authTokens").insertOne({userId:new (await import("mongodb")).ObjectId(user.userId),purpose:"verify-email",tokenHash:createHash("sha256").update(token).digest("hex"),createdAt:now,expiresAt:new Date(now.getTime()+24*60*60*1000)});
   let sentOk=false;try{const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+(process.env.RESEND_API_KEY||""),"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[user.email],subject:"Verify your CrewForge email",text:"Verify your email within 24 hours: "+(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/verify?token="+token}),signal:AbortSignal.timeout(5000)});sentOk=sent.ok}catch{/* The user can request another verification email after provider failure. */}
   if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM||!sentOk)return NextResponse.json({error:"Account created, but email delivery is not configured or failed. Configure the email provider, then request a new verification email."},{status:503});
   return NextResponse.json({verificationRequired:true},{status:201,headers:{"Cache-Control":"no-store"}});
  }
  await createSession(user);
  return NextResponse.json({user},{status:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const m=e instanceof Error?e.message:"";
  if(m.includes("duplicate key"))return NextResponse.json({error:"Email already registered"},{status:409});
  if(d.action==="login"&&(m==="Invalid email or password"||m==="EMAIL_NOT_VERIFIED")){try{await db.collection("securityEvents").insertOne({scope:"auth",identityHash:createHash("sha256").update(d.email.trim().toLowerCase()).digest("hex"),event:"AUTH_FAILURE",createdAt:new Date()})}catch{/* Do not leak telemetry failures into authentication responses. */}return NextResponse.json({error:"Invalid email or password. If you recently registered, verify your email first."},{status:401,headers:{"Cache-Control":"no-store"}});}
  if(m.startsWith("Password")||m==="Enter a valid email"||m.startsWith("Name must"))return NextResponse.json({error:m},{status:400});
  return NextResponse.json({error:"Authentication service is temporarily unavailable"},{status:500});
 }
}
