import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {ObjectId} from "mongodb";
import {z} from "zod";
import {database,mongoClient} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {guardMutation} from "@/lib/security";

export async function GET(_req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 try{
  const db=await database(),team=await db.collection("teams").findOne({_id:new ObjectId(teamId),leaderId:user.userId},{projection:{_id:1}});
  if(!team)return NextResponse.json({error:"Team not found or leader access required"},{status:404});
  const invites=await db.collection("invites").find({teamId:team._id,usedAt:null,revokedAt:null,expiresAt:{$gt:new Date()}},{projection:{createdAt:1,expiresAt:1}}).sort({createdAt:-1}).limit(50).toArray();
  return NextResponse.json({invites:invites.map(i=>({id:i._id.toString(),createdAt:i.createdAt,expiresAt:i.expiresAt}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not load invites"},{status:500})}
}

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

export async function DELETE(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const blocked=await guardMutation(req,"invite-revoke",10000,60_000,user.userId,20);if(blocked)return blocked;
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 const id=req.nextUrl.searchParams.get("inviteId");if(!id||!ObjectId.isValid(id))return NextResponse.json({error:"Invalid invite id"},{status:400});
 try{
  const db=await database(),teamIdObject=new ObjectId(teamId),inviteId=new ObjectId(id),now=new Date();
  await(await mongoClient()).withSession(s=>s.withTransaction(async()=>{
   const team=await db.collection("teams").findOne({_id:teamIdObject},{session:s});
   if(!team||team.leaderId!==user.userId)throw Error("NOT_LEADER");
   const lock=await db.collection("teams").updateOne({_id:teamIdObject,leaderId:user.userId,status:"open"},{$set:{updatedAt:now}},{session:s});
   if(!lock.matchedCount)throw Error("NOT_LEADER");
   const result=await db.collection("invites").updateOne({_id:inviteId,teamId:teamIdObject,usedAt:null,revokedAt:null,expiresAt:{$gt:now}},{$set:{revokedAt:now,revokedBy:user.userId}},{session:s});
   if(!result.modifiedCount)throw Error("INVITE_INACTIVE");
   await db.collection("audit").insertOne({hackathonId:team.hackathonId,teamId:teamIdObject,actorId:user.userId,action:"INVITE_REVOKED",createdAt:now},{session:s});
  }));
  return NextResponse.json({ok:true});
 }catch(e){
  const message=e instanceof Error?e.message:"";
  if(message==="NOT_LEADER")return NextResponse.json({error:"Only the current team leader can revoke invites"},{status:403});
  if(message==="INVITE_INACTIVE")return NextResponse.json({error:"Invite is already used, expired, revoked or does not exist"},{status:409});
  return NextResponse.json({error:"Could not revoke invite"},{status:500});
 }
}
