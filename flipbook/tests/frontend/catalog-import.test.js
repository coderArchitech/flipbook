import { test, expect } from "vitest";
import {
  parseCsv,
  suggestMapping,
  previewImport,
} from "../../shared/catalog-import.mjs";
const assets = [{ id: "image-1", name: "chair.png" }];
test("CSV parser handles BOM, quoted commas, embedded newlines, escaped quotes and CRLF", () => {
  const parsed = parseCsv(
    '\uFEFFName,Summary,Image\r\n"Chair, oak","A ""crafted""\nseat",chair.png\r\n',
  );
  expect(parsed.headers).toEqual(["Name", "Summary", "Image"]);
  expect(parsed.records[0].cells).toEqual([
    "Chair, oak",
    'A "crafted"\nseat',
    "chair.png",
  ]);
  const rows = previewImport(parsed, suggestMapping(parsed.headers), assets);
  expect(rows[0].errors).toEqual([]);
  expect(rows[0].product.images).toEqual(["image-1"]);
});
test("malformed CSV, ambiguous mappings and bounds are rejected before mutation", () => {
  for (const value of [
    "Name,Name\na,b",
    'Name\n"unfinished',
    'Name\n"a"oops',
    "",
  ])
    expect(() => parseCsv(value)).toThrow();
  expect(() =>
    parseCsv("Name\n" + Array.from({ length: 201 }, () => "a").join("\n")),
  ).toThrow("200");
  const parsed = parseCsv("Name,Summary\nChair,A seat");
  expect(() => previewImport(parsed, { name: 0, summary: 0 })).toThrow(
    "only one",
  );
  expect(() => previewImport(parsed, { name: 0, image: 5 })).toThrow("mapping");
});
test("preview reports invalid URLs, missing/ambiguous assets, mismatched rows and duplicate SKU", () => {
  const parsed = parseCsv(
    "Name,Summary,Image,SKU,URL\nChair,A seat,missing.png,C1,javascript:alert(1)\nLamp,A light,chair.png,C1\n",
  );
  const rows = previewImport(parsed, suggestMapping(parsed.headers), [
    ...assets,
    { id: "image-2", name: "chair.png" },
  ]);
  expect(rows[0].errors.join(" ")).toContain("HTTPS");
  expect(rows[0].errors.join(" ")).toContain("Upload");
  expect(rows[1].errors.join(" ")).toContain("ambiguous");
  expect(rows[1].errors.join(" ")).toContain("duplicated");
  expect(rows[1].errors.join(" ")).toContain("cells");
});
