import {MongoClient,ObjectId} from "mongodb";
import bcrypt from "bcryptjs";

const uri=process.env.MONGODB_URI;
if(!uri)throw new Error("MONGODB_URI is required");
if(process.env.NODE_ENV==="production")throw new Error("Refusing to seed when NODE_ENV=production");
if(process.env.ALLOW_DEMO_SEED!=="true")throw new Error("Demo seeding is disabled. Set ALLOW_DEMO_SEED=true only for an isolated test database.");
const hackathonId=process.env.SEED_HACKATHON_ID||"hack4hack-crew-hiring-2026";
const reset=process.argv.includes("--reset");
const client=new MongoClient(uri,{maxPoolSize:20});
const skills=["Frontend","Backend","React","Node.js","Python","Machine Learning","UI/UX","DevOps","Cloud","Database","Cybersecurity","Mobile","Data Science","Product Design"];
const timeZones=["Asia/Kolkata","America/Los_Angeles","America/New_York","Europe/London","Europe/Berlin","Asia/Singapore","Asia/Tokyo","Australia/Sydney","Africa/Nairobi","America/Sao_Paulo"];
try{
 await client.connect();
 const db=client.db();
 const demoPassword=process.env.SEED_DEMO_PASSWORD;
 if(!demoPassword||Buffer.byteLength(demoPassword,"utf8")<16||Buffer.byteLength(demoPassword,"utf8")>72||/replace-with|ci-only-demo-password/i.test(demoPassword))throw new Error("Set SEED_DEMO_PASSWORD to a unique, non-placeholder value between 16 and 72 UTF-8 bytes.");
 const passwordHash=await bcrypt.hash(demoPassword,12);
 const judgePassword=process.env.JUDGE_DEMO_PASSWORD;
 if(!judgePassword||Buffer.byteLength(judgePassword,"utf8")<16||Buffer.byteLength(judgePassword,"utf8")>72||/replace-with|ci-only-demo-password/i.test(judgePassword))throw new Error("Set JUDGE_DEMO_PASSWORD to a unique value between 16 and 72 UTF-8 bytes.");
 const judgePasswordHash=await bcrypt.hash(judgePassword,12);
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
   db.collection("joinRequests").deleteMany({hackathonId}),
   db.collection("audit").deleteMany({hackathonId}),
   db.collection("idempotency").deleteMany({hackathonId})
  ]);
  console.log("Removed existing hackathon demo records:",ids.length,"teams");
 }
 const users=Array.from({length:10000},(_,i)=>({email:"demo+"+String(i+1).padStart(5,"0")+"@crewforge.local",name:"Participant "+String(i+1).padStart(5,"0"),timeZone:timeZones[i%timeZones.length],skills:[skills[i%skills.length]],passwordHash,emailVerified:true,sessionVersion:0,createdAt:new Date()}));
 for(let i=0;i<users.length;i+=1000){
  await db.collection("users").bulkWrite(users.slice(i,i+1000).map(u=>({updateOne:{filter:{email:u.email},update:{$set:u},upsert:true}})),{ordered:false});
 }
 await db.collection("users").updateMany({email:/^demo\+\d{5}@crewforge\.local$/},{$set:{emailVerified:true,sessionVersion:0}});
 const userDocs=await db.collection("users").find({email:/^demo\+\d{5}@crewforge\.local$/},{projection:{_id:1,email:1,name:1,timeZone:1,skills:1}}).sort({email:1}).toArray();
 if(userDocs.length!==10000)throw new Error("Expected 10,000 demo users; found "+userDocs.length);
 for(let i=0;i<userDocs.length;i+=1000){
  await db.collection("users").bulkWrite(userDocs.slice(i,i+1000).map((u,j)=>({updateOne:{filter:{_id:u._id},update:{$set:{timeZone:timeZones[(i+j)%timeZones.length],skills:[skills[(i+j)%skills.length]]}}}})),{ordered:false});
 }
 const profiledUsers=await db.collection("users").find({email:/^demo\+\d{5}@crewforge\.local$/},{projection:{_id:1,email:1,name:1,timeZone:1,skills:1}}).sort({email:1}).toArray();
 await db.collection("users").updateOne({email:"judge.leader@crewforge.demo"},{$set:{email:"judge.leader@crewforge.demo",name:"Judge Demo Leader",timeZone:"Asia/Kolkata",skills:["React","Python","DevOps"],passwordHash:judgePasswordHash,emailVerified:true,sessionVersion:0,createdAt:new Date()}},{upsert:true});
 await db.collection("users").updateOne({email:"judge.joiner@crewforge.demo"},{$set:{email:"judge.joiner@crewforge.demo",name:"Judge Demo Joiner",timeZone:"Europe/London",skills:["React","Python"],passwordHash:judgePasswordHash,emailVerified:true,sessionVersion:0,createdAt:new Date()}},{upsert:true});
 const teams=[],memberships=[];
 for(let i=0;i<2000;i++){
  const id=new ObjectId(),base=i*3,teamSkills=[skills[i%skills.length],skills[(i+4)%skills.length],skills[(i+8)%skills.length]];
  teams.push({_id:id,hackathonId,name:"Crew "+String(i+1).padStart(4,"0"),description:"A seeded team for testing discovery, matching and capacity controls. Two seats remain open.",skills:teamSkills,minSize:2,maxSize:5,leaderId:profiledUsers[base]._id.toString(),memberCount:3,status:"open",seeded:true,createdAt:new Date(Date.now()-i*1000),updatedAt:new Date()});
  for(let j=0;j<3;j++)memberships.push({hackathonId,teamId:id,userId:profiledUsers[base+j]._id.toString(),name:profiledUsers[base+j].name,skills:profiledUsers[base+j].skills,timeZone:profiledUsers[base+j].timeZone,seeded:true,joinedAt:new Date(Date.now()-j*1000)});
 }
 await db.collection("teams").insertMany(teams,{ordered:false});
 for(let i=0;i<memberships.length;i+=1000)await db.collection("memberships").insertMany(memberships.slice(i,i+1000),{ordered:false});
 console.log(JSON.stringify({hackathonId,users:10000,teams:2000,memberships:6000,unassignedParticipants:4000,openSeats:4000,timeZones:timeZones.length,judgeAccounts:2},null,2));
}finally{await client.close();}
