// Generates the demo's illustrations (flat style matching the app's starter art),
// the low-resolution image, the logo, the video poster and the catalog CSVs.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { FLIPBOOK } from "./paths.mjs";
const sharp = createRequire(FLIPBOOK + "/package.json")("sharp");

const out = new URL("./out/assets/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const C = {
  cream: "#efe6d8", oat: "#e2d5bf", sand: "#d9c7a8", terracotta: "#b26545",
  clay: "#c98a64", ochre: "#d2a34f", sage: "#8f9f7e", olive: "#5d6b4c",
  charcoal: "#3a332d", walnut: "#7a5236", sky: "#cfd8d4", linen: "#e6d7b7",
};
const svg = (w, h, bg, art) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${art}</svg>`;

const vessel = (x, y, s = 1, body = C.terracotta, rim = "#db9875") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="300" rx="190" ry="30" fill="#000" opacity=".12"/><path d="M-150 0h300l-25 290q-125 95-250 0z" fill="${body}"/><ellipse cx="-10" cy="0" rx="150" ry="40" fill="${rim}"/><ellipse cx="-10" cy="0" rx="120" ry="25" fill="#593b2e"/><path d="M144 45c150-25 160 210-8 170" fill="none" stroke="${body}" stroke-width="38" opacity=".95"/></g>`;
const arcLamp = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="560" rx="110" ry="22" fill="#000" opacity=".15"/><ellipse cx="0" cy="545" rx="95" ry="20" fill="${C.charcoal}"/><path d="M-6 540V60q0-90 150-110" fill="none" stroke="${C.charcoal}" stroke-width="14"/><path d="M60 -10q85-120 210-60l-30 70z" fill="${C.ochre}"/><ellipse cx="200" cy="-5" rx="80" ry="22" fill="#f4dc9a" opacity=".9"/></g>`;
const chair = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="440" rx="250" ry="34" fill="#000" opacity=".14"/><path d="M-210 120l45-170h310l65 170-45 200h-330z" fill="${C.walnut}"/><path d="M-165-15h265l50 155h-340z" fill="#d9bd8c"/><path d="M-200 180h370l-25 120h-320z" fill="#dfc797"/><path d="M-170 300l-30 140m340-140 35 140" stroke="#5e3f29" stroke-width="28"/></g>`;
const plant = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-60 120h120l-15 140h-90z" fill="${C.clay}"/>${[-70, -35, 0, 35, 70]
    .map((a, i) => `<path d="M0 120q${a} -${160 + i * 18} ${a * 2.2} -${230 + (i % 2) * 40}" fill="none" stroke="${C.olive}" stroke-width="10"/><ellipse cx="${a * 2.2}" cy="${-230 - (i % 2) * 40}" rx="34" ry="16" transform="rotate(${a} ${a * 2.2} ${-230 - (i % 2) * 40})" fill="${C.sage}"/>`)
    .join("")}</g>`;
const windowFrame = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.sky}"/><circle cx="${x + w * 0.72}" cy="${y + h * 0.3}" r="${w * 0.12}" fill="#f1e2b8"/><path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="${C.oat}" stroke-width="16"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.oat}" stroke-width="22"/>`;
const rug = (cx, cy, rx, ry, fill = C.sand) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.82}" ry="${ry * 0.78}" fill="none" stroke="${C.clay}" stroke-width="6" opacity=".5"/>`;
const sideTable = (x, y) =>
  `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="150" ry="30" fill="${C.walnut}"/><path d="M-12 20v220h24V20z" fill="#5e3f29"/><ellipse cx="0" cy="245" rx="90" ry="16" fill="#5e3f29"/></g>`;
const linenStack = (fill, stripe, bg) =>
  svg(900, 900, bg, `<ellipse cx="450" cy="720" rx="300" ry="40" fill="#000" opacity=".1"/>${[0, 1, 2]
    .map((i) => `<path d="M${200 + i * 10} ${560 - i * 120}h${500 - i * 20}q30 0 30 30v60q0 30-30 30h-${500 - i * 20}q-30 0-30-30v-60q0-30 30-30z" fill="${fill}" opacity="${1 - i * 0.08}"/><path d="M${230 + i * 10} ${610 - i * 120}h${440 - i * 20}" stroke="${stripe}" stroke-width="6" opacity=".6"/>`)
    .join("")}`);

const images = {
  "cover-room.png": [1200, 1700, svg(1200, 1700, C.oat, `${windowFrame(150, 180, 560, 760)}${rug(620, 1480, 520, 120)}${arcLamp(250, 760, 1.25)}${chair(760, 1080, 1.05)}${plant(1030, 1200, 1.1)}${sideTable(380, 1230)}${vessel(380, 1050, 0.45)}`)],
  "lookbook-room.png": [1600, 1200, svg(1600, 1200, C.cream, `<rect y="880" width="1600" height="320" fill="${C.oat}"/><rect x="620" y="170" width="360" height="270" fill="${C.sage}"/><rect x="650" y="200" width="300" height="210" fill="${C.sky}"/><path d="M650 410l110-120 80 70 50-40 60 90z" fill="${C.olive}"/>${rug(820, 1020, 600, 110)}${arcLamp(330, 400, 1.15)}${sideTable(800, 860)}${vessel(800, 690, 0.42)}${chair(1230, 640, 1.0)}${plant(1500, 760, 0.9)}`)],
  "vessel-side.png": [900, 900, svg(900, 900, "#e4dacb", vessel(440, 300, 1, "#a85d40", "#d48e6b"))],
  "vessel-top.png": [900, 900, svg(900, 900, "#cfc3ae", `<circle cx="450" cy="450" r="290" fill="#a85d40"/><circle cx="450" cy="450" r="245" fill="#d48e6b"/><circle cx="450" cy="450" r="200" fill="#593b2e"/><circle cx="450" cy="450" r="120" fill="#4a3127"/><path d="M730 420q120 30 0 80" fill="none" stroke="#a85d40" stroke-width="36"/>`)],
  "vessel-pair.png": [900, 900, svg(900, 900, C.sky, `${vessel(300, 360, 0.75, C.sage, "#b8c4a8")}${vessel(590, 320, 0.9)}`)],
  "studio-shelves.png": [900, 900, svg(900, 900, C.cream, `${[260, 480, 700].map((y) => `<rect x="90" y="${y}" width="720" height="18" fill="${C.walnut}"/>`).join("")}${[[170, 260, C.terracotta], [320, 260, C.sage], [470, 260, C.ochre], [640, 260, C.clay], [210, 480, C.charcoal], [400, 480, C.terracotta], [600, 480, C.sand], [260, 700, C.olive], [480, 700, C.clay], [680, 700, C.terracotta]].map(([x, y, f]) => `<path d="M${x - 50} ${y}q-10-110 30-150h40q40 40 30 150z" fill="${f}"/>`).join("")}`)],
  "studio-wheel.png": [900, 900, svg(900, 900, "#d7cbb8", `<ellipse cx="450" cy="640" rx="300" ry="70" fill="${C.charcoal}"/><ellipse cx="450" cy="610" rx="250" ry="55" fill="#5a5148"/><path d="M340 600q-20-210 110-260 130 50 110 260z" fill="${C.clay}"/><ellipse cx="450" cy="345" rx="60" ry="16" fill="#8a5a40"/>`)],
  "studio-glazes.png": [900, 900, svg(900, 900, C.oat, `${[["#b26545", 170], ["#8f9f7e", 330], ["#d2a34f", 490], ["#3a332d", 650]].map(([f, x]) => `<rect x="${x - 70}" y="330" width="140" height="260" rx="22" fill="#f2ece2"/><rect x="${x - 70}" y="430" width="140" height="160" rx="22" fill="${f}"/><rect x="${x - 50}" y="300" width="100" height="40" rx="10" fill="${C.walnut}"/>`).join("")}<rect x="90" y="590" width="720" height="24" fill="${C.walnut}"/>`)],
  "studio-bowls.png": [900, 900, svg(900, 900, C.sky, `${[0, 1, 2, 3].map((i) => `<path d="M${250 + i * 12} ${620 - i * 70}q200 ${120 - i * 6} ${400 - i * 24} 0z" fill="${[C.terracotta, C.oat, C.sage, C.clay][i]}"/>`).join("")}<ellipse cx="450" cy="640" rx="230" ry="28" fill="#000" opacity=".1"/>`)],
  "studio-loom.png": [900, 900, svg(900, 900, "#e9dfcf", `<rect x="170" y="150" width="560" height="620" fill="none" stroke="${C.walnut}" stroke-width="30"/>${Array.from({ length: 22 }, (_, i) => `<path d="M${205 + i * 23} 165v590" stroke="${C.sand}" stroke-width="5"/>`).join("")}<rect x="200" y="420" width="500" height="200" fill="${C.sage}" opacity=".85"/><rect x="200" y="470" width="500" height="40" fill="${C.ochre}" opacity=".8"/>`)],
  "studio-tools.png": [900, 900, svg(900, 900, "#c9b79c", `<rect x="80" y="520" width="740" height="60" fill="${C.walnut}"/>${[[220, C.charcoal], [380, C.terracotta], [540, C.olive], [690, C.ochre]].map(([x, f], i) => `<path d="M${x} ${500 - i * 20}l18-300h14l18 300z" fill="${f}"/><circle cx="${x + 25}" cy="${190 - i * 20}" r="22" fill="${f}"/>`).join("")}`)],
  "linen-oat.png": [900, 900, linenStack("#e6d7b7", "#b9a983", "#d8d4c8")],
  "linen-sage.png": [900, 900, linenStack("#a9b796", "#7e9076", "#e3e0d4")],
  "linen-clay.png": [900, 900, linenStack("#d39b7a", "#a96a4c", "#ece2d3")],
  "linen-charcoal.png": [900, 900, linenStack("#5a534c", "#8a817a", "#ddd5c7")],
  "film-poster.png": [1600, 900, svg(1600, 900, "#3a332d", `<rect x="0" y="0" width="1600" height="900" fill="#4a4038"/><rect x="980" y="90" width="430" height="560" fill="#6d6152"/><rect x="1010" y="120" width="370" height="500" fill="#9c8f78" opacity=".6"/><ellipse cx="760" cy="700" rx="430" ry="90" fill="#2a241f"/><ellipse cx="760" cy="670" rx="360" ry="70" fill="#5a5148"/><path d="M640 660q-30-260 120-320 150 60 120 320z" fill="${C.clay}"/><ellipse cx="760" cy="345" rx="62" ry="16" fill="#8a5a40"/><path d="M1060 640h320" stroke="#2a241f" stroke-width="18"/>`)],
};
for (const [name, [w, h, art]] of Object.entries(images))
  await sharp(Buffer.from(art)).resize(w, h).png().toFile(out + name);
// A deliberately small image for the print-quality warning.
await sharp(Buffer.from(svg(900, 900, "#e4dacb", vessel(440, 300, 1)))).resize(160, 160).png().toFile(out + "vessel-thumbnail-small.png");
// Transparent logo mark: a ring and a leaf.
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="170" fill="none" stroke="${C.charcoal}" stroke-width="22"/><path d="M200 300q-110-90 0-200 110 110 0 200z" fill="${C.terracotta}"/><path d="M200 290v-170" stroke="${C.cream}" stroke-width="10"/></svg>`)).png().toFile(out + "holm-field-logo.png");

const header = "Name,Summary,Price,SKU,Image";
const rows = [
  ["Linen tea towel, oat", "Stonewashed European linen, hung to dry.", "18.00", "LIN-OAT", "linen-oat.png"],
  ["Linen napkins, sage", "A set of four, softer with every wash.", "32.00", "LIN-SAGE", "linen-sage.png"],
  ["Linen runner, clay", "A warm table runner for long dinners.", "48.00", "LIN-CLAY", "linen-clay.png"],
  ["Linen throw, charcoal", "Heavyweight linen for cool evenings.", "96.00", "LIN-CHAR", "linen-charcoal.png"],
];
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = (r) => [header, ...r.map((x) => x.map(cell).join(","))].join("\n");
writeFileSync(out + "textiles.csv", csv(rows));
writeFileSync(out + "textiles-missing-image.csv", csv(rows.map((r, i) => (i === 2 ? [...r.slice(0, 4), ""] : r))));
// A six-second film for the video block: a slow push-in on the wheel.
const { execFileSync } = await import("node:child_process");
const { FFMPEG } = await import("./paths.mjs");
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", out + "film-poster.png",
  "-vf", "zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1280x720:fps=30,format=yuv420p",
  "-t", "6", "-c:v", "libvpx", "-b:v", "1500k", out + "wheel.webm"]);
console.log("Assets written to", out);
