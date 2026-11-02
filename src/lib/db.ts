import {MongoClient,Db} from "mongodb";
const uri=process.env.MONGODB_URI;if(!uri)throw new Error("MONGODB_URI is required");
const g=globalThis as typeof globalThis&{mongo?:Promise<MongoClient>};
const clientPromise=g.mongo??new MongoClient(uri,{maxPoolSize:30,minPoolSize:2,retryWrites:true,serverSelectionTimeoutMS:10000}).connect();
if(process.env.NODE_ENV!=="production")g.mongo=clientPromise;
export async function database():Promise<Db>{const db=(await clientPromise).db();await Promise.all([
db.collection("users").createIndex({email:1},{unique:true}),
db.collection("teams").createIndex({hackathonId:1,name:1},{unique:true}),
db.collection("teams").createIndex({hackathonId:1,status:1,createdAt:-1}),
db.collection("memberships").createIndex({hackathonId:1,userId:1},{unique:true}),
db.collection("memberships").createIndex({teamId:1,joinedAt:1}),
db.collection("invites").createIndex({tokenHash:1},{unique:true}),
db.collection("invites").createIndex({expiresAt:1},{expireAfterSeconds:0}),
db.collection("idempotency").createIndex({userId:1,key:1},{unique:true}),
db.collection("audit").createIndex({hackathonId:1,createdAt:-1})]);return db;}