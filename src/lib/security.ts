import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/db";

export async function guardMutation(req:NextRequest,scope:string,ipLimit=10_000,windowMs=60_000,identity?:string,identityLimit=20,identityPerIp=false):Promise<NextResponse|null>{
 const expected=process.env.VERCEL==="1"?req.nextUrl.origin:new URL(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin).origin;
 const origin=req.headers.get("origin"),referer=req.headers.get("referer");
 let supplied:string|null=origin;
 if(!supplied&&referer){try{supplied=new URL(referer).origin}catch{supplied=null}}
 if(!supplied||supplied!==expected)return NextResponse.json({error:"Cross-origin request rejected"},{status:403});
 const ip=process.env.VERCEL==="1"?req.headers.get("x-real-ip")?.trim():process.env.TRUSTED_CLIENT_IP_HEADER?req.headers.get(process.env.TRUSTED_CLIENT_IP_HEADER)?.trim():process.env.NODE_ENV==="development"?"local-development":null;
 if(!ip)return NextResponse.json({error:"Rate limiting is not configured for this deployment"},{status:503});
 const db=await database(),rateLimits=db.collection<{_id:string;count:number;expiresAt:Date;scope:string}>("rateLimits");
 const bucket=Math.floor(Date.now()/windowMs);
 const counters=[{value:scope+":ip:"+ip,limit:ipLimit}];
 if(identity)counters.push({value:scope+":identity:"+(identityPerIp?ip+":":"")+identity.trim().toLowerCase(),limit:identityLimit});
 for(const counter of counters){
  const key=createHash("sha256").update(counter.value).digest("hex"),id=key+":"+bucket;
  const state=await rateLimits.findOneAndUpdate({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*windowMs),scope}},{upsert:true,returnDocument:"after",projection:{count:1}});
  if((state?.count??0)>counter.limit)return NextResponse.json({error:"Too many requests. Try again shortly."},{status:429,headers:{"Retry-After":String(Math.max(1,Math.ceil(((bucket+1)*windowMs-Date.now())/1000)))}});
 }
 return null;
}
