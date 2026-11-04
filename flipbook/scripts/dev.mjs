import { spawn } from "node:child_process";
await import("./build-reader.mjs");
const reader = spawn(
  process.execPath,
  ["scripts/build-reader.mjs", "--watch"],
  { stdio: "inherit" },
);
const api = spawn(process.execPath, ["--watch", "server/index.mjs"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
});
function stop() {
  api.kill();
  web.kill();
  reader.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", stop);
web.on("exit", stop);
reader.on("exit", stop);
