// Demo server lifecycle and a small API client for seeding.
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { FLIPBOOK, OUT } from "./paths.mjs";

export async function startServer(port = 4310) {
  const dataDir = OUT + "/data";
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: FLIPBOOK,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), PUBLIC_URL: url, DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url + "/api/health")).ok)
        return { url, logs: () => logs, stop: () => child.kill("SIGTERM") };
    } catch {}
    await delay(100);
  }
  child.kill();
  throw Error("Demo server did not start: " + logs);
}

export async function register(url, { name, email, password }) {
  const r = await fetch(url + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (r.status !== 201) throw Error("Register failed: " + (await r.text()));
  const cookie = r.headers.get("set-cookie").split(";")[0],
    { csrf } = await r.json();
  const call = async (path, { method = "GET", body, raw, type } = {}) => {
    const res = await fetch(url + path, {
      method,
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrf,
        "Idempotency-Key": randomUUID(),
        "Content-Type": raw ? type : "application/json",
        ...(raw ? { "X-File-Name": encodeURIComponent(raw.name) } : {}),
      },
      body: raw ? raw.bytes : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw Error(`${method} ${path} ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  };
  const upload = (file, name, type = "image/png") =>
    call("/api/assets", { method: "POST", raw: { name, bytes: readFileSync(file) }, type });
  return { cookie, csrf, call, upload };
}

export async function waitJob(api, id) {
  for (let i = 0; i < 200; i++) {
    const j = await api.call("/api/jobs/" + id);
    if (["succeeded", "failed", "cancelled"].includes(j.status)) {
      if (j.status !== "succeeded") throw Error("Job " + j.status + ": " + JSON.stringify(j.error));
      return j;
    }
    await delay(250);
  }
  throw Error("Job timed out");
}
