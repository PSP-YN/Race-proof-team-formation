import { NextResponse } from "next/server";
import { database } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedActions = new Set([
  "TEAM_CREATED", "JOIN_REQUEST_CREATED", "JOIN_REQUEST_ACCEPTED", "JOIN_REQUEST_DECLINED",
  "INVITE_CREATED", "INVITE_ACCEPTED", "INVITE_REVOKED", "MEMBER_REMOVED", "MEMBER_LEFT",
  "LEADERSHIP_TRANSFERRED", "TEAM_CLOSED", "TEAM_INVITES_REVOKED",
]);

export async function GET() {
  try {
    const db = await database();
    const [openTeams, memberships, pendingRequests, openSeats, auditRows, participants, seededTeams, seededMemberships] = await Promise.all([
      db.collection("teams").countDocuments({ status: "open" }),
      db.collection("memberships").countDocuments({}),
      db.collection("joinRequests").countDocuments({ status: "pending" }),
      db.collection("teams").aggregate([
        { $match: { status: "open" } },
        { $group: { _id: null, total: { $sum: { $max: [0, { $subtract: ["$maxSize", "$memberCount"] }] } } } },
      ]).toArray(),
      db.collection("audit").aggregate([
        { $group: { _id: "$action", total: { $sum: 1 } } },
      ]).toArray(),
      db.collection("users").countDocuments({ email: /^demo\+\d{5}@crewforge\.local$/ }),
      db.collection("teams").countDocuments({ seeded: true }),
      db.collection("memberships").countDocuments({ seeded: true }),
    ]);
    const lines = [
      "# HELP crewforge_database_up Database connectivity status.",
      "# TYPE crewforge_database_up gauge",
      "crewforge_database_up 1",
      "# HELP crewforge_open_teams Current open teams.",
      "# TYPE crewforge_open_teams gauge",
      `crewforge_open_teams ${openTeams}`,
      "# HELP crewforge_open_seats Current seats available in open teams.",
      "# TYPE crewforge_open_seats gauge",
      `crewforge_open_seats ${openSeats[0]?.total ?? 0}`,
      "# HELP crewforge_memberships_total Current membership records.",
      "# TYPE crewforge_memberships_total gauge",
      `crewforge_memberships_total ${memberships}`,
      "# HELP crewforge_pending_join_requests Current pending join requests.",
      "# TYPE crewforge_pending_join_requests gauge",
      `crewforge_pending_join_requests ${pendingRequests}`,
      "# HELP crewforge_seeded_participants_total Synthetic seeded participant profiles.",
      "# TYPE crewforge_seeded_participants_total gauge",
      `crewforge_seeded_participants_total ${participants}`,
      "# HELP crewforge_seeded_teams_total Synthetic seeded teams.",
      "# TYPE crewforge_seeded_teams_total gauge",
      `crewforge_seeded_teams_total ${seededTeams}`,
      "# HELP crewforge_seeded_memberships_total Synthetic seeded membership records.",
      "# TYPE crewforge_seeded_memberships_total gauge",
      `crewforge_seeded_memberships_total ${seededMemberships}`,
      "# HELP crewforge_audit_events_total Audit event counts by action.",
      "# TYPE crewforge_audit_events_total counter",
      ...auditRows.filter(row => allowedActions.has(row._id)).map(row => `crewforge_audit_events_total{action="${row._id}"} ${row.total}`),
    ];
    return new NextResponse(lines.join("\n") + "\n", {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("# HELP crewforge_database_up Database connectivity status.\n# TYPE crewforge_database_up gauge\ncrewforge_database_up 0\n", {
      status: 503, headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
