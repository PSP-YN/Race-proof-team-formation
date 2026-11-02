import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {database} from "@/lib/db";
export const runtime="nodejs";
export async function GET(){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in required"},{status:401});
 const allowed=(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(session.email.toLowerCase()))return NextResponse.json({error:"Admin access required"},{status:403});
 try{
  const db=await database(),since=new Date(Date.now()-7*86400000);
  const events=await db.collection("securityEvents").find({createdAt:{$gte:since}},{projection:{_id:0,scope:1,event:1,createdAt:1,metadata:1}}).sort({createdAt:-1}).limit(200).toArray();
  const totals=await db.collection("securityEvents").aggregate([{$match:{createdAt:{$gte:since}}},{$group:{_id:"$event",count:{$sum:1}}},{$sort:{count:-1}}]).toArray();
  return NextResponse.json({events,totals,windowDays:7},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not load security telemetry"},{status:500})}
}
