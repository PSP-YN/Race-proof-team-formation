import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { joinTeamTransaction } from "../../src/lib/team-membership";

const uri = process.env.MONGODB_TEST_URI;
describe.skipIf(!uri)("MongoDB membership transaction integration", () => {
  let client: MongoClient;
  let db: ReturnType<MongoClient["db"]>;
  const hackathonId = "race-test-" + randomUUID();
  const teamId = new ObjectId();

  beforeAll(async () => {
    client = new MongoClient(uri!, { maxPoolSize: 60, retryWrites: true });
    await client.connect();
    db = client.db("crewforge_race_test");
    await db.collection("memberships").createIndex({ hackathonId: 1, userId: 1 }, { unique: true });
    await db.collection("idempotency").createIndex({ userId: 1, key: 1 }, { unique: true });
    await db.collection("teams").insertOne({ _id: teamId, hackathonId, maxSize: 2, memberCount: 1, status: "open" });
    await db.collection("memberships").insertOne({ hackathonId, teamId, userId: "leader", joinedAt: new Date() });
  }, 30000);

  afterAll(async () => {
    if (client) {
      await db.collection("memberships").deleteMany({ hackathonId });
      await db.collection("idempotency").deleteMany({ hackathonId });
      await db.collection("audit").deleteMany({ hackathonId });
      await db.collection("teams").deleteMany({ hackathonId });
      await client.close();
    }
  });

  it("admits exactly one of 50 concurrent contenders for the final seat", async () => {
    const contenders = Array.from({ length: 50 }, (_, i) => "contender-" + i);
    const attempts = contenders.map(async userId => {
      try {
        await joinTeamTransaction(client, db, {
          hackathonId,
          teamId,
          userId,
          name: userId,
          skills: [],
          idempotencyKey: "race-key-" + userId,
        });
        return "joined";
      } catch {
        return "rejected";
      }
    });

    const results = await Promise.all(attempts);
    expect(results.filter(result => result === "joined")).toHaveLength(1);
    expect(await db.collection("memberships").countDocuments({ hackathonId })).toBe(2);
    expect((await db.collection("teams").findOne({ _id: teamId }))?.memberCount).toBe(2);
    expect(await db.collection("idempotency").countDocuments({ hackathonId })).toBe(1);
    expect(await db.collection("audit").countDocuments({ hackathonId, action: "MEMBER_JOINED" })).toBe(1);
  }, 60000);

  it("enforces one membership per participant across two teams", async () => {
    const secondTeamId = new ObjectId();
    const thirdTeamId = new ObjectId();
    await db.collection("teams").insertMany([
      { _id: secondTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
      { _id: thirdTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
    ]);
    const userId = "same-participant";
    const attempts = await Promise.allSettled([
      joinTeamTransaction(client, db, { hackathonId, teamId: secondTeamId, userId, name: userId, skills: [], idempotencyKey: "cross-team-a" }),
      joinTeamTransaction(client, db, { hackathonId, teamId: thirdTeamId, userId, name: userId, skills: [], idempotencyKey: "cross-team-b" }),
    ]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.collection("memberships").countDocuments({ hackathonId, userId })).toBe(1);
  }, 60000);

  it("treats the same idempotency key and target as one logical join", async () => {
    const idempotentTeamId = new ObjectId();
    await db.collection("teams").insertOne({ _id: idempotentTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" });
    const userId = "idempotent-participant";
    const input = { hackathonId, teamId: idempotentTeamId, userId, name: userId, skills: [], idempotencyKey: "same-target-key" };
    await joinTeamTransaction(client, db, input);
    await joinTeamTransaction(client, db, input);
    expect(await db.collection("memberships").countDocuments({ hackathonId, userId })).toBe(1);
    expect((await db.collection("teams").findOne({ _id: idempotentTeamId }))?.memberCount).toBe(2);
  });

  it("rejects reuse of an idempotency key for a different team", async () => {
    const firstTeamId = new ObjectId();
    const secondTeamId = new ObjectId();
    await db.collection("teams").insertMany([
      { _id: firstTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
      { _id: secondTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
    ]);
    const userId = "conflicting-idempotency-participant";
    const input = { hackathonId, teamId: firstTeamId, userId, name: userId, skills: [], idempotencyKey: "conflicting-key" };
    await joinTeamTransaction(client, db, input);
    await expect(joinTeamTransaction(client, db, { ...input, teamId: secondTeamId })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
