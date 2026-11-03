import type { Db, MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

export type JoinTeamInput = {
  hackathonId: string;
  teamId: ObjectId;
  userId: string;
  name: string;
  skills: string[];
  idempotencyKey: string;
};

/**
 * The authoritative membership mutation. Keep the membership insert, conditional
 * seat reservation, idempotency record and audit event in one transaction.
 * This function is shared by the HTTP route and the real-MongoDB race test so
 * the test exercises the production transaction rather than a copied algorithm.
 */
export async function joinTeamTransaction(client: MongoClient, db: Db, input: JoinTeamInput): Promise<void> {
  const now = new Date();
  await client.withSession(session => session.withTransaction(async () => {
    const old = await db.collection("idempotency").findOne(
      { userId: input.userId, key: input.idempotencyKey },
      { session },
    );
    if (old) {
      if (old.hackathonId === input.hackathonId && old.teamId?.toString() === input.teamId.toString()) return;
      throw new Error("IDEMPOTENCY_CONFLICT");
    }

    const team = await db.collection("teams").findOne(
      { _id: input.teamId, hackathonId: input.hackathonId, status: "open" },
      { session },
    );
    if (!team) throw new Error("TEAM_NOT_FOUND");

    await db.collection("memberships").insertOne({
      hackathonId: input.hackathonId,
      teamId: input.teamId,
      userId: input.userId,
      name: input.name,
      skills: input.skills,
      joinedAt: now,
    }, { session });

    const reserved = await db.collection("teams").updateOne(
      { _id: input.teamId, status: "open", memberCount: { $lt: team.maxSize } },
      { $inc: { memberCount: 1 }, $set: { updatedAt: now } },
      { session },
    );
    if (reserved.modifiedCount !== 1) throw new Error("TEAM_FULL");

    await db.collection("idempotency").insertOne({
      userId: input.userId,
      key: input.idempotencyKey,
      hackathonId: input.hackathonId,
      teamId: input.teamId,
      createdAt: now,
    }, { session });

    await db.collection("audit").insertOne({
      hackathonId: input.hackathonId,
      teamId: input.teamId,
      actorId: input.userId,
      action: "MEMBER_JOINED",
      createdAt: now,
    }, { session });
  }));
}
