import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {database} from "@/lib/db";
import {createSession} from "@/lib/auth";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const blocked=await guardMutation(req,"email-verify",10000,60_000,undefined,10,true);if(blocked)return blocked;
 const body=await req.json().catch(()=>null),token=typeof body?.token==="string"?body.token:"";
 if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))return NextResponse.json({error:"Invalid or expired verification link"},{status:400});
 const db=await database(),hash=createHash("sha256").update(token).digest("hex"),now=new Date();
 const record=await db.collection("authTokens").findOneAndDelete({tokenHash:hash,purpose:"verify-email",expiresAt:{$gt:now}});
 if(!record)return NextResponse.json({error:"Verification link is invalid, expired or already used"},{status:410});
 const user=await db.collection("users").findOneAndUpdate({_id:record.userId},{$set:{emailVerified:true,emailVerifiedAt:now}},{returnDocument:"after"});
 if(!user)return NextResponse.json({error:"Account not found"},{status:404});
 await createSession({userId:user._id.toString(),email:user.email,name:user.name,sessionVersion:typeof user.sessionVersion==="number"?user.sessionVersion:0});
 return NextResponse.json({ok:true});
}
