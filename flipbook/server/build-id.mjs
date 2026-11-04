// Fingerprint of the shared document code (schema, validation, rendering).
// The server computes it at startup and the editor bakes it in at build time,
// so the editor can tell when it is talking to a server running older code.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const shared = fileURLToPath(new URL("../shared/", import.meta.url));
export function sharedBuildId() {
  const hash = createHash("sha256");
  for (const name of readdirSync(shared)
    .filter((n) => n.endsWith(".mjs"))
    .sort())
    hash.update(name + "\0").update(readFileSync(shared + name));
  return hash.digest("hex").slice(0, 16);
}
