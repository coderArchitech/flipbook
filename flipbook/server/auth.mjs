import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { get, run } from "./db.mjs";
const scrypt = promisify(scryptCallback);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("hex");
export async function passwordHash(password) {
  const salt = secret();
  const key = await scrypt(password, salt, 64);
  return salt + ":" + key.toString("hex");
}
export async function verifyPassword(password, hash) {
  if (
    typeof password !== "string" ||
    typeof hash !== "string" ||
    !/^[a-f0-9]{64}:[a-f0-9]{128}$/.test(hash)
  )
    return false;
  const [salt, expected] = hash.split(":");
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}
export function startSession(res, userId) {
  const token = secret(),
    csrf = secret();
  run(
    "INSERT INTO sessions VALUES(?,?,?,?)",
    digest(token),
    userId,
    csrf,
    Date.now() + 7 * 864e5,
  );
  res.cookie("flipbook_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 7 * 864e5,
  });
  return csrf;
}
export function authenticate(req, res, next) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("flipbook_session="))
    ?.slice(17);
  const session = token
    ? get(
        "SELECT s.*,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
        digest(token),
        Date.now(),
      )
    : null;
  if (!session)
    return res
      .status(401)
      .json({ error: "Please sign in to continue.", code: "SESSION_EXPIRED" });
  req.user = { id: session.user_id, email: session.email, name: session.name };
  req.session = session;
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers["x-csrf-token"] !== session.csrf
  )
    return res
      .status(403)
      .json({
        error: "Your session changed. Refresh and try again.",
        code: "CSRF_INVALID",
      });
  next();
}
export function checkOrigin(req, res, next) {
  const origin = req.headers.origin;
  const expected =
    process.env.PUBLIC_URL || "http://localhost:" + (process.env.PORT || 3000);
  const allowed = new Set([
    expected,
    "http://127.0.0.1:" + (process.env.PORT || 3000),
  ]);
  if (process.env.NODE_ENV !== "production")
    allowed.add("http://127.0.0.1:5173").add("http://localhost:5173");
  if (origin && !allowed.has(origin))
    return res.status(403).json({ error: "This origin is not permitted." });
  next();
}
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.until < now) {
    b = { count: 0, until: now + windowMs };
    buckets.set(key, b);
  }
  if (++b.count > max) {
    const e = new Error("Too many requests. Please try again shortly.");
    e.status = 429;
    throw e;
  }
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
}
