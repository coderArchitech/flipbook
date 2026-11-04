import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

export async function startTestServer(port) {
  if (!port) {
    const socket = net.createServer();
    await new Promise((r) => socket.listen(0, "127.0.0.1", r));
    port = socket.address().port;
    await new Promise((r) => socket.close(r));
  }
  const dir = await mkdtemp(join(tmpdir(), "flipbook-test-"));
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      PUBLIC_URL: url,
      DATA_DIR: dir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  const stop = async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((r) => child.once("exit", r)),
        delay(11000, undefined, { ref: false }),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(dir, { recursive: true, force: true });
  };
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url + "/api/health");
      if (r.ok) return { url, dir, stop, logs: () => logs };
    } catch {}
    if (child.exitCode !== null) break;
    await delay(100);
  }
  await stop();
  throw new Error("Test server did not start: " + logs);
}
