import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { database } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ teamId: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Sign in required" }, { status: 401 }); }
  const { teamId } = await ctx.params;
  if (!ObjectId.isValid(teamId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  try {
    const db = await database(), id = new ObjectId(teamId);
    const team = await db.collection("teams").findOne({ _id: id, leaderId: user.userId, status: "open" }, { projection: { _id: 1 } });
    if (!team) return NextResponse.json({ error: "Only the current team leader can view members" }, { status: 403 });
    const members = await db.collection("memberships").find({ teamId: id }, { projection: { userId: 1, name: 1, skills: 1, timeZone: 1, joinedAt: 1 } }).sort({ joinedAt: 1 }).toArray();
    return NextResponse.json({ members: members.map(m => ({ userId: m.userId, name: m.name, skills: m.skills || [], timeZone: m.timeZone || "UTC", joinedAt: m.joinedAt })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load team members" }, { status: 500 }); }
}
