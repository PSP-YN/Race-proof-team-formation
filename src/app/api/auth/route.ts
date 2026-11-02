import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSession,loginUser,registerUser,getSession} from "@/lib/auth";
import {cookies} from "next/headers";
import {guardMutation} from "@/lib/security";
export const runtime="nodejs";
export async function GET(){try{return NextResponse.json({user:await getSession()},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({user:null},{headers:{"Cache-Control":"no-store"}})}}
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("register"),email:z.email().max(254),name:z.string().trim().min(2).max(60),password:z.string().min(10).max(100)}),
 z.object({action:z.literal("login"),email:z.email().max(254),password:z.string().min(1).max(100)}),
 z.object({action:z.literal("logout")})
]);
export async function POST(req:NextRequest){
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 const identity=parsed.success&&"email" in parsed.data?parsed.data.email:undefined;
 const blocked=await guardMutation(req,"auth",3000,15*60_000,identity,10);if(blocked)return blocked;
 if(!parsed.success)return NextResponse.json({error:"Please check the submitted fields."},{status:400});
 const d=parsed.data;
 try{
  if(d.action==="logout"){(await cookies()).delete("crewforge_session");return NextResponse.json({ok:true})}
  const user=d.action==="register"?await registerUser(d.email,d.name,d.password):await loginUser(d.email,d.password);
  await createSession(user);
  return NextResponse.json({user},{status:d.action==="register"?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const m=e instanceof Error?e.message:"";
  if(m.includes("duplicate key"))return NextResponse.json({error:"Email already registered"},{status:409});
  if(m==="Invalid email or password")return NextResponse.json({error:m},{status:401});
  if(m.startsWith("Password")||m==="Enter a valid email"||m.startsWith("Name must"))return NextResponse.json({error:m},{status:400});
  return NextResponse.json({error:"Authentication service is temporarily unavailable"},{status:500});
 }
}
