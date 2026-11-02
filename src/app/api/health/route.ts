import {NextResponse} from "next/server";
import {database,mongoClient} from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 try{const db=await database();await db.command({ping:1});return NextResponse.json({ok:true,service:"crewforge",checks:{database:true,emailConfigured:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),rateLimitConfigured:process.env.VERCEL==="1"||!!process.env.TRUSTED_CLIENT_IP_HEADER||process.env.NODE_ENV==="development",realtime:"mongodb-change-streams"}},{headers:{"Cache-Control":"no-store"}})}
 catch{return NextResponse.json({ok:false,service:"crewforge",error:"Service dependency unavailable"},{status:503,headers:{"Cache-Control":"no-store"}})}
}
