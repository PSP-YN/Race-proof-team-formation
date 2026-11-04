import {MongoClient,Db} from "mongodb";
const g=globalThis as typeof globalThis&{mongoPromise?:Promise<MongoClient>;indexesPromise?:Promise<void>};
function getClientPromise():Promise<MongoClient>{
 const uri=process.env.MONGODB_URI;
 if(!uri)throw new Error("MONGODB_URI is required at runtime");
 if(!g.mongoPromise){
  const pending=new MongoClient(uri,{maxPoolSize:40,minPoolSize:2,retryWrites:true,serverSelectionTimeoutMS:10000}).connect();
  g.mongoPromise=pending.catch(error=>{g.mongoPromise=undefined;throw error});
 }
 return g.mongoPromise;
}
export async function mongoClient(){return getClientPromise()}
// Index creation is part of startup correctness: unique indexes protect invariants even when requests race.
// Cache initialization per runtime instance and clear the promise after failure so a transient DB error can recover.
export async function database():Promise<Db>{
 const db=(await getClientPromise()).db();
 if(!g.indexesPromise){
  const pending=Promise.all([
   db.collection("users").updateMany({emailVerified:{$exists:false}},{$set:{emailVerified:false,sessionVersion:0}}),
   db.collection("users").createIndex({email:1},{unique:true}),
   db.collection("teams").createIndex({hackathonId:1,name:1},{unique:true}),
   db.collection("teams").createIndex({hackathonId:1,status:1,createdAt:-1},),
   db.collection("memberships").createIndex({hackathonId:1,userId:1},{unique:true}),
   db.collection("memberships").createIndex({teamId:1,joinedAt:1},),
   db.collection("joinRequests").createIndex({userId:1,idempotencyKey:1},{unique:true}),
   db.collection("joinRequests").createIndex({hackathonId:1,userId:1},{unique:true,partialFilterExpression:{status:"pending"}}),
   db.collection("joinRequests").createIndex({teamId:1,status:1,createdAt:1}),
   db.collection("invites").createIndex({tokenHash:1},{unique:true}),
   db.collection("invites").createIndex({expiresAt:1},{expireAfterSeconds:0}),
   db.collection("audit").createIndex({hackathonId:1,createdAt:-1},),
   db.collection("rateLimits").createIndex({expiresAt:1},{expireAfterSeconds:0}),
   db.collection("securityEvents").createIndex({createdAt:1},{expireAfterSeconds:60*60*24*30}),
   db.collection("securityEvents").createIndex({scope:1,createdAt:-1},{name:"security_event_timeline"}),
   db.collection("invites").createIndex({teamId:1,createdAt:-1},{name:"team_invites"}),
   db.collection("authTokens").createIndex({tokenHash:1},{unique:true}),
   db.collection("authTokens").createIndex({expiresAt:1},{expireAfterSeconds:0}),
   db.collection("authTokens").createIndex({userId:1,purpose:1},{name:"auth_token_owner"})
  ]).then(()=>undefined);
  g.indexesPromise=pending.catch(error=>{g.indexesPromise=undefined;throw error});
 }
 await g.indexesPromise;
 return db;
}
