import { test, expect } from "vitest";
import { readerHTML } from "../../server/reader.mjs";
import { makeDocument, makePage } from "../../shared/document.mjs";
import { rectangle, PAGE } from "../../shared/layout.mjs";
test("reader escapes user markup and safely embeds JSON without closing its script", () => {
  const doc = makeDocument();
  doc.title = "</script><script>alert(1)</script>";
  doc.pages = [makePage("closing")];
  const html = readerHTML(
    { slug: "test" },
    { id: "v1", document: JSON.stringify(doc) },
    "event-token",
  );
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;/script&gt;");
  const payload = html.match(/id="reader-data">(.*?)<\/script>/s)[1];
  expect(JSON.parse(payload).document.title).toBe(doc.title);
});
test("reader asset links are pinned to their published version", () => {
  const doc = makeDocument();
  const img = doc.pages[0].blocks.find((b) => b.type === "image");
  img.assetId = "asset-1";
  img.alt = "A photograph";
  const html = readerHTML(
    { slug: "catalog" },
    { id: "version-2", document: JSON.stringify(doc) },
    "token",
  );
  expect(html).toContain(
    "/api/reader/catalog/assets/asset-1?version=version-2",
  );
  expect(html).toContain('aria-label="Mute flip sound"');
  expect(html).toContain('aria-label="Jump to page"');
});
test("full-page grid geometry stays within A4 margins for HTML and PDF", () => {
  const box = rectangle([0, 0, 12, 36]);
  expect(box).toEqual({ x: 45, y: 45, width: 704, height: 1033 });
  const last = rectangle([11, 35, 1, 1]);
  expect(last.x + last.width).toBeCloseTo(PAGE.width - PAGE.padding);
  expect(last.y + last.height).toBeCloseTo(PAGE.height - PAGE.padding);
});
test("published reader exposes accessible navigation, view settings and print with text-only titles", () => {
  const doc = makeDocument();
  doc.pages[0].title = "<img src=x onerror=alert(1)>";
  const html = readerHTML(
    { slug: "catalog" },
    { id: "v3", document: JSON.stringify(doc) },
    "token",
  );
  for (const label of [
    "Show thumbnails",
    "Search publication",
    "View options",
    "Print publication",
    "Go to first page",
    "Go to last page",
    "Start autoplay",
  ])
    expect(html).toContain(`aria-label="${label}"`);
  for (const mode of ["3d", "2d", "slide", "scroll"])
    expect(html).toContain(`value="${mode}"`);
  expect(html).not.toContain("<img src=x onerror=alert(1)>");
  expect(html).toContain('src="/reader.js"');
});
