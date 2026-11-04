// Synthesizes each narration sentence with macOS `say` and records durations.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { SCENES, VOICE } from "./script.mjs";

const dir = new URL("./out/voice/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const durations = {};
for (const scene of SCENES)
  scene.lines.forEach((line, i) => {
    const file = `${dir}${scene.id}_${i}.aiff`;
    if (!existsSync(file) || process.argv.includes("--force"))
      execFileSync("say", ["-v", VOICE.name, "-r", String(VOICE.rate), "-o", file, line]);
    const info = execFileSync("afinfo", [file]).toString();
    durations[`${scene.id}_${i}`] = Number(info.match(/estimated duration: ([\d.]+)/)[1]);
  });
writeFileSync(dir + "durations.json", JSON.stringify(durations, null, 1));
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`${Object.keys(durations).length} lines, ${total.toFixed(1)}s of narration`);
