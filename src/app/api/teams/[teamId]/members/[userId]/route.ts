import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, mongoClient } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { guardMutation } from "@/lib/security";
import { ObjectId } from "mongodb";
import { removeTeamMemberTransaction } from "@/lib/team-requests";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ teamId: string; userId: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Sign in required" }, { status: 401 }); }
  const blocked = await guardMutation(req, "team-member-remove", 10000, 60_000, user.userId, 20);
  if (blocked) return blocked;
  const { teamId, userId } = await ctx.params;
  if (!ObjectId.isValid(teamId) || !z.string().min(1).max(128).safeParse(userId).success) return NextResponse.json({ error: "Invalid team or member id" }, { status: 400 });
  try {
    await removeTeamMemberTransaction(await mongoClient(), await database(), { teamId: new ObjectId(teamId), userId, leaderId: user.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      TEAM_NOT_FOUND: ["Team not found or closed", 404], NOT_LEADER: ["Only the current team leader can remove members", 403],
      CANNOT_REMOVE_LEADER: ["A leader cannot remove themselves; use Leave team to transfer leadership", 409],
      MEMBER_NOT_FOUND: ["This user is not a member of the team", 404], TEAM_CHANGED: ["Team changed concurrently; refresh and retry", 409],
    };
    const [errorText, status] = map[message] ?? ["Could not remove team member", 500];
    return NextResponse.json({ error: errorText }, { status });
  }
}
