import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { guardMutation } from "@/lib/security";
import { scoreTeamMatch } from "@/lib/matching";

const schema = z.object({
  hackathonId: z.string().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireSession(); }
  catch { return NextResponse.json({ error: "Sign in required" }, { status: 401 }); }
  const blocked = await guardMutation(req, "team-matches", 10000, 60_000, user.userId, 30);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide your skills and hackathon" }, { status: 400 });
  try {
    const db = await database();
    if (await db.collection("memberships").findOne({ hackathonId: parsed.data.hackathonId, userId: user.userId })) {
      return NextResponse.json({ error: "You already belong to a team in this hackathon" }, { status: 409 });
    }
    const candidateSkills = parsed.data.skills?.length ? parsed.data.skills : user.skills || [];
    const teams = await db.collection("teams").find({
      hackathonId: parsed.data.hackathonId, status: "open", $expr: { $lt: ["$memberCount", "$maxSize"] },
    }).toArray();
    const teamIds = teams.map(t => t._id);
    const memberRows = teamIds.length ? await db.collection("memberships").find(
      { teamId: { $in: teamIds } }, { projection: { teamId: 1, skills: 1, timeZone: 1 } },
    ).toArray() : [];
    const representedByTeam = new Map<string, string[]>();
    const timeZonesByTeam = new Map<string, string[]>();
    for (const member of memberRows) {
      const key = member.teamId.toString();
      const skills = representedByTeam.get(key) || [];
      skills.push(...(member.skills || []));
      representedByTeam.set(key, skills);
      if (typeof member.timeZone === "string" && member.timeZone) {
        const zones = timeZonesByTeam.get(key) || [];
        zones.push(member.timeZone);
        timeZonesByTeam.set(key, zones);
      }
    }
    const matches = teams.map(team => {
      const key = team._id.toString();
      const result = scoreTeamMatch(
        candidateSkills, team.skills || [], representedByTeam.get(key) || [],
        team.memberCount, team.maxSize, user.timeZone || "UTC", timeZonesByTeam.get(key) || [],
      );
      return {
        teamId: key, name: team.name, description: team.description, skills: team.skills,
        memberCount: team.memberCount, maxSize: team.maxSize, ...result,
        openSeats: team.maxSize - team.memberCount,
      };
    }).sort((a, b) => b.score - a.score).slice(0, 20);
    return NextResponse.json({
      matches,
      scoring: "65% uncovered skill coverage, 20% time-zone proximity and 15% available seat capacity. Time-zone proximity is the average circular UTC-offset difference between the candidate's IANA profile zone and current team members, evaluated at request time (so DST is respected). Missing member time zones receive a neutral 50% time-zone component rather than a mismatch penalty.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not generate matches" }, { status: 500 });
  }
}
