// Test fixtures for uploaded fonts and PDF inspection.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

// A packaged font that is not one of the built-in faces, so it is clearly "custom".
export const CUSTOM_WOFF = resolve(
  "node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff",
);
export const CUSTOM_WOFF2 = CUSTOM_WOFF.replace(/\.woff$/, ".woff2");
export const CUSTOM_POSTSCRIPT = "InstrumentSerif-Italic";

// Rebuild a WOFF as a plain TrueType file; optionally set OS/2 fsType bits.
export function woffToTtf(woff = readFileSync(CUSTOM_WOFF), { fsType } = {}) {
  const tables = [],
    count = woff.readUInt16BE(12);
  for (let i = 0; i < count; i++) {
    const at = 44 + i * 20,
      tag = woff.toString("latin1", at, at + 4),
      offset = woff.readUInt32BE(at + 4),
      compressed = woff.readUInt32BE(at + 8),
      length = woff.readUInt32BE(at + 12),
      raw = woff.subarray(offset, offset + compressed);
    const data = Buffer.from(compressed < length ? inflateSync(raw) : raw);
    if (tag === "OS/2" && fsType !== undefined) data.writeUInt16BE(fsType, 8);
    tables.push({ tag, data });
  }
  const header = Buffer.alloc(12 + count * 16);
  header.writeUInt32BE(woff.readUInt32BE(4), 0);
  header.writeUInt16BE(count, 4);
  let offset = header.length;
  const bodies = [];
  tables.forEach(({ tag, data }, i) => {
    const at = 12 + i * 16,
      padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    header.write(tag, at, "latin1");
    header.writeUInt32BE(offset, at + 8);
    header.writeUInt32BE(data.length, at + 12);
    bodies.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([header, ...bodies]);
}

// Inflate every Flate stream so tests can inspect PDF drawing operators.
export function pdfOperators(bytes) {
  const text = bytes.toString("latin1"),
    out = [];
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length,
      end = text.indexOf("endstream", start);
    try {
      out.push(inflateSync(bytes.subarray(start, end)).toString("latin1"));
    } catch {}
  }
  return out.join("\n");
}
