import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_TEST_URI;
if (!uri) throw new Error("MONGODB_TEST_URI is required");
const [databaseName, hackathonId, teamId, requestId, userId] = process.argv.slice(2);
const client = new MongoClient(uri, { maxPoolSize: 2, retryWrites: true });
await client.connect();
const db = client.db(databaseName);
const session = client.startSession();
try {
  session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  const teamObjectId = new ObjectId(teamId);
  const requestObjectId = new ObjectId(requestId);
  const now = new Date();
  await db.collection("teams").updateOne({ _id: teamObjectId, status: "open" }, { $inc: { decisionVersion: 1 } }, { session });
  await db.collection("memberships").insertOne({ hackathonId, teamId: teamObjectId, userId, name: "Interrupted participant", skills: ["Python"], timeZone: "Asia/Kolkata", joinedAt: now }, { session });
  await db.collection("teams").updateOne({ _id: teamObjectId, memberCount: { $lt: 2 } }, { $inc: { memberCount: 1 } }, { session });
  await db.collection("joinRequests").updateOne({ _id: requestObjectId, status: "pending" }, { $set: { status: "accepted", decidedAt: now } }, { session });
  await db.collection("audit").insertOne({ hackathonId, teamId: teamObjectId, actorId: "leader", targetUserId: userId, action: "JOIN_REQUEST_ACCEPTED", createdAt: now }, { session });
  process.stdout.write("STAGED\n");
  // Parent sends SIGKILL here, before commit. MongoDB must discard every staged write.
  await new Promise(() => {});
} finally {
  await session.endSession();
  await client.close();
}
