// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from "vitest";
import {
  settingsFrom,
  defaults,
  loadSettings,
  saveSettings,
  searchPages,
} from "../../public/reader-model.js";
beforeEach(() => localStorage.clear());
test("preferences accept only supported values and survive malformed or unavailable storage", () => {
  expect(
    settingsFrom({ mode: "hacked", layout: "single", extra: "x" }),
  ).toEqual({ ...defaults, layout: "single" });
  localStorage.setItem("flipbook-reader-settings", "{");
  expect(loadSettings()).toEqual(defaults);
  saveSettings({
    ...defaults,
    direction: "rtl",
    binding: "spiral",
    background: "dark",
  });
  expect(loadSettings().direction).toBe("rtl");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  expect(loadSettings()).toEqual(defaults);
  expect(saveSettings({ mode: "2d" }).mode).toBe("2d");
});
const doc = {
  pages: [
    {
      id: "cover",
      title: "Spring",
      blocks: [{ type: "text", text: "Fresh ideas" }],
    },
    {
      id: "chair",
      title: "Living",
      blocks: [
        {
          type: "product",
          product: {
            name: "Oak chair",
            description: "Hand finished timber",
            sku: "CH-４２",
            category: "Seating",
          },
        },
      ],
    },
    {
      id: "image",
      title: "Details",
      blocks: [{ type: "image", alt: "A woven seat <img onerror=alert(1)>" }],
    },
  ],
};
test("search finds normalized SKU, product description, title, text and image descriptions", () => {
  for (const [query, index] of [
    ["ch-42", 1],
    ["TIMBER", 1],
    ["spring", 0],
    [" fresh ", 0],
    ["woven", 2],
  ])
    expect(searchPages(doc, query).map((r) => r.index)).toEqual([index]);
  expect(searchPages(doc, "does not exist")).toEqual([]);
  expect(searchPages(doc, "  ")).toEqual([]);
});
test("search returns data rather than HTML and caps results at the publication limit", () => {
  expect(searchPages(doc, "<img")[0].snippet).toContain("<img");
  const many = {
    pages: Array.from({ length: 120 }, (_, i) => ({
      ...doc.pages[0],
      id: String(i),
    })),
  };
  expect(searchPages(many, "spring")).toHaveLength(100);
});
