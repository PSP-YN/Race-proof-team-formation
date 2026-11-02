import {NextRequest,NextResponse} from "next/server";
import {ObjectId} from "mongodb";
import {database} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {guardMutation} from "@/lib/security";

export async function GET(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 try{
  const db=await database(),team=await db.collection("teams").findOne({_id:new ObjectId(teamId),leaderId:user.userId},{projection:{_id:1}});
  if(!team)return NextResponse.json({error:"Team not found or leader access required"},{status:404});
  const invites=await db.collection("invites").find({teamId:team._id,usedAt:null,revokedAt:null,expiresAt:{$gt:new Date()}},{projection:{createdAt:1,expiresAt:1,createdBy:1}}).sort({createdAt:-1}).limit(50).toArray();
  return NextResponse.json({invites:invites.map(i=>({id:i._id.toString(),createdAt:i.createdAt,expiresAt:i.expiresAt}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not load invites"},{status:500})}
}
export async function DELETE(req:NextRequest,ctx:{params:Promise<{teamId:string}>}){
 let user;try{user=await requireSession()}catch{return NextResponse.json({error:"Sign in required"},{status:401})}
 const blocked=await guardMutation(req,"invite-revoke",10000,60_000,user.userId,20);if(blocked)return blocked;
 const {teamId}=await ctx.params;if(!ObjectId.isValid(teamId))return NextResponse.json({error:"Invalid team id"},{status:400});
 const id=req.nextUrl.searchParams.get("inviteId");if(!id||!ObjectId.isValid(id))return NextResponse.json({error:"Invalid invite id"},{status:400});
 try{
  const db=await database(),team=new ObjectId(teamId),invite=new ObjectId(id),now=new Date();
  const owner=await db.collection("teams").findOne({_id:team,leaderId:user.userId},{projection:{hackathonId:1}});
  if(!owner)return NextResponse.json({error:"Only the team leader can revoke invites"},{status:403});
  const result=await db.collection("invites").updateOne({ _id:invite,teamId:team,usedAt:null,revokedAt:null,expiresAt:{$gt:now}},{$set:{revokedAt:now,revokedBy:user.userId}});
  if(!result.modifiedCount)return NextResponse.json({error:"Invite is already used, expired, revoked or does not exist"},{status:409});
  await db.collection("audit").insertOne({hackathonId:owner.hackathonId,teamId:team,actorId:user.userId,action:"INVITE_REVOKED",createdAt:now});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Could not revoke invite"},{status:500})}
}
