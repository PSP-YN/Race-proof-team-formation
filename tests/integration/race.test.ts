import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";

const uri = process.env.MONGODB_TEST_URI;
describe.skipIf(!uri)("MongoDB last-seat concurrency integration", () => {
  let client: MongoClient;
  let db: ReturnType<MongoClient["db"]>;
  const hackathonId = "race-test-" + randomUUID();
  const teamId = new ObjectId();

  beforeAll(async () => {
    client = new MongoClient(uri!, { maxPoolSize: 60, retryWrites: true });
    await client.connect();
    db = client.db("crewforge_race_test");
    await db.collection("memberships").createIndex({ hackathonId: 1, userId: 1 }, { unique: true });
    await db.collection("teams").insertOne({ _id: teamId, hackathonId, maxSize: 2, memberCount: 1, status: "open" });
    await db.collection("memberships").insertOne({ hackathonId, teamId, userId: "leader", joinedAt: new Date() });
  }, 30000);

  afterAll(async () => {
    if (client) {
      await db.collection("memberships").deleteMany({ hackathonId });
      await db.collection("teams").deleteOne({ _id: teamId });
      await client.close();
    }
  });

  it("admits exactly one of 50 concurrent contenders for the final seat", async () => {
    const contenders = Array.from({ length: 50 }, (_, i) => "contender-" + i);
    const attempts = contenders.map(async userId => {
      try {
        await client.withSession(session => session.withTransaction(async () => {
          await db.collection("memberships").insertOne({ hackathonId, teamId, userId, joinedAt: new Date() }, { session });
          const reserved = await db.collection("teams").updateOne(
            { _id: teamId, status: "open", memberCount: { $lt: 2 } },
            { $inc: { memberCount: 1 } },
            { session }
          );
          if (reserved.modifiedCount !== 1) throw new Error("TEAM_FULL");
        }));
        return "joined";
      } catch {
        return "rejected";
      }
    });
    const results = await Promise.all(attempts);
    expect(results.filter(x => x === "joined")).toHaveLength(1);
    expect(await db.collection("memberships").countDocuments({ hackathonId })).toBe(2);
    expect((await db.collection("teams").findOne({ _id: teamId }))?.memberCount).toBe(2);
  }, 60000);
});
