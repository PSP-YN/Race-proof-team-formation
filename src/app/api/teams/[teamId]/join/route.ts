import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { database, mongoClient } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { guardMutation } from "@/lib/security";
import { requestJoinTransaction } from "@/lib/team-requests";

// Legacy join endpoint intentionally creates a moderated request, never direct membership.
export async function POST(req: NextRequest, ctx: { params: Promise<{ teamId: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Sign in required" }, { status: 401 }); }
  const blocked = await guardMutation(req, "team-join", 10000, 60_000, user.userId, 10);
  if (blocked) return blocked;
  const { teamId } = await ctx.params;
  if (!ObjectId.isValid(teamId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  const parsed = z.object({
    hackathonId: z.string().trim().min(1).max(100),
    idempotencyKey: z.string().min(8).max(120),
    skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid join request" }, { status: 400 });
  try {
    const db = await database();
    const result = await requestJoinTransaction(await mongoClient(), db, {
      ...parsed.data, teamId: new ObjectId(teamId), userId: user.userId, name: user.name, timeZone: user.timeZone || "UTC",
    });
    return NextResponse.json({ ok: true, ...result }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      TEAM_NOT_FOUND: ["Team not found or closed", 404], TEAM_FULL: ["Team is full", 409],
      ALREADY_MEMBER: ["You already belong to a team in this hackathon", 409],
      PENDING_REQUEST_EXISTS: ["You already have a pending request for another team in this hackathon", 409],
      IDEMPOTENCY_CONFLICT: ["This idempotency key was used for a different request", 409],
    };
    const [errorText, status] = map[message] ?? (message.includes("duplicate key") ? ["A pending request or membership already exists", 409] : ["Could not create join request", 500]);
    if (message.includes("duplicate key")) {
      const replay = await (await database()).collection("joinRequests").findOne({ userId: user.userId, idempotencyKey: parsed.data.idempotencyKey });
      if (replay && replay.hackathonId === parsed.data.hackathonId && replay.teamId?.toString() === teamId) {
        return NextResponse.json({ ok: true, requestId: replay._id.toString(), replayed: true });
      }
      if (replay) return NextResponse.json({ error: "This idempotency key was used for a different request" }, { status: 409 });
    }
    return NextResponse.json({ error: errorText }, { status });
  }
}
