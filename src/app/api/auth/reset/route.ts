import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {database} from "@/lib/db";
import {updateUserPassword} from "@/lib/auth";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null),token=typeof body?.token==="string"?body.token:"",password=typeof body?.password==="string"?body.password:"";
 const blocked=await guardMutation(req,"password-reset",30,60_000,token||undefined,5,true);if(blocked)return blocked;
 if(!/^[A-Za-z0-9_-]{40,50}$/.test(token)||password.length<10||password.length>100||Buffer.byteLength(password,"utf8")>72)return NextResponse.json({error:"Invalid token or password. Use 10–72 UTF-8 bytes."},{status:400});
 const db=await database(),record=await db.collection("authTokens").findOneAndDelete({tokenHash:createHash("sha256").update(token).digest("hex"),purpose:"password-reset",expiresAt:{$gt:new Date()}});
 if(!record)return NextResponse.json({error:"Reset link is invalid, expired or already used"},{status:410});
 await updateUserPassword(record.userId.toString(),password);
 await db.collection("authTokens").deleteMany({userId:record.userId,purpose:"password-reset"});
 return NextResponse.json({ok:true,message:"Password updated. Sign in with your new password."});
}
