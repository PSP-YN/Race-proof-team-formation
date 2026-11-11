import { MongoClient, ObjectId } from "mongodb";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const uri = process.env.MONGODB_TEST_URI;
if (!uri) throw new Error("MONGODB_TEST_URI is required; run this against a disposable MongoDB replica set");
const databaseName = "crewforge_chaos_test";
const hackathonId = "chaos-" + randomUUID();
const teamId = new ObjectId();
const requestId = new ObjectId();
const victimId = "chaos-victim-" + randomUUID();
const client = new MongoClient(uri, { maxPoolSize: 4, retryWrites: true });
await client.connect();
const db = client.db(databaseName);
let child;
try {
  await db.collection("teams").insertOne({ _id: teamId, hackathonId, name: "Chaos test", status: "open", leaderId: "leader", memberCount: 1, maxSize: 2, decisionVersion: 0 });
  await db.collection("memberships").insertOne({ hackathonId, teamId, userId: "leader", name: "Leader", joinedAt: new Date() });
  await db.collection("joinRequests").insertOne({ _id: requestId, hackathonId, teamId, userId: victimId, name: "Interrupted participant", status: "pending", createdAt: new Date() });

  child = spawn(process.execPath, [new URL("./transaction-worker.mjs", import.meta.url).pathname, databaseName, hackathonId, teamId.toString(), requestId.toString(), victimId], {
    env: { ...process.env, MONGODB_TEST_URI: uri }, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "", errorOutput = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { errorOutput += chunk; });
  const staged = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Worker did not stage its transaction within 15 seconds: " + errorOutput)), 15000);
    child.stdout.on("data", chunk => {
      if ((output + chunk).includes("STAGED")) { clearTimeout(timeout); resolve(true); }
    });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code, signal) => { if (!output.includes("STAGED")) { clearTimeout(timeout); reject(new Error(`Worker exited before staging: ${code}/${signal} ${errorOutput}`)); } });
  });
  if (!staged) throw new Error("Transaction worker failed to stage writes");
  child.kill("SIGKILL");
  await new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timeout = setTimeout(() => reject(new Error("Worker did not terminate after SIGKILL")), 5000);
    child.once("exit", () => { clearTimeout(timeout); resolve(); });
  });
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  await new Promise(resolve => setTimeout(resolve, 300));

  const [team, memberCount, request, acceptedAudit] = await Promise.all([
    db.collection("teams").findOne({ _id: teamId }),
    db.collection("memberships").countDocuments({ hackathonId, teamId }),
    db.collection("joinRequests").findOne({ _id: requestId }),
    db.collection("audit").countDocuments({ hackathonId, teamId, action: "JOIN_REQUEST_ACCEPTED" }),
  ]);
  const intact = team?.memberCount === 1 && memberCount === 1 && request?.status === "pending" && acceptedAudit === 0;
  if (!intact) throw new Error(JSON.stringify({ memberCount: team?.memberCount, membershipRows: memberCount, requestStatus: request?.status, acceptedAudit }));
  console.log(JSON.stringify({ result: "PASS", fault: "SIGKILL after transaction writes, before commit", teamMemberCount: team.memberCount, membershipRows: memberCount, requestStatus: request.status, acceptanceAuditEvents: acceptedAudit }, null, 2));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await Promise.all([
    db.collection("memberships").deleteMany({ hackathonId }),
    db.collection("teams").deleteMany({ hackathonId }),
    db.collection("joinRequests").deleteMany({ hackathonId }),
    db.collection("audit").deleteMany({ hackathonId }),
  ]);
  await client.close();
}
// The worker's stdio handles can remain referenced after SIGKILL on some Node runtimes.
await new Promise(resolve => process.stdout.write("", resolve));
process.exit(0);
