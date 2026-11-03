import {NextRequest,NextResponse} from "next/server";
import {ObjectId} from "mongodb";
import {z} from "zod";
import {database,mongoClient} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {guardMutation} from "@/lib/security";

export async function GET(_req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 try{const db=await database(),team=await db.collection("teams").findOne({_id:new ObjectId(teamId),leaderId:user.userId},{projection:{_id:1}});
 if(!team)return NextResponse.json({error:"Only the team leader can view join requests"},{status:403});
 const requests=await db.collection("joinRequests").find({teamId:team._id,status:"pending"},{projection:{userId:1,name:1,skills:1,requestedAt:1}}).sort({requestedAt:1}).limit(100).toArray();
 return NextResponse.json({requests:requests.map(r=>({id:r._id.toString(),userId:r.userId,name:r.name,skills:r.skills||[],requestedAt:r.requestedAt}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not load join requests"},{status:500})}
}

export async function POST(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const blocked=await guardMutation(req,"join-request-create",10000,60_000,user.userId,10);if(blocked)return blocked;
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 const parsed=z.object({hackathonId:z.string().min(1).max(100),skills:z.array(z.string().trim().min(1).max(40)).max(20).default([])}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid join request"},{status:400});
 const {hackathonId,skills}=parsed.data,db=await database(),id=new ObjectId(teamId),now=new Date();
 try{
  if(await db.collection("memberships").findOne({hackathonId,userId:user.userId}))return NextResponse.json({error:"You already belong to a team in this hackathon"},{status:409});
  const existing=await db.collection("joinRequests").findOne({hackathonId,teamId:id,userId:user.userId,status:"pending"});
  if(existing)return NextResponse.json({requestId:existing._id.toString(),pending:true,replayed:true});
  const team=await db.collection("teams").findOne({_id:id,hackathonId,status:"open"});
  if(!team)return NextResponse.json({error:"Team not found or closed"},{status:404});
  if(team.memberCount>=team.maxSize)return NextResponse.json({error:"Team is full"},{status:409});
  const request={hackathonId,teamId:id,userId:user.userId,name:user.name,skills, status:"pending",requestedAt:now};
  const result=await db.collection("joinRequests").insertOne(request);
  await db.collection("audit").insertOne({hackathonId,teamId:id,actorId:user.userId,action:"JOIN_REQUEST_CREATED",createdAt:now});
  return NextResponse.json({requestId:result.insertedId.toString(),pending:true},{status:201});
 }catch(e){const error=e as {code?:number};if(error.code===11000){const existing=await db.collection("joinRequests").findOne({hackathonId,teamId:id,userId:user.userId,status:"pending"});if(existing)return NextResponse.json({requestId:existing._id.toString(),pending:true,replayed:true})}return NextResponse.json({error:"Could not submit join request"},{status:409})}
}

export async function PATCH(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const blocked=await guardMutation(req,"join-request-decision",10000,60_000,user.userId,30);if(blocked)return blocked;
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 const parsed=z.object({requestId:z.string().refine(ObjectId.isValid),decision:z.enum(["accept","decline"])}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid request decision"},{status:400});
 const db=await database(),id=new ObjectId(teamId),requestId=new ObjectId(parsed.data.requestId),now=new Date();let decisionStatus="declined";
 try{
  await(await mongoClient()).withSession(s=>s.withTransaction(async()=>{
   const team=await db.collection("teams").findOne({_id:id,status:"open"},{session:s});
   if(!team)throw Error("TEAM_NOT_FOUND");
   if(team.leaderId!==user.userId)throw Error("NOT_LEADER");
   const request=await db.collection("joinRequests").findOne({_id:requestId,teamId:id,status:"pending"},{session:s});
   if(!request)throw Error("REQUEST_INACTIVE");
   if(parsed.data.decision==="decline"){
    const changed=await db.collection("joinRequests").updateOne({_id:requestId,status:"pending"},{$set:{status:"declined",decidedBy:user.userId,decidedAt:now}},{session:s});
    if(!changed.modifiedCount)throw Error("REQUEST_INACTIVE");
    await db.collection("audit").insertOne({hackathonId:team.hackathonId,teamId:id,actorId:user.userId,targetUserId:request.userId,action:"JOIN_REQUEST_DECLINED",createdAt:now},{session:s});
    decisionStatus="declined";return;
   }
   const existing=await db.collection("memberships").findOne({hackathonId:team.hackathonId,userId:request.userId},{session:s});
   if(existing)throw Error("ALREADY_MEMBER");
   await db.collection("memberships").insertOne({hackathonId:team.hackathonId,teamId:id,userId:request.userId,name:request.name,skills:request.skills||[],joinedAt:now},{session:s});
   const seat=await db.collection("teams").updateOne({_id:id,status:"open",memberCount:{$lt:team.maxSize}},{$inc:{memberCount:1},$set:{updatedAt:now}},{session:s});
   if(!seat.modifiedCount)throw Error("TEAM_FULL");
   const changed=await db.collection("joinRequests").updateOne({_id:requestId,status:"pending"},{$set:{status:"accepted",decidedBy:user.userId,decidedAt:now}},{session:s});
   if(!changed.modifiedCount)throw Error("REQUEST_INACTIVE");
   await db.collection("audit").insertOne({hackathonId:team.hackathonId,teamId:id,actorId:user.userId,targetUserId:request.userId,action:"JOIN_REQUEST_ACCEPTED",createdAt:now},{session:s});
   decisionStatus="accepted";
  }));
  return NextResponse.json({ok:true,status:decisionStatus});
 }catch(e){const m=e instanceof Error?e.message:"";const map:Record<string,[string,number]>={TEAM_NOT_FOUND:["Team not found or closed",404],NOT_LEADER:["Only the team leader can accept or decline requests",403],REQUEST_INACTIVE:["Join request is no longer pending",409],TEAM_FULL:["Team is full; request remains pending",409],ALREADY_MEMBER:["Applicant already belongs to a team in this hackathon",409]};const [error,status]=map[m]??(m.includes("duplicate key")?["Applicant already belongs to a team in this hackathon",409]:["Could not process join request",500]);return NextResponse.json({error},{status})}
}
