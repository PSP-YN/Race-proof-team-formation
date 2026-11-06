import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { database } from "@/lib/db";

export type Session = { userId: string; email: string; name: string; timeZone: string; skills: string[]; sessionVersion?: number };
function signingKey() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.length < 1 || timeZone.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date()); return true; }
  catch { return false; }
}
export function validatePassword(password: string) {
  if (password.length < 10 || password.length > 100) throw Error("Password must be 10–100 characters");
  if (Buffer.byteLength(password, "utf8") > 72) throw Error("Password must be no more than 72 UTF-8 bytes");
}
export async function createSession(user: Session) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(signingKey());
  (await cookies()).set("crewforge_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
}
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get("crewforge_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (typeof payload.userId !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") return null;
    const user = await (await database()).collection("users").findOne(
      { _id: new ObjectId(payload.userId) },
      { projection: { sessionVersion: 1, emailVerified: 1, timeZone: 1, skills: 1 } },
    );
    if (!user || user.emailVerified === false || (user.sessionVersion ?? 0) !== (typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0)) return null;
    const timeZone = typeof user.timeZone === "string" && isValidTimeZone(user.timeZone) ? user.timeZone : "UTC";
    return { userId: payload.userId, email: payload.email, name: payload.name, timeZone, skills: Array.isArray(user.skills) ? user.skills.filter((x): x is string => typeof x === "string").slice(0, 20) : [], sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0 };
  } catch { return null; }
}
export async function requireSession() { const s = await getSession(); if (!s) throw new Error("UNAUTHORIZED"); return s; }
export async function registerUser(email: string, name: string, password: string, timeZone = "UTC", skills: string[] = []) {
  signingKey(); validatePassword(password);
  const normalized = email.trim().toLowerCase(), cleanName = name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw Error("Enter a valid email");
  if (cleanName.length < 2 || cleanName.length > 60) throw Error("Name must be 2–60 characters");
  if (!isValidTimeZone(timeZone)) throw Error("Choose a valid IANA time zone");
  const cleanSkills = [...new Set(skills.map(s => s.trim()).filter(Boolean))].slice(0, 20);
  const db = await database(), user = { email: normalized, name: cleanName, timeZone, skills: cleanSkills, passwordHash: await bcrypt.hash(password, 12), emailVerified: false, sessionVersion: 0, createdAt: new Date() };
  const r = await db.collection("users").insertOne(user);
  return { userId: r.insertedId.toString(), email: user.email, name: user.name, timeZone: user.timeZone, skills: user.skills };
}
export async function updateUserPassword(userId: string, password: string) {
  validatePassword(password); const db = await database();
  await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() }, $inc: { sessionVersion: 1 } });
}
export async function loginUser(email: string, password: string) {
  signingKey(); if (Buffer.byteLength(password, "utf8") > 72) throw Error("Invalid email or password");
  const u = await (await database()).collection("users").findOne({ email: email.trim().toLowerCase() });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) throw Error("Invalid email or password");
  if (u.emailVerified === false) throw Error("EMAIL_NOT_VERIFIED");
  const timeZone = typeof u.timeZone === "string" && isValidTimeZone(u.timeZone) ? u.timeZone : "UTC";
  return { userId: u._id.toString(), email: u.email as string, name: u.name as string, timeZone, skills: Array.isArray(u.skills) ? u.skills.filter((x): x is string => typeof x === "string").slice(0, 20) : [], sessionVersion: typeof u.sessionVersion === "number" ? u.sessionVersion : 0 };
}
