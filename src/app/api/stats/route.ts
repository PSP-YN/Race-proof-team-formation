import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const hackathonId=req.nextUrl.searchParams.get("hackathonId")??process.env.NEXT_PUBLIC_HACKATHON_ID??"hack4hack-crew-hiring-2026";
 try{
  const db=await database();
  const [participants,teams,memberships]=await Promise.all([
   db.collection("users").countDocuments({email:/^demo\+\d{5}@crewforge\.local$/}),
   db.collection("teams").countDocuments({hackathonId}),
   db.collection("memberships").countDocuments({hackathonId})
  ]);
  return NextResponse.json({dataset:{participants,teams,memberships,kind:"seeded-test-data",source:"MongoDB",asOf:new Date().toISOString()}},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Dataset metrics are unavailable until the database is configured"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
