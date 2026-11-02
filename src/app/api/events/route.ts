import {NextRequest} from "next/server";
import {database} from "@/lib/db";
import {getSession} from "@/lib/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=25;

export async function GET(req:NextRequest){
 const hackathonId=req.nextUrl.searchParams.get("hackathonId");
 if(!hackathonId||hackathonId.length>100)return new Response("Invalid hackathonId",{status:400});
 const session=await getSession();
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   let closed=false,changeStream:ReturnType<Awaited<ReturnType<typeof database>>["watch"]>|undefined;
   const send=(event:string,data:unknown)=>{if(!closed)controller.enqueue(encoder.encode("event: "+event+"\ndata: "+JSON.stringify(data)+"\n\n"))};
   const heartbeat=setInterval(()=>send("heartbeat",{at:Date.now()}),8000);
   const stop=()=>{closed=true;clearInterval(heartbeat);try{void changeStream?.close()}catch{}};
   req.signal.addEventListener("abort",stop,{once:true});
   try{
    const db=await database();
    const pipeline=[
     {$match:{"fullDocument.hackathonId":hackathonId,operationType:{$in:["insert","update","replace","delete"]}}},
    ];
    changeStream=db.watch(pipeline,{fullDocument:"updateLookup",maxAwaitTimeMS:3000});
    send("connected",{at:Date.now()});
    const timeout=new Promise<void>(resolve=>setTimeout(resolve,18000));
    const consume=async()=>{for await(const change of changeStream!){if(closed)break;send("board.updated",{operation:change.operationType});}};
    await Promise.race([consume(),timeout]);
   }catch(error){send("stream.error",{message:"Realtime stream unavailable"});}
   finally{stop();try{controller.close()}catch{}}
  },
  cancel(){/* request abort handler closes the change stream */},
 });
 return new Response(stream,{headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}});
}
