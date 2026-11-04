import type { Db, MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

export type RequestJoinInput = {
  hackathonId: string;
  teamId: ObjectId;
  userId: string;
  name: string;
  skills: string[];
  idempotencyKey: string;
};

export async function requestJoinTransaction(client: MongoClient, db: Db, input: RequestJoinInput) {
  const now = new Date();
  return client.withSession(session => session.withTransaction(async () => {
    const previous = await db.collection("joinRequests").findOne(
      { userId: input.userId, idempotencyKey: input.idempotencyKey }, { session },
    );
    if (previous) {
      if (previous.hackathonId === input.hackathonId && previous.teamId?.toString() === input.teamId.toString()) {
        return { requestId: previous._id.toString(), replayed: true };
      }
      throw new Error("IDEMPOTENCY_CONFLICT");
    }

    if (await db.collection("memberships").findOne(
      { hackathonId: input.hackathonId, userId: input.userId }, { session, projection: { _id: 1 } },
    )) throw new Error("ALREADY_MEMBER");

    const team = await db.collection("teams").findOne(
      { _id: input.teamId, hackathonId: input.hackathonId, status: "open" }, { session },
    );
    if (!team) throw new Error("TEAM_NOT_FOUND");
    if (team.memberCount >= team.maxSize) throw new Error("TEAM_FULL");

    const existing = await db.collection("joinRequests").findOne(
      { hackathonId: input.hackathonId, userId: input.userId, status: "pending" }, { session },
    );
    if (existing) {
      if (existing.teamId?.toString() === input.teamId.toString()) return { requestId: existing._id.toString(), replayed: true };
      throw new Error("PENDING_REQUEST_EXISTS");
    }

    const requestId = new ObjectId();
    await db.collection("joinRequests").insertOne({
      _id: requestId, hackathonId: input.hackathonId, teamId: input.teamId,
      userId: input.userId, name: input.name, skills: input.skills,
      status: "pending", idempotencyKey: input.idempotencyKey,
      createdAt: now, updatedAt: now,
    }, { session });
    await db.collection("audit").insertOne({
      hackathonId: input.hackathonId, teamId: input.teamId, actorId: input.userId,
      action: "JOIN_REQUEST_CREATED", targetUserId: input.userId, createdAt: now,
    }, { session });
    return { requestId: requestId.toString(), replayed: false };
  }));
}

export async function decideJoinRequestTransaction(
  client: MongoClient, db: Db, input: { teamId: ObjectId; requestId: ObjectId; leaderId: string; decision: "accept" | "decline" },
) {
  const now = new Date();
  return client.withSession(session => session.withTransaction(async () => {
    const team = await db.collection("teams").findOne({ _id: input.teamId, status: "open" }, { session });
    if (!team) throw new Error("TEAM_NOT_FOUND");
    if (team.leaderId !== input.leaderId) throw new Error("NOT_LEADER");
    // Serialize leader decisions against team capacity changes and concurrent decisions.
    const lock = await db.collection("teams").updateOne(
      { _id: input.teamId, leaderId: input.leaderId, status: "open" },
      { $inc: { decisionVersion: 1 }, $set: { updatedAt: now } }, { session },
    );
    if (!lock.matchedCount) throw new Error("NOT_LEADER");

    const request = await db.collection("joinRequests").findOne(
      { _id: input.requestId, teamId: input.teamId, hackathonId: team.hackathonId, status: "pending" }, { session },
    );
    if (!request) throw new Error("REQUEST_NOT_PENDING");

    if (input.decision === "accept") {
      if (team.memberCount >= team.maxSize) throw new Error("TEAM_FULL");
      if (await db.collection("memberships").findOne(
        { hackathonId: team.hackathonId, userId: request.userId }, { session, projection: { _id: 1 } },
      )) throw new Error("ALREADY_MEMBER");
      await db.collection("memberships").insertOne({
        hackathonId: team.hackathonId, teamId: input.teamId, userId: request.userId,
        name: request.name, skills: request.skills || [], joinedAt: now,
      }, { session });
      const reserved = await db.collection("teams").updateOne(
        { _id: input.teamId, leaderId: input.leaderId, status: "open", memberCount: { $lt: team.maxSize } },
        { $inc: { memberCount: 1 }, $set: { updatedAt: now } }, { session },
      );
      if (!reserved.modifiedCount) throw new Error("TEAM_FULL");
    }

    const status = input.decision === "accept" ? "accepted" : "declined";
    const changed = await db.collection("joinRequests").updateOne(
      { _id: input.requestId, status: "pending" }, { $set: { status, decidedAt: now, decidedBy: input.leaderId, updatedAt: now } }, { session },
    );
    if (!changed.modifiedCount) throw new Error("REQUEST_NOT_PENDING");
    await db.collection("audit").insertOne({
      hackathonId: team.hackathonId, teamId: input.teamId, actorId: input.leaderId,
      targetUserId: request.userId, action: input.decision === "accept" ? "JOIN_REQUEST_ACCEPTED" : "JOIN_REQUEST_DECLINED",
      createdAt: now,
    }, { session });
    return { status, userId: request.userId };
  }));
}

export async function removeTeamMemberTransaction(
  client: MongoClient, db: Db, input: { teamId: ObjectId; userId: string; leaderId: string },
) {
  const now = new Date();
  return client.withSession(session => session.withTransaction(async () => {
    const team = await db.collection("teams").findOne({ _id: input.teamId, status: "open" }, { session });
    if (!team) throw new Error("TEAM_NOT_FOUND");
    if (team.leaderId !== input.leaderId) throw new Error("NOT_LEADER");
    if (input.userId === input.leaderId) throw new Error("CANNOT_REMOVE_LEADER");

    const lock = await db.collection("teams").updateOne(
      { _id: input.teamId, leaderId: input.leaderId, status: "open", memberCount: { $gt: 1 } },
      { $inc: { decisionVersion: 1 }, $set: { updatedAt: now } }, { session },
    );
    if (!lock.matchedCount) throw new Error("TEAM_CHANGED");

    const removed = await db.collection("memberships").deleteOne(
      { hackathonId: team.hackathonId, teamId: input.teamId, userId: input.userId }, { session },
    );
    if (!removed.deletedCount) throw new Error("MEMBER_NOT_FOUND");

    const updated = await db.collection("teams").updateOne(
      { _id: input.teamId, leaderId: input.leaderId, memberCount: { $gt: 1 } },
      { $inc: { memberCount: -1 }, $set: { updatedAt: now } }, { session },
    );
    if (!updated.modifiedCount) throw new Error("TEAM_CHANGED");

    await db.collection("joinRequests").updateMany(
      { hackathonId: team.hackathonId, userId: input.userId, status: "pending" },
      { $set: { status: "cancelled", decidedAt: now, decidedBy: input.leaderId, updatedAt: now } }, { session },
    );
    await db.collection("audit").insertOne({
      hackathonId: team.hackathonId, teamId: input.teamId, actorId: input.leaderId,
      targetUserId: input.userId, action: "MEMBER_REMOVED", createdAt: now,
    }, { session });
  }));
}
