import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { database, mongoClient } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { guardMutation } from "@/lib/security";
import { joinTeamTransaction } from "@/lib/team-membership";

// Membership, capacity, idempotency and audit state are committed atomically.
// The unique membership index is the final guard against cross-team double membership.
export async function POST(req: NextRequest, ctx: { params: Promise<{ teamId: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const blocked = await guardMutation(req, "team-join", 10000, 60_000, user.userId, 10);
  if (blocked) return blocked;

  const { teamId } = await ctx.params;
  if (!ObjectId.isValid(teamId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const parsed = z.object({
    hackathonId: z.string().min(1),
    idempotencyKey: z.string().min(8).max(120),
    skills: z.array(z.string().max(40)).max(20).default([]),
  }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid join request" }, { status: 400 });

  const data = parsed.data;
  const db = await database();
  const id = new ObjectId(teamId);

  try {
    await joinTeamTransaction(await mongoClient(), db, {
      hackathonId: data.hackathonId,
      teamId: id,
      userId: user.userId,
      name: user.name,
      skills: data.skills,
      idempotencyKey: data.idempotencyKey,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key")) {
      const replay = await db.collection("idempotency").findOne({ userId: user.userId, key: data.idempotencyKey });
      if (replay && replay.hackathonId === data.hackathonId && replay.teamId?.toString() === id.toString()) {
        return NextResponse.json({ ok: true, replayed: true });
      }
    }

    const errors: Record<string, [string, number]> = {
      TEAM_NOT_FOUND: ["Team not found or closed", 404],
      TEAM_FULL: ["Team is full", 409],
      IDEMPOTENCY_CONFLICT: ["This idempotency key was already used for a different join request", 409],
    };
    const [messageText, status] = errors[message] ?? (
      message.includes("duplicate key")
        ? ["You already belong to a team in this hackathon", 409]
        : ["Join failed; retry with the same idempotency key", 409]
    );
    return NextResponse.json({ error: messageText }, { status });
  }
}
