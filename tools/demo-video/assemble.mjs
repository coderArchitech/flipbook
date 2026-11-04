// Cuts the recorded scenes into the final MP4: per-scene clips from screencast
// frames, title/end cards, narration + page-turn sounds, burned-in subtitles.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { FFMPEG, FLIPBOOK, OUT } from "./paths.mjs";
import { SCENES } from "./script.mjs";
import { launch } from "./browser.mjs";

const sharp = createRequire(FLIPBOOK + "/package.json")("sharp");
const target = process.argv[2] || OUT + "/flipbook-demo.mp4";
const tmp = OUT + "/build/";
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const ff = (...args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const timeline = JSON.parse(readFileSync(OUT + "/timeline.json", "utf8"));
const durations = JSON.parse(readFileSync(OUT + "/voice/durations.json", "utf8"));
const BG = "#1b1815", FPS = 30;
// The app frame is scaled to 90% and sits above a subtitle band.
const APP = { w: 1728, h: 972, x: 96, y: 10 };

// Background plates: one for app scenes, one with a phone bezel.
const plate = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="${BG}"/>${inner}</svg>`);
await sharp(plate(`<rect x="${APP.x - 1}" y="${APP.y - 1}" width="${APP.w + 2}" height="${APP.h + 2}" rx="6" fill="#000" opacity=".35"/>`)).png().toFile(tmp + "plate.png");
const PHONE = { h: 900 };
await sharp(plate(`<rect x="${960 - 236}" y="${(APP.h + 20 - PHONE.h) / 2 - 22}" width="472" height="${PHONE.h + 44}" rx="46" fill="#0d0c0b" stroke="#3b352f" stroke-width="3"/>`)).png().toFile(tmp + "phone-plate.png");

// Title and end cards rendered with the app's own typefaces.
// Inline the fonts: a page set with setContent cannot load file:// URLs.
const fontUrl = (f) => `data:font/woff2;base64,${readFileSync(`${FLIPBOOK}/node_modules/@fontsource/${f}`).toString("base64")}`;
const card = (eyebrow, title, sub) => `<!doctype html><style>
@font-face{font-family:"Instrument Serif";src:url("${fontUrl("instrument-serif/files/instrument-serif-latin-400-normal.woff2")}")}
@font-face{font-family:"DM Sans";src:url("${fontUrl("dm-sans/files/dm-sans-latin-400-normal.woff2")}")}
html,body{margin:0;width:1920px;height:1080px;background:#f3ede3;color:#2a2622;font-family:"DM Sans"}
main{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 200px;gap:28px;box-sizing:border-box;border-left:22px solid #a24f2f}
small{letter-spacing:.24em;font-size:22px;color:#a24f2f;text-transform:uppercase}
h1{font-family:"Instrument Serif";font-weight:400;font-size:150px;line-height:.95;margin:0}
p{font-size:34px;max-width:1150px;margin:0;color:#5b544c;line-height:1.35}</style>
<main><small>${eyebrow}</small><h1>${title}</h1><p>${sub}</p></main>`;
{
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, html] of [
    ["title", card("Flipbook · end-to-end demo", "Slow Living", "Building, publishing and exporting a ten-page product magazine, from templates to PDF.")],
    ["end", card("Made with Flipbook", "Your catalog, as a magazine.", "Templates · brand kit · catalog import · interactive reader · PDF export · analytics")],
  ]) {
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: tmp + name + ".png" });
  }
  await browser.close();
}

const encode = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS)];
const clips = [];
const still = (name, seconds) => {
  const file = `${tmp}${name}.mp4`;
  ff("-loop", "1", "-t", String(seconds), "-i", tmp + name + ".png", "-vf", "format=yuv420p", ...encode, file);
  clips.push({ file, duration: seconds, card: name });
};
still("title", 4);

for (const scene of SCENES) {
  const seg = timeline.segments.find((s) => s.id === scene.id);
  if (!seg?.end) continue;
  const frames = timeline.captures[seg.source];
  let first = frames.findLastIndex((f) => f.t <= seg.start);
  if (first < 0) first = 0;
  const used = frames.slice(first).filter((f, i) => i === 0 || f.t < seg.end);
  let list = "";
  used.forEach((f, i) => {
    const from = Math.max(f.t, seg.start), to = i + 1 < used.length ? used[i + 1].t : seg.end;
    list += `file '${f.file}'\nduration ${Math.max(0.001, to - from).toFixed(4)}\n`;
  });
  list += `file '${used.at(-1).file}'\n`;
  writeFileSync(`${tmp}${scene.id}.txt`, list);
  const file = `${tmp}${scene.id}.mp4`;
  const phone = seg.source === "phone";
  const graph = phone
    ? `[1:v]scale=-2:${PHONE.h},fps=${FPS}[v];[0:v][v]overlay=(W-w)/2:${(APP.h + 20 - PHONE.h) / 2},format=yuv420p`
    : `[1:v]scale=${APP.w}:${APP.h}:flags=lanczos,fps=${FPS}[v];[0:v][v]overlay=${APP.x}:${APP.y},format=yuv420p`;
  ff("-loop", "1", "-i", tmp + (phone ? "phone-plate.png" : "plate.png"), "-f", "concat", "-safe", "0", "-i", `${tmp}${scene.id}.txt`,
    "-filter_complex", graph, "-t", (seg.end - seg.start).toFixed(3), ...encode, file);
  clips.push({ file, duration: seg.end - seg.start, seg, scene });
}
still("end", 5);

// Timeline offsets in the final cut.
let offset = 0;
for (const c of clips) { c.at = offset; offset += c.duration; }
const total = offset;
const place = (t) => {
  const c = clips.find((c) => c.seg && t >= c.seg.start - 0.05 && t <= c.seg.end + 0.05);
  return c ? c.at + Math.max(0, t - c.seg.start) : null;
};

writeFileSync(tmp + "clips.txt", clips.map((c) => `file '${c.file}'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", tmp + "clips.txt", "-c", "copy", tmp + "video.mp4");

// Audio: narration clips and a soft paper rustle at each page turn.
ff("-f", "lavfi", "-i", "anoisesrc=d=0.26:c=pink:a=0.6:r=48000", "-af", "bandpass=f=2400:width_type=h:w=3000,afade=t=in:d=0.04,afade=t=out:st=0.08:d=0.18,volume=0.5", tmp + "flip.wav");
const voices = timeline.voice.map((v) => ({ file: `${OUT}/voice/${v.key}.aiff`, at: place(v.t), key: v.key })).filter((v) => v.at !== null);
const flips = timeline.sfx.map((f) => ({ file: tmp + "flip.wav", at: place(f.t) })).filter((f) => f.at !== null);
const sounds = [...voices, ...flips];
const inputs = sounds.flatMap((s) => ["-i", s.file]);
const mix = sounds.map((s, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(s.at * 1000)}:all=1[a${i}]`).join(";") +
  ";" + sounds.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${sounds.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[out]`;
ff(...inputs, "-filter_complex", mix, "-map", "[out]", "-c:a", "aac", "-b:a", "192k", tmp + "audio.m4a");

// Subtitles: one event per narration line, plus a chapter label per scene.
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${sec}`; };
const text = Object.fromEntries(SCENES.flatMap((s) => s.lines.map((l, i) => [`${s.id}_${i}`, l])));
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,DM Sans,36,&H00F3EDE3,&H00F3EDE3,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,330,330,26,1
Style: Chapter,DM Sans,24,&H00718DD9,&H00718DD9,&H00000000,&H00000000,1,0,0,0,100,100,2,0,1,0,0,1,100,100,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
for (const v of voices) ass += `Dialogue: 0,${ts(v.at)},${ts(v.at + durations[v.key] + 0.2)},Sub,,0,0,0,,${text[v.key]}\n`;
SCENES.forEach((scene) => {
  const c = clips.find((c) => c.scene?.id === scene.id);
  if (c) ass += `Dialogue: 0,${ts(c.at)},${ts(c.at + c.duration)},Chapter,,0,0,0,,${String(SCENES.indexOf(scene) + 1).padStart(2, "0")}  ${scene.title.toUpperCase()}\n`;
});
writeFileSync(tmp + "subs.ass", ass);
// libass needs real font files; fontsource ships WOFF, which FreeType reads.
mkdirSync(tmp + "fonts", { recursive: true });
for (const w of ["400", "700"]) {
  const src = `${FLIPBOOK}/node_modules/@fontsource/dm-sans/files/dm-sans-latin-${w}-normal.woff`;
  writeFileSync(`${tmp}fonts/dm-sans-${w}.woff`, readFileSync(src));
}
ff("-i", tmp + "video.mp4", "-i", tmp + "audio.m4a", "-vf", `subtitles=${tmp}subs.ass:fontsdir=${tmp}fonts`, ...encode, "-c:a", "copy", "-movflags", "+faststart", "-shortest", target);
console.log(`Wrote ${target} (${total.toFixed(1)}s, ${clips.length} clips, ${voices.length} narration lines, ${flips.length} page turns)`);
