import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { requestJoinTransaction, decideJoinRequestTransaction, removeTeamMemberTransaction } from "../../src/lib/team-requests";

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
    await db.collection("joinRequests").createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true });
    await db.collection("joinRequests").createIndex({ hackathonId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
    await db.collection("teams").insertOne({ _id: teamId, hackathonId, maxSize: 2, memberCount: 1, status: "open", leaderId: "leader" });
    await db.collection("memberships").insertOne({ hackathonId, teamId, userId: "leader", joinedAt: new Date() });
  }, 30000);

  afterAll(async () => {
    if (client) {
      await db.collection("memberships").deleteMany({ hackathonId });
      await db.collection("audit").deleteMany({ hackathonId });
      await db.collection("joinRequests").deleteMany({ hackathonId });
      await db.collection("teams").deleteMany({ hackathonId });
      await client.close();
    }
  });


  it("approves exactly one of 50 concurrent join requests for the final seat", async () => {
    const contenders = Array.from({ length: 50 }, (_, i) => "approval-contender-" + i);
    const created = await Promise.all(contenders.map(userId => requestJoinTransaction(client, db, {
      hackathonId, teamId, userId, name: userId, skills: [], idempotencyKey: "approval-key-" + userId,
    })));
    expect(created).toHaveLength(50);
    expect(await db.collection("joinRequests").countDocuments({ hackathonId, teamId, status: "pending" })).toBe(50);
    expect((await db.collection("teams").findOne({ _id: teamId }))?.memberCount).toBe(1);

    const attempts = created.map(request => decideJoinRequestTransaction(client, db, {
      teamId, requestId: new ObjectId(request.requestId), leaderId: "leader", decision: "accept",
    }).then(() => "accepted").catch(error => error instanceof Error && error.message === "TEAM_FULL" ? "rejected" : Promise.reject(error)));

    const results = await Promise.all(attempts);
    expect(results.filter(result => result === "accepted")).toHaveLength(1);
    expect(results.filter(result => result === "rejected")).toHaveLength(49);
    expect(await db.collection("memberships").countDocuments({ hackathonId, teamId })).toBe(2);
    expect((await db.collection("teams").findOne({ _id: teamId }))?.memberCount).toBe(2);
    expect(await db.collection("joinRequests").countDocuments({ hackathonId, teamId, status: "accepted" })).toBe(1);
    expect(await db.collection("joinRequests").countDocuments({ hackathonId, teamId, status: "pending" })).toBe(49);
    expect(await db.collection("audit").countDocuments({ hackathonId, teamId, action: "JOIN_REQUEST_ACCEPTED" })).toBe(1);
  }, 60000);

  it("enforces one membership per participant per hackathon with the unique index", async () => {
    const secondTeamId = new ObjectId();
    const thirdTeamId = new ObjectId();
    await db.collection("teams").insertMany([
      { _id: secondTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
      { _id: thirdTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
    ]);
    const userId = "same-participant";
    await db.collection("memberships").insertOne({ hackathonId, teamId: secondTeamId, userId, joinedAt: new Date() });
    await expect(db.collection("memberships").insertOne({ hackathonId, teamId: thirdTeamId, userId, joinedAt: new Date() })).rejects.toMatchObject({ code: 11000 });
    expect(await db.collection("memberships").countDocuments({ hackathonId, userId })).toBe(1);
  });

  it("creates a pending join request idempotently without reserving a seat", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 3, memberCount: 1, status: "open", leaderId: "leader" });
    const input = { hackathonId, teamId: requestTeam, userId: "requester-one", name: "Requester One", skills: ["React"], idempotencyKey: "join-request-key-1" };
    const first = await requestJoinTransaction(client, db, input);
    const replay = await requestJoinTransaction(client, db, input);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.requestId).toBe(first.requestId);
    expect(await db.collection("joinRequests").countDocuments({ teamId: requestTeam, status: "pending" })).toBe(1);
    expect((await db.collection("teams").findOne({ _id: requestTeam }))?.memberCount).toBe(1);
  });

  it("allows only one pending request per participant across teams", async () => {
    const firstTeamId = new ObjectId();
    const secondTeamId = new ObjectId();
    await db.collection("teams").insertMany([
      { _id: firstTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
      { _id: secondTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
    ]);
    const userId = "one-pending-request-user";
    const results = await Promise.allSettled([
      requestJoinTransaction(client, db, { hackathonId, teamId: firstTeamId, userId, name: userId, skills: [], idempotencyKey: "pending-team-a" }),
      requestJoinTransaction(client, db, { hackathonId, teamId: secondTeamId, userId, name: userId, skills: [], idempotencyKey: "pending-team-b" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.collection("joinRequests").countDocuments({ hackathonId, userId, status: "pending" })).toBe(1);
  });

  it("allows only the leader to accept a pending request and records membership plus audit", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 3, memberCount: 1, status: "open", leaderId: "request-leader" });
    const created = await requestJoinTransaction(client, db, { hackathonId, teamId: requestTeam, userId: "accepted-user", name: "Accepted User", skills: ["Rust"], idempotencyKey: "accept-request-1" });
    await expect(decideJoinRequestTransaction(client, db, { teamId: requestTeam, requestId: new ObjectId(created.requestId), leaderId: "intruder", decision: "accept" })).rejects.toThrow("NOT_LEADER");
    const result = await decideJoinRequestTransaction(client, db, { teamId: requestTeam, requestId: new ObjectId(created.requestId), leaderId: "request-leader", decision: "accept" });
    expect(result.status).toBe("accepted");
    expect(await db.collection("memberships").countDocuments({ hackathonId, teamId: requestTeam, userId: "accepted-user" })).toBe(1);
    expect((await db.collection("teams").findOne({ _id: requestTeam }))?.memberCount).toBe(2);
    expect(await db.collection("audit").countDocuments({ teamId: requestTeam, action: "JOIN_REQUEST_ACCEPTED" })).toBe(1);
  });

  it("declines a pending request without creating membership", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 3, memberCount: 1, status: "open", leaderId: "decline-leader" });
    const created = await requestJoinTransaction(client, db, { hackathonId, teamId: requestTeam, userId: "declined-user", name: "Declined User", skills: [], idempotencyKey: "decline-request-1" });
    await decideJoinRequestTransaction(client, db, { teamId: requestTeam, requestId: new ObjectId(created.requestId), leaderId: "decline-leader", decision: "decline" });
    expect(await db.collection("memberships").countDocuments({ hackathonId, userId: "declined-user" })).toBe(0);
    expect(await db.collection("joinRequests").countDocuments({ _id: new ObjectId(created.requestId), status: "declined" })).toBe(1);
    expect(await db.collection("audit").countDocuments({ teamId: requestTeam, action: "JOIN_REQUEST_DECLINED" })).toBe(1);
  });

  it("rejects a join request when the participant is already on a team", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 3, memberCount: 1, status: "open" });
    await db.collection("memberships").insertOne({ hackathonId, teamId, userId: "already-member", joinedAt: new Date() });
    await expect(requestJoinTransaction(client, db, { hackathonId, teamId: requestTeam, userId: "already-member", name: "Already Member", skills: [], idempotencyKey: "already-member-req" })).rejects.toThrow("ALREADY_MEMBER");
  });

  it("rejects approval when the final seat has already been consumed", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 2, memberCount: 1, status: "open", leaderId: "capacity-leader" });
    await db.collection("memberships").insertOne({ hackathonId, teamId: requestTeam, userId: "capacity-leader", joinedAt: new Date() });
    const a = await requestJoinTransaction(client, db, { hackathonId, teamId: requestTeam, userId: "seat-a", name: "Seat A", skills: [], idempotencyKey: "seat-a-request" });
    const b = await requestJoinTransaction(client, db, { hackathonId, teamId: requestTeam, userId: "seat-b", name: "Seat B", skills: [], idempotencyKey: "seat-b-request" });
    await decideJoinRequestTransaction(client, db, { teamId: requestTeam, requestId: new ObjectId(a.requestId), leaderId: "capacity-leader", decision: "accept" });
    await expect(decideJoinRequestTransaction(client, db, { teamId: requestTeam, requestId: new ObjectId(b.requestId), leaderId: "capacity-leader", decision: "accept" })).rejects.toThrow("TEAM_FULL");
    expect((await db.collection("teams").findOne({ _id: requestTeam }))?.memberCount).toBe(2);
    expect(await db.collection("memberships").countDocuments({ hackathonId, teamId: requestTeam })).toBe(2);
  });

  it("allows the leader to remove a member and audits the removal", async () => {
    const requestTeam = new ObjectId();
    await db.collection("teams").insertOne({ _id: requestTeam, hackathonId, maxSize: 4, memberCount: 2, status: "open", leaderId: "remove-leader" });
    await db.collection("memberships").insertMany([
      { hackathonId, teamId: requestTeam, userId: "remove-leader", name: "Leader", joinedAt: new Date(1) },
      { hackathonId, teamId: requestTeam, userId: "remove-target", name: "Target", joinedAt: new Date(2) },
    ]);
    await expect(removeTeamMemberTransaction(client, db, { teamId: requestTeam, userId: "remove-target", leaderId: "not-leader" })).rejects.toThrow("NOT_LEADER");
    await removeTeamMemberTransaction(client, db, { teamId: requestTeam, userId: "remove-target", leaderId: "remove-leader" });
    expect(await db.collection("memberships").countDocuments({ teamId: requestTeam })).toBe(1);
    expect((await db.collection("teams").findOne({ _id: requestTeam }))?.memberCount).toBe(1);
    expect(await db.collection("audit").countDocuments({ teamId: requestTeam, action: "MEMBER_REMOVED", targetUserId: "remove-target" })).toBe(1);
  });

  it("prevents a leader from removing themselves through the member-removal endpoint", async () => {
    await expect(removeTeamMemberTransaction(client, db, { teamId, userId: "leader", leaderId: "leader" })).rejects.toThrow("CANNOT_REMOVE_LEADER");
  });

  it("rejects reuse of a request idempotency key for a different team", async () => {
    const firstTeamId = new ObjectId();
    const secondTeamId = new ObjectId();
    await db.collection("teams").insertMany([
      { _id: firstTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
      { _id: secondTeamId, hackathonId, maxSize: 3, memberCount: 1, status: "open" },
    ]);
    const input = { hackathonId, teamId: firstTeamId, userId: "conflicting-idempotency-participant", name: "Conflict", skills: [], idempotencyKey: "conflicting-key" };
    await requestJoinTransaction(client, db, input);
    await expect(requestJoinTransaction(client, db, { ...input, teamId: secondTeamId })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
