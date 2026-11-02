import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {Collection} from "mongodb";
import {database} from "@/lib/db";

// Fixed-window counters are persisted in MongoDB so limits remain effective across serverless instances.
// Identity keys are hashed before storage; trusted client IP extraction must fail closed in production.
type RateLimitCounter={_id:string;count:number;expiresAt:Date;scope:string};

async function incrementBucket(collection:Collection<RateLimitCounter>,id:string,expiresAt:Date,scope:string):Promise<number>{
 try{
  const result=await collection.findOneAndUpdate({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt,scope}},{upsert:true,returnDocument:"after",projection:{count:1}});
  if(result)return result.count;
 }catch(error){
  if((error as {code?:number})?.code!==11000)throw error;
 }
 const existing=await collection.findOneAndUpdate({_id:id},{$inc:{count:1}},{returnDocument:"after",projection:{count:1}});
 if(existing)return existing.count;
 const recreated=await collection.findOneAndUpdate({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt,scope}},{upsert:true,returnDocument:"after",projection:{count:1}});
 if(!recreated)throw new Error("RATE_LIMIT_COUNTER_UNAVAILABLE");
 return recreated.count;
}

export async function guardMutation(req:NextRequest,scope:string,ipLimit=10_000,windowMs=60_000,identity?:string,identityLimit=20,identityPerIp=false):Promise<NextResponse|null>{
 const expected=process.env.VERCEL==="1"?req.nextUrl.origin:new URL(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin).origin;
 const origin=req.headers.get("origin"),referer=req.headers.get("referer");
 let supplied:string|null=origin;
 if(!supplied&&referer){try{supplied=new URL(referer).origin}catch{supplied=null}}
 if(!supplied||supplied!==expected)return NextResponse.json({error:"Cross-origin request rejected"},{status:403});
 const ip=process.env.VERCEL==="1"?req.headers.get("x-real-ip")?.trim():process.env.TRUSTED_CLIENT_IP_HEADER?req.headers.get(process.env.TRUSTED_CLIENT_IP_HEADER)?.trim():process.env.NODE_ENV==="development"?"local-development":null;
 if(!ip)return NextResponse.json({error:"Rate limiting is not configured for this deployment"},{status:503});
 const db=await database(),rateLimits=db.collection<RateLimitCounter>("rateLimits");
 const bucket=Math.floor(Date.now()/windowMs);
 const counters=[{value:scope+":ip:"+ip,limit:ipLimit}];
 if(identity)counters.push({value:scope+":identity:"+(identityPerIp?ip+":":"")+identity.trim().toLowerCase(),limit:identityLimit});
 for(const counter of counters){
  const key=createHash("sha256").update(counter.value).digest("hex"),id=key+":"+bucket;
  const count=await incrementBucket(rateLimits,id,new Date((bucket+2)*windowMs),scope);
  if(count>counter.limit){const identityHash=createHash("sha256").update(counter.value).digest("hex");try{await db.collection("securityEvents").insertOne({scope,identityHash,event:"RATE_LIMIT_EXCEEDED",createdAt:new Date(),metadata:{limit:counter.limit,windowMs}})}catch{/* Security telemetry must never break request protection. */}if(count===counter.limit+1&&process.env.SECURITY_ALERT_WEBHOOK){try{await fetch(process.env.SECURITY_ALERT_WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"CrewForge rate-limit threshold exceeded",scope,identityHash,limit:counter.limit,windowMs}),signal:AbortSignal.timeout(1500)})}catch{/* Alert delivery must not weaken request protection. */}}return NextResponse.json({error:"Too many requests. Try again shortly."},{status:429,headers:{"Retry-After":String(Math.max(1,Math.ceil(((bucket+1)*windowMs-Date.now())/1000)))}});}
 }
 return null;
}

export async function guardEventStream(req:NextRequest):Promise<NextResponse|null>{
 const ip=process.env.VERCEL==="1"?req.headers.get("x-real-ip")?.trim():process.env.TRUSTED_CLIENT_IP_HEADER?req.headers.get(process.env.TRUSTED_CLIENT_IP_HEADER)?.trim():process.env.NODE_ENV==="development"?"local-development":null;
 if(!ip)return NextResponse.json({error:"Rate limiting is not configured for this deployment"},{status:503});
 const db=await database(),windowMs=60_000,bucket=Math.floor(Date.now()/windowMs),limit=30;
 const identity="event-stream:ip:"+ip,key=createHash("sha256").update(identity).digest("hex"),count=await incrementBucket(db.collection<RateLimitCounter>("rateLimits"),key+":"+bucket,new Date((bucket+2)*windowMs),"event-stream");
 if(count>limit){const identityHash=createHash("sha256").update(identity).digest("hex");try{await db.collection("securityEvents").insertOne({scope:"event-stream",identityHash,event:"RATE_LIMIT_EXCEEDED",createdAt:new Date(),metadata:{limit,windowMs}})}catch{/* Telemetry must not affect stream protection. */}return NextResponse.json({error:"Too many realtime connections. Try again shortly."},{status:429,headers:{"Retry-After":String(Math.max(1,Math.ceil(((bucket+1)*windowMs-Date.now())/1000)))}})}
 return null;
}
