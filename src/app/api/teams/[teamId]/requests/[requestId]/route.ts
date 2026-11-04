import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { database, mongoClient } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { guardMutation } from "@/lib/security";
import { decideJoinRequestTransaction } from "@/lib/team-requests";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ teamId: string; requestId: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Sign in required" }, { status: 401 }); }
  const blocked = await guardMutation(req, "join-request-decision", 10000, 60_000, user.userId, 30);
  if (blocked) return blocked;
  const { teamId, requestId } = await ctx.params;
  if (!ObjectId.isValid(teamId) || !ObjectId.isValid(requestId)) return NextResponse.json({ error: "Invalid team or request id" }, { status: 400 });
  const parsed = z.object({ decision: z.enum(["accept", "decline"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decision must be accept or decline" }, { status: 400 });
  try {
    const result = await decideJoinRequestTransaction(await mongoClient(), await database(), {
      teamId: new ObjectId(teamId), requestId: new ObjectId(requestId), leaderId: user.userId, decision: parsed.data.decision,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      TEAM_NOT_FOUND: ["Team not found or closed", 404], NOT_LEADER: ["Only the current team leader can decide requests", 403],
      REQUEST_NOT_PENDING: ["This request is no longer pending", 409], TEAM_FULL: ["The team has no remaining seats", 409],
      ALREADY_MEMBER: ["This participant already belongs to a team in this hackathon", 409],
    };
    const [errorText, status] = map[message] ?? (message.includes("duplicate key") ? ["Participant already has a membership", 409] : ["Could not decide join request", 500]);
    return NextResponse.json({ error: errorText }, { status });
  }
}
