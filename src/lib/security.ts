import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/db";

export async function guardMutation(req:NextRequest,scope:string,limit=30,windowMs=60_000):Promise<NextResponse|null>{
  const expected=new URL(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin).origin;
  const origin=req.headers.get("origin");
  const referer=req.headers.get("referer");
  let supplied:string|null=origin;
  if(!supplied&&referer){try{supplied=new URL(referer).origin}catch{supplied=null}}
  if(!supplied||supplied!==expected)return NextResponse.json({error:"Cross-origin request rejected"},{status:403});
  const ip=req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  const key=createHash("sha256").update(scope+":"+ip).digest("hex");
  const bucket=Math.floor(Date.now()/windowMs);
  const id=key+":"+bucket;
  const db=await database();
  await db.collection("rateLimits").updateOne({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*windowMs),scope}},{upsert:true});
  const state=await db.collection("rateLimits").findOne({_id:id},{projection:{count:1}});
  if((state?.count??0)>limit)return NextResponse.json({error:"Too many requests. Try again shortly."},{status:429,headers:{"Retry-After":String(Math.ceil(windowMs/1000))}});
  return null;
}
