import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  mongoClient: vi.fn(),
  requireSession: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  guardMutation: vi.fn(),
  guardEventStream: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ database: mocks.database, mongoClient: mocks.mongoClient }));
vi.mock("@/lib/auth", () => ({
  requireSession: mocks.requireSession,
  getSession: mocks.getSession,
  createSession: mocks.createSession,
  loginUser: mocks.loginUser,
  registerUser: mocks.registerUser,
}));
vi.mock("@/lib/security", () => ({ guardMutation: mocks.guardMutation, guardEventStream: mocks.guardEventStream }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { GET as authGet, POST as authPost } from "../../src/app/api/auth/route";
import { GET as teamsGet, POST as teamsPost } from "../../src/app/api/teams/route";
import { POST as joinPost } from "../../src/app/api/teams/[teamId]/join/route";
import { GET as requestsGet, POST as requestsPost } from "../../src/app/api/teams/[teamId]/requests/route";
import { PATCH as requestDecisionPatch } from "../../src/app/api/teams/[teamId]/requests/[requestId]/route";
import { GET as membersGet } from "../../src/app/api/teams/[teamId]/members/route";
import { DELETE as memberDelete } from "../../src/app/api/teams/[teamId]/members/[userId]/route";
import { GET as healthGet } from "../../src/app/api/health/route";

const user = { userId: "user-123", email: "builder@example.test", name: "Builder", sessionVersion: 0 };
const hackathonId = "hack4hack-crew-hiring-2026";

function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

function makeDb() {
  const emptyCursor = { sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) };
  const collection = vi.fn((name: string) => {
    if (name === "teams") return { find: vi.fn().mockReturnValue(emptyCursor), findOne: vi.fn().mockResolvedValue(null) };
    if (name === "memberships") return { findOne: vi.fn().mockResolvedValue(null), insertOne: vi.fn().mockResolvedValue({}) };
    return { insertOne: vi.fn().mockResolvedValue({}), findOne: vi.fn().mockResolvedValue(null), findOneAndUpdate: vi.fn().mockResolvedValue({ count: 1 }) };
  });
  return { collection, command: vi.fn().mockResolvedValue({ ok: 1 }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.database.mockResolvedValue(makeDb());
  mocks.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
  mocks.getSession.mockResolvedValue(null);
  mocks.createSession.mockResolvedValue(undefined);
  mocks.loginUser.mockReset();
  mocks.registerUser.mockReset();
  mocks.guardMutation.mockResolvedValue(null);
  mocks.guardEventStream.mockResolvedValue(null);
  mocks.cookies.mockResolvedValue({ delete: vi.fn() });
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("authentication API contracts", () => {
  it("GET /api/auth returns an unauthenticated null user", async () => {
    const response = await authGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
  });

  it("GET /api/auth returns the current session", async () => {
    mocks.getSession.mockResolvedValue(user);
    const response = await authGet();
    expect((await response.json()).user).toEqual(user);
  });

  it("GET /api/auth disables shared caching", async () => {
    const response = await authGet();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST /api/auth rejects malformed JSON", async () => {
    const response = await authPost(request("/api/auth", "POST", "{"));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth rejects an unknown action", async () => {
    const response = await authPost(request("/api/auth", "POST", { action: "delete-account" }));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth rejects an invalid email", async () => {
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: "not-an-email", password: "valid-password" }));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth rejects a registration name that is too short", async () => {
    const response = await authPost(request("/api/auth", "POST", { action: "register", email: "a@example.test", name: "A", password: "valid-password" }));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth rejects a registration password below policy", async () => {
    const response = await authPost(request("/api/auth", "POST", { action: "register", email: "a@example.test", name: "Alex", password: "short" }));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth rejects a password above the API length limit", async () => {
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: "a@example.test", password: "x".repeat(101) }));
    expect(response.status).toBe(400);
  });

  it("POST /api/auth returns the mutation guard response", async () => {
    mocks.guardMutation.mockResolvedValue(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: "a@example.test", password: "password" }));
    expect(response.status).toBe(429);
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });

  it("POST /api/auth signs in a valid account", async () => {
    mocks.loginUser.mockResolvedValue(user);
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: user.email, password: "valid-password" }));
    expect(response.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith(user);
  });

  it("POST /api/auth returns a generic 401 for invalid credentials", async () => {
    mocks.loginUser.mockRejectedValue(new Error("Invalid email or password"));
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: user.email, password: "wrong-password" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("Invalid email or password");
  });

  it("POST /api/auth does not disclose that an account is unverified", async () => {
    mocks.loginUser.mockRejectedValue(new Error("EMAIL_NOT_VERIFIED"));
    const response = await authPost(request("/api/auth", "POST", { action: "login", email: user.email, password: "valid-password" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("Invalid email or password");
  });

  it("POST /api/auth logs out by deleting the session cookie", async () => {
    const cookieStore = { delete: vi.fn() };
    mocks.cookies.mockResolvedValue(cookieStore);
    const response = await authPost(request("/api/auth", "POST", { action: "logout" }));
    expect(response.status).toBe(200);
    expect(cookieStore.delete).toHaveBeenCalledWith("crewforge_session");
  });

  it("POST /api/auth reports missing email-provider configuration after account creation", async () => {
    mocks.registerUser.mockResolvedValue({ userId: "507f1f77bcf86cd799439011", email: user.email, name: user.name });
    const response = await authPost(request("/api/auth", "POST", { action: "register", email: user.email, name: user.name, password: "valid-password" }));
    expect(response.status).toBe(503);
    expect(mocks.registerUser).toHaveBeenCalledOnce();
  });
});

describe("team API contracts", () => {
  it("GET /api/teams returns an empty board when no teams exist", async () => {
    const response = await teamsGet(request(`/api/teams?hackathonId=${hackathonId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teams: [] });
  });

  it("GET /api/teams disables shared caching", async () => {
    const response = await teamsGet(request(`/api/teams?hackathonId=${hackathonId}`));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST /api/teams requires authentication", async () => {
    const response = await teamsPost(request("/api/teams", "POST", {}));
    expect(response.status).toBe(401);
  });

  it("POST /api/teams returns the mutation guard response", async () => {
    mocks.requireSession.mockResolvedValue(user);
    mocks.guardMutation.mockResolvedValue(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    const response = await teamsPost(request("/api/teams", "POST", {}));
    expect(response.status).toBe(429);
  });

  it("POST /api/teams rejects malformed team sizes", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await teamsPost(request("/api/teams", "POST", { hackathonId, name: "Invalid Size", minSize: 6, maxSize: 5 }));
    expect(response.status).toBe(400);
  });

  it("POST /api/teams rejects a team name shorter than three characters", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await teamsPost(request("/api/teams", "POST", { hackathonId, name: "AB", minSize: 2, maxSize: 5 }));
    expect(response.status).toBe(400);
  });

  it("POST /api/teams rejects a maximum size above ten", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await teamsPost(request("/api/teams", "POST", { hackathonId, name: "Too Large", minSize: 2, maxSize: 11 }));
    expect(response.status).toBe(400);
  });
});

describe("team join API contracts", () => {
  const teamId = "507f1f77bcf86cd799439011";
  const context = { params: Promise.resolve({ teamId }) };

  it("POST /api/teams/:teamId/join requires authentication", async () => {
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", {}), context);
    expect(response.status).toBe(401);
  });

  it("POST /api/teams/:teamId/join returns the mutation guard response", async () => {
    mocks.requireSession.mockResolvedValue(user);
    mocks.guardMutation.mockResolvedValue(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", {}), context);
    expect(response.status).toBe(429);
  });

  it("POST /api/teams/:teamId/join rejects an invalid team id", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await joinPost(request("/api/teams/not-an-object-id/join", "POST", {}), { params: Promise.resolve({ teamId: "not-an-object-id" }) });
    expect(response.status).toBe(400);
  });

  it("POST /api/teams/:teamId/join rejects malformed JSON", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", "{"), context);
    expect(response.status).toBe(400);
  });

  it("POST /api/teams/:teamId/join requires an idempotency key", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", { hackathonId }), context);
    expect(response.status).toBe(400);
  });

  it("POST /api/teams/:teamId/join rejects an idempotency key shorter than eight characters", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", { hackathonId, idempotencyKey: "short" }), context);
    expect(response.status).toBe(400);
  });

  it("POST /api/teams/:teamId/join rejects more than twenty requested skills", async () => {
    mocks.requireSession.mockResolvedValue(user);
    const response = await joinPost(request(`/api/teams/${teamId}/join`, "POST", { hackathonId, idempotencyKey: "request-123", skills: Array.from({ length: 21 }, (_, i) => `skill-${i}`) }), context);
    expect(response.status).toBe(400);
  });
});

describe("moderated join request API contracts", () => {
  const teamId = "507f1f77bcf86cd799439011";
  const requestId = "507f1f77bcf86cd799439012";
  const teamContext = { params: Promise.resolve({ teamId }) };
  it("POST requests requires authentication", async () => { expect((await requestsPost(request("/api/teams/" + teamId + "/requests", "POST", {}), teamContext)).status).toBe(401); });
  it("POST requests rejects invalid team ids", async () => { mocks.requireSession.mockResolvedValue(user); expect((await requestsPost(request("/api/teams/invalid/requests", "POST", {}), { params: Promise.resolve({ teamId: "invalid" }) })).status).toBe(400); });
  it("POST requests rejects missing idempotency keys", async () => { mocks.requireSession.mockResolvedValue(user); expect((await requestsPost(request("/api/teams/" + teamId + "/requests", "POST", { hackathonId }), teamContext)).status).toBe(400); });
  it("POST requests applies mutation rate limits", async () => { mocks.requireSession.mockResolvedValue(user); mocks.guardMutation.mockResolvedValue(NextResponse.json({ error: "Too many requests" }, { status: 429 })); expect((await requestsPost(request("/api/teams/" + teamId + "/requests", "POST", {}), teamContext)).status).toBe(429); });
  it("GET requests denies non-leaders", async () => { mocks.requireSession.mockResolvedValue(user); expect((await requestsGet(request("/api/teams/" + teamId + "/requests"), teamContext)).status).toBe(403); });
  it("PATCH request decisions requires authentication", async () => { expect((await requestDecisionPatch(request("/api/teams/" + teamId + "/requests/" + requestId, "PATCH", { decision: "accept" }), { params: Promise.resolve({ teamId, requestId }) })).status).toBe(401); });
  it("PATCH request decisions rejects unsupported actions", async () => { mocks.requireSession.mockResolvedValue(user); expect((await requestDecisionPatch(request("/api/teams/" + teamId + "/requests/" + requestId, "PATCH", { decision: "approve" }), { params: Promise.resolve({ teamId, requestId }) })).status).toBe(400); });
  it("PATCH request decisions rejects malformed ids", async () => { mocks.requireSession.mockResolvedValue(user); expect((await requestDecisionPatch(request("/api/teams/" + teamId + "/requests/bad", "PATCH", { decision: "accept" }), { params: Promise.resolve({ teamId, requestId: "bad" }) })).status).toBe(400); });
});

describe("leader member-management API contracts", () => {
  const teamId = "507f1f77bcf86cd799439011";
  const ctx = { params: Promise.resolve({ teamId }) };
  it("GET members requires authentication", async () => { expect((await membersGet(request("/api/teams/" + teamId + "/members"), ctx)).status).toBe(401); });
  it("GET members denies non-leaders", async () => { mocks.requireSession.mockResolvedValue(user); expect((await membersGet(request("/api/teams/" + teamId + "/members"), ctx)).status).toBe(403); });
  it("DELETE member requires authentication", async () => { expect((await memberDelete(request("/api/teams/" + teamId + "/members/target", "DELETE"), { params: Promise.resolve({ teamId, userId: "target" }) })).status).toBe(401); });
  it("DELETE member rejects malformed team ids", async () => { mocks.requireSession.mockResolvedValue(user); expect((await memberDelete(request("/api/teams/bad/members/target", "DELETE"), { params: Promise.resolve({ teamId: "bad", userId: "target" }) })).status).toBe(400); });
  it("DELETE member applies mutation rate limits", async () => { mocks.requireSession.mockResolvedValue(user); mocks.guardMutation.mockResolvedValue(NextResponse.json({ error: "Too many requests" }, { status: 429 })); expect((await memberDelete(request("/api/teams/" + teamId + "/members/target", "DELETE"), { params: Promise.resolve({ teamId, userId: "target" }) })).status).toBe(429); });
});

describe("health API contracts", () => {
  it("GET /api/health reports healthy database readiness", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    expect((await response.json()).checks.database).toBe(true);
  });

  it("GET /api/health disables shared caching", async () => {
    const response = await healthGet();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /api/health returns 503 when the database is unavailable", async () => {
    mocks.database.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await healthGet();
    expect(response.status).toBe(503);
    expect((await response.json()).ok).toBe(false);
  });
});
