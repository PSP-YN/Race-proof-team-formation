import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hackathonId = req.nextUrl.searchParams.get("hackathonId") ?? process.env.NEXT_PUBLIC_HACKATHON_ID ?? "hack4hack-crew-hiring-2026";
  try {
    const db = await database();
    const [participants, teams, memberships, capacity] = await Promise.all([
      db.collection("users").countDocuments({ email: /^demo\+\d{5}@crewforge\.local$/ }),
      db.collection("teams").countDocuments({ hackathonId, seeded: true }),
      db.collection("memberships").countDocuments({ hackathonId, seeded: true }),
      db.collection("teams").aggregate([
        { $match: { hackathonId, status: "open", seeded: true } },
        { $group: { _id: null, openSeats: { $sum: { $max: [0, { $subtract: ["$maxSize", "$memberCount"] }] } } } },
      ]).toArray(),
    ]);
    const openSeats = capacity[0]?.openSeats ?? 0;
    return NextResponse.json({
      dataset: { participants, teams, memberships, openSeats, kind: "seeded-test-data", source: "MongoDB", asOf: new Date().toISOString() },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Dataset metrics are unavailable until the database is configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
