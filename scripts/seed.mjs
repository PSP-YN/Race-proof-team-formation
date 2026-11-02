import {MongoClient,ObjectId} from "mongodb";
import bcrypt from "bcryptjs";

const uri=process.env.MONGODB_URI;
if(!uri)throw new Error("MONGODB_URI is required");
if(process.env.NODE_ENV==="production")throw new Error("Refusing to seed when NODE_ENV=production");
const hackathonId=process.env.SEED_HACKATHON_ID||"hack4hack-crew-hiring-2026";
const reset=process.argv.includes("--reset");
const client=new MongoClient(uri,{maxPoolSize:20});
const skills=["Frontend","Backend","React","Node.js","Python","Machine Learning","UI/UX","DevOps","Cloud","Database","Cybersecurity","Mobile","Data Science","Product Design"];
try{
 await client.connect();
 const db=client.db();
 await db.collection("users").createIndex({email:1},{unique:true});
 await db.collection("teams").createIndex({hackathonId:1,name:1},{unique:true});
 await db.collection("memberships").createIndex({hackathonId:1,userId:1},{unique:true});
 const existing=await db.collection("teams").countDocuments({hackathonId});
 if(existing&&!reset)throw new Error("Seed data already exists for this hackathon. Use --reset to replace only this hackathon's demo data.");
 if(reset){
  const teams=await db.collection("teams").find({hackathonId},{projection:{_id:1}}).toArray();
  const ids=teams.map(t=>t._id);
  await Promise.all([
   db.collection("teams").deleteMany({hackathonId}),
   db.collection("memberships").deleteMany({hackathonId}),
   db.collection("invites").deleteMany({hackathonId}),
   db.collection("audit").deleteMany({hackathonId}),
   db.collection("idempotency").deleteMany({hackathonId})
  ]);
  console.log("Removed existing hackathon demo records:",ids.length,"teams");
 }
 const demoPassword=process.env.SEED_DEMO_PASSWORD;
 if(!demoPassword||Buffer.byteLength(demoPassword,"utf8")<16||Buffer.byteLength(demoPassword,"utf8")>72)throw new Error("Set SEED_DEMO_PASSWORD to a unique value between 16 and 72 UTF-8 bytes.");
 const passwordHash=await bcrypt.hash(demoPassword,12);
 const users=Array.from({length:10000},(_,i)=>({email:"demo+"+String(i+1).padStart(5,"0")+"@crewforge.local",name:"Participant "+String(i+1).padStart(5,"0"),passwordHash,emailVerified:true,sessionVersion:0,createdAt:new Date()}));
 for(let i=0;i<users.length;i+=1000){
  await db.collection("users").bulkWrite(users.slice(i,i+1000).map(u=>({updateOne:{filter:{email:u.email},update:{$setOnInsert:u},upsert:true}})),{ordered:false});
 }
 await db.collection("users").updateMany({email:/^demo\\+\\d{5}@crewforge\\.local$/},{$set:{emailVerified:true,sessionVersion:0}});
 const userDocs=await db.collection("users").find({email:/^demo\+\d{5}@crewforge\.local$/},{projection:{_id:1,email:1,name:1}}).sort({email:1}).toArray();
 if(userDocs.length!==10000)throw new Error("Expected 10,000 demo users; found "+userDocs.length);
 const teams=[],memberships=[];
 for(let i=0;i<2000;i++){
  const id=new ObjectId(),base=i*5,teamSkills=[skills[i%skills.length],skills[(i+4)%skills.length],skills[(i+8)%skills.length]];
  teams.push({_id:id,hackathonId,name:"Crew "+String(i+1).padStart(4,"0"),description:"A seeded team for testing discovery, matching and capacity controls.",skills:teamSkills,minSize:2,maxSize:5,leaderId:userDocs[base]._id.toString(),memberCount:4,status:"open",createdAt:new Date(Date.now()-i*1000),updatedAt:new Date()});
  for(let j=0;j<4;j++)memberships.push({hackathonId,teamId:id,userId:userDocs[base+j]._id.toString(),name:userDocs[base+j].name,skills:[skills[(base+j)%skills.length]],joinedAt:new Date(Date.now()-j*1000)});
 }
 await db.collection("teams").insertMany(teams,{ordered:false});
 for(let i=0;i<memberships.length;i+=1000)await db.collection("memberships").insertMany(memberships.slice(i,i+1000),{ordered:false});
 console.log(JSON.stringify({hackathonId,users:10000,teams:2000,memberships:8000,openSeats:2000},null,2));
}finally{await client.close();}
