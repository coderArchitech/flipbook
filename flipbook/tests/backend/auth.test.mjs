import { beforeEach, afterEach, test, expect, vi } from "vitest";
const database = vi.hoisted(() => ({ get: vi.fn(), run: vi.fn() }));
vi.mock("../../server/db.mjs", () => database);
import {
  passwordHash,
  verifyPassword,
  digest,
  secret,
  startSession,
  authenticate,
  checkOrigin,
  rateLimit,
} from "../../server/auth.mjs";
let res, next;
beforeEach(() => {
  vi.clearAllMocks();
  database.get.mockReturnValue(undefined);
  res = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
  next = vi.fn();
});
afterEach(() => vi.useRealTimers());
test("password hashes are salted and only the correct password verifies", async () => {
  const first = await passwordHash("correct password"),
    second = await passwordHash("correct password");
  expect(first).not.toBe(second);
  expect(await verifyPassword("correct password", first)).toBe(true);
  expect(await verifyPassword("wrong password", first)).toBe(false);
});
test("malformed password hashes fail closed without throwing", async () => {
  for (const hash of [
    null,
    "",
    "bad:hash",
    "a".repeat(64) + ":00",
    "a".repeat(64) + ":" + "x".repeat(128),
  ])
    expect(await verifyPassword("password", hash)).toBe(false);
});
test("sessions store only a token digest and use secure cookie attributes", () => {
  vi.stubEnv("COOKIE_SECURE", "true");
  const csrf = startSession(res, "user");
  const [, token, options] = res.cookie.mock.calls[0];
  expect(options).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  expect(database.run.mock.calls[0].slice(1, 4)).toEqual([
    digest(token),
    "user",
    csrf,
  ]);
  expect(csrf).not.toBe(token);
  expect(secret()).not.toBe(secret());
});
test("missing or expired sessions fail before accessing protected handlers", () => {
  for (const cookie of ["", "flipbook_session=expired"]) {
    authenticate({ headers: { cookie }, method: "GET" }, res, next);
    expect(res.status).toHaveBeenLastCalledWith(401);
  }
  expect(next).not.toHaveBeenCalled();
});
test("write requests require the session CSRF token; read requests do not", () => {
  database.get.mockReturnValue({
    user_id: "u",
    email: "e",
    name: "n",
    csrf: "expected",
  });
  const req = {
    headers: { cookie: "other=x; flipbook_session=token" },
    method: "POST",
  };
  authenticate(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  req.headers["x-csrf-token"] = "expected";
  authenticate(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user.id).toBe("u");
  req.method = "GET";
  delete req.headers["x-csrf-token"];
  authenticate(req, res, next);
  expect(next).toHaveBeenCalledTimes(2);
});
test("production origin checks allow configured local origin and reject foreign sites", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_URL", "http://localhost:3030");
  vi.stubEnv("PORT", "3030");
  for (const origin of [
    "http://localhost:3030",
    "http://127.0.0.1:3030",
    undefined,
  ])
    checkOrigin({ headers: { origin } }, res, next);
  expect(next).toHaveBeenCalledTimes(3);
  checkOrigin({ headers: { origin: "https://attacker.example" } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).toHaveBeenCalledTimes(3);
});
test("development origins are not allowed by the production policy", () => {
  vi.stubEnv("NODE_ENV", "production");
  checkOrigin({ headers: { origin: "http://localhost:5173" } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  vi.stubEnv("NODE_ENV", "development");
  checkOrigin({ headers: { origin: "http://localhost:5173" } }, res, next);
  expect(next).toHaveBeenCalledTimes(1);
});
test("rate limits isolate keys and reset after their window", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
  const key = crypto.randomUUID();
  rateLimit(key, 2, 1000);
  rateLimit(key, 2, 1000);
  expect(() => rateLimit(key, 2, 1000)).toThrow("Too many requests");
  expect(() => rateLimit(key + "other", 2, 1000)).not.toThrow();
  vi.advanceTimersByTime(1001);
  expect(() => rateLimit(key, 2, 1000)).not.toThrow();
});
