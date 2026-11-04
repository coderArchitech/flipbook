import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as fontkit from "fontkit";
import { renderPDF } from "../../server/pdf-render.mjs";
import { makeDocument, makePage } from "../../shared/document.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
import { validateDocument } from "../../shared/document.mjs";
import { FONT_CHOICES } from "../../shared/editor-schema.mjs";
import { fontFamily } from "../../shared/editor-render.mjs";
import {
  BUILTIN_FONTS,
  builtinFontFiles,
  builtinFontFaceCSS,
} from "../../shared/fonts.mjs";
import { pdfOperators } from "../font-fixture.mjs";

// Same mapping as server/jobs.mjs, without importing the database.
const fonts = Object.fromEntries(
  builtinFontFiles().map((f) => [
    f.name,
    resolve(`node_modules/@fontsource/${f.pkg}/files/${f.file}`),
  ]),
);
const postscript = (name) =>
  fontkit.openSync(fonts[name].replace(/woff2$/, "woff")).postscriptName;

test("every built-in font style is packaged in the format the browser and PDF use", () => {
  expect(BUILTIN_FONTS).toHaveLength(14);
  expect(new Set(BUILTIN_FONTS.map((f) => f.key)).size).toBe(14);
  for (const f of builtinFontFiles()) {
    const path = fonts[f.name];
    expect(existsSync(path), path).toBe(true);
    expect(existsSync(path.replace(/woff2$/, "woff")), path).toBe(true);
    const face = fontkit.openSync(path.replace(/woff2$/, "woff"));
    expect(face.familyName).toContain(f.family.split(" ")[0]);
    expect(face["OS/2"].usWeightClass).toBe(f.weight);
    expect(face.italicAngle !== 0).toBe(f.style === "italic");
  }
  // The two original fonts keep their keys, so existing documents are unchanged.
  expect(FONT_CHOICES.sans).toBe("DM Sans");
  expect(FONT_CHOICES.serif).toBe("Instrument Serif");
});

test("built-in fonts validate, map to CSS stacks and get @font-face rules", () => {
  const css = builtinFontFaceCSS();
  for (const f of BUILTIN_FONTS) {
    const d = upgradeDocument(makeDocument("Fonts"));
    d.pages = [makePage("blank")];
    d.brand = { ...d.brand, headingFont: f.key, bodyFont: f.key };
    const text = newElement("text", [0, 0, 6, 4]);
    text.textStyle = { font: f.key };
    d.pages[0].blocks.push(text);
    expect(validateDocument(d).map((x) => x.message)).toEqual([]);
    expect(fontFamily(f.key)).toBe(`'${f.family}',${f.fallback}`);
    expect(css).toContain(
      `font-family:'${f.family}';src:url('/fonts/${f.key}.woff2')`,
    );
  }
  expect(css.match(/@font-face/g)).toHaveLength(builtinFontFiles().length);
  expect(fontFamily("not-a-font")).toBe("'Instrument Serif',serif");
});

test("PDF export embeds each built-in font and its packaged bold and italic", async () => {
  const d = upgradeDocument(makeDocument("Fonts"));
  d.pages = [makePage("blank")];
  BUILTIN_FONTS.forEach((f, i) => {
    const text = newElement("text", [0, i * 2, 12, 2]);
    text.textStyle = { font: f.key, size: 14 };
    text.richText = [
      {
        kind: "paragraph",
        runs: [
          { text: "Regular " },
          { text: "Bold ", bold: true },
          { text: "Italic", italic: true },
        ],
      },
    ];
    d.pages[0].blocks.push(text);
  });
  const bytes = await renderPDF({ document: d, assets: {}, fonts });
  const embedded = new Set(
    [
      ...bytes.toString("latin1").matchAll(/\/FontName \/[A-Z]{6}\+([^\s/]+)/g),
    ].map((m) => m[1]),
  );
  for (const f of BUILTIN_FONTS) {
    expect(embedded).toContain(postscript(`${f.key}.woff2`));
    if (f.bold) expect(embedded).toContain(postscript(`${f.key}-bold.woff2`));
    if (f.italic)
      expect(embedded).toContain(postscript(`${f.key}-italic.woff2`));
  }
  // Fonts without a bold weight (Instrument Serif, Bebas Neue, Abril Fatface)
  // draw bold runs with a fill-and-stroke outline instead.
  expect(pdfOperators(bytes).match(/\b2 Tr\b/g)?.length).toBeGreaterThanOrEqual(
    3,
  );
});
