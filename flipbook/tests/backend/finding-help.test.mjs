import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { makeDocument, validateDocument } from "../../shared/document.mjs";
import { findingHelp } from "../../shared/finding-help.mjs";
import { sharedBuildId } from "../../server/build-id.mjs";

const messages = (d) => validateDocument(d).map((f) => f.message);

test("structural problems get their own finding instead of one catch-all", () => {
  const d = makeDocument("Structure");
  expect(messages(null)).toEqual(["The draft could not be read."]);
  expect(messages({ ...d, schemaVersion: 3 })).toEqual([
    "Document format 3 is not supported by this server.",
  ]);
  expect(messages({ ...d, theme: "neon" })).toEqual([
    'Theme "neon" is not available.',
  ]);
  expect(
    messages({ ...d, pages: Array.from({ length: 101 }, () => d.pages[0]) }),
  ).toEqual(["This magazine has 101 pages; the limit is 100."]);
  // Several problems are all reported at once.
  expect(messages({ ...d, schemaVersion: 9, pages: null, theme: 1 })).toEqual([
    "Document format 9 is not supported by this server.",
    "The draft has no page list.",
    "Theme 1 is not available.",
  ]);
});

test("every finding the app can produce has written guidance", () => {
  // Literal messages passed to the validators, layout warnings, PDF and job errors.
  const sources = [
    "shared/document.mjs",
    "shared/editor-schema.mjs",
    "shared/design.mjs",
    "shared/catalog-import.mjs",
    "server/pdf-render.mjs",
    "server/jobs.mjs",
  ].map((f) => readFileSync(f, "utf8"));
  const found = new Set();
  for (const src of sources)
    for (const m of src.matchAll(
      /(?:\badd|\bissue|\berrors\.push|Error)\(\s*(["'])([A-Z][^"'$]{8,})\1|message:\s*(["'])([A-Z][^"'$]{8,})\3/g,
    ))
      found.add(m[2] || m[4]);
  expect(found.size).toBeGreaterThan(50);
  const missing = [...found].filter((m) => !findingHelp(m).known);
  expect(missing).toEqual([]);
  // Templated messages, checked through real validation output.
  const d = makeDocument("Help");
  for (const bad of [
    { ...d, schemaVersion: 3 },
    { ...d, theme: "neon" },
    { ...d, pages: Array.from({ length: 101 }, () => d.pages[0]) },
    null,
  ])
    for (const m of messages(bad)) expect(findingHelp(m).known, m).toBe(true);
});

test("guidance distinguishes server-version problems and handles older servers", () => {
  const legacy = findingHelp("Unsupported document or theme.");
  expect(legacy.title).toBe("The server rejected the draft's structure");
  expect(legacy.server).toBe(true);
  expect(legacy.steps[0]).toMatch(/restart the server/);
  expect(
    findingHelp("Document format 3 is not supported by this server.").server,
  ).toBe(true);
  expect(findingHelp("Add text or remove this empty block.").server).toBe(
    false,
  );
  expect(
    findingHelp("Row 4: SKU is duplicated within this import.").title,
  ).toBe("Duplicate SKU");
  const unknown = findingHelp("Something new went wrong.");
  expect(unknown.known).toBe(false);
  expect(unknown.steps.length).toBeGreaterThan(0);
});

test("the shared build ID is stable for the same code", () => {
  expect(sharedBuildId()).toMatch(/^[0-9a-f]{16}$/);
  expect(sharedBuildId()).toBe(sharedBuildId());
});
