import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {ObjectId} from "mongodb";
import {z} from "zod";
import {database,mongoClient} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {guardMutation} from "@/lib/security";

export async function POST(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const blocked=await guardMutation(req,"invite-create",10000,60_000,user.userId,10);if(blocked)return blocked;
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 const parsed=z.object({expiresInHours:z.number().int().min(1).max(168).default(24)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid expiry"},{status:400});
 const db=await database(),id=new ObjectId(teamId),token=randomBytes(24).toString("base64url"),tokenHash=createHash("sha256").update(token).digest("hex"),now=new Date(),expiresAt=new Date(now.getTime()+parsed.data.expiresInHours*3600000);
 try{
  await(await mongoClient()).withSession(s=>s.withTransaction(async()=>{
   const team=await db.collection("teams").findOne({_id:id,status:"open"},{session:s});
   if(!team)throw Error("TEAM_CLOSED");
   if(team.leaderId!==user.userId)throw Error("NOT_LEADER");
   const lock=await db.collection("teams").updateOne({_id:id,leaderId:user.userId,status:"open",memberCount:{$lt:team.maxSize}},{$set:{updatedAt:now}},{session:s});
   if(!lock.matchedCount)throw Error("TEAM_FULL");
   await db.collection("invites").insertOne({tokenHash,hackathonId:team.hackathonId,teamId:id,createdBy:user.userId,createdAt:now,expiresAt,usedAt:null,revokedAt:null},{session:s});
   await db.collection("audit").insertOne({hackathonId:team.hackathonId,teamId:id,actorId:user.userId,action:"INVITE_CREATED",expiresAt,createdAt:now},{session:s});
  }));
  return NextResponse.json({inviteUrl:(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/invite/"+token,expiresAt},{status:201});
 }catch(e){
  const message=e instanceof Error?e.message:"";
  if(message==="NOT_LEADER")return NextResponse.json({error:"Only the current team leader can create invites"},{status:403});
  if(message==="TEAM_FULL")return NextResponse.json({error:"Team is full or changed while creating the invite"},{status:409});
  if(message==="TEAM_CLOSED")return NextResponse.json({error:"Team is no longer accepting members"},{status:409});
  return NextResponse.json({error:"Could not create invite"},{status:500});
 }
}
