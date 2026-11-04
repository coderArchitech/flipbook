import { startTestServer } from "./server-fixture.mjs";
const server = await startTestServer(
  Number(process.env.PLAYWRIGHT_PORT || 4179),
);
console.log("Isolated test server: " + server.url);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
