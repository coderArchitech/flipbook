import { effectivePage } from "../shared/design.mjs";
export const defaults = Object.freeze({
  mode: "3d",
  layout: "auto",
  direction: "ltr",
  binding: "hard",
  background: "warm",
});
const choices = {
  mode: ["3d", "2d", "slide", "scroll"],
  layout: ["auto", "single", "spread"],
  direction: ["ltr", "rtl"],
  binding: ["hard", "soft", "spiral"],
  background: ["warm", "light", "dark"],
};
export function settingsFrom(value) {
  const result = { ...defaults };
  if (value && typeof value === "object")
    for (const key of Object.keys(defaults))
      if (choices[key].includes(value[key])) result[key] = value[key];
  return result;
}
export function loadSettings() {
  try {
    return settingsFrom(
      JSON.parse(localStorage.getItem("flipbook-reader-settings")),
    );
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(value) {
  const safe = settingsFrom(value);
  try {
    localStorage.setItem("flipbook-reader-settings", JSON.stringify(safe));
  } catch {}
  return safe;
}
export function searchPages(document, query) {
  const needle = String(query || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .slice(0, 200);
  if (!needle) return [];
  return document.pages
    .flatMap((page, index) => {
      const text = [
        page.title,
        ...effectivePage(page, document, index).blocks.map((b) =>
          b.type === "product"
            ? [
                b.product.name,
                b.product.summary,
                b.product.description,
                b.product.sku,
                b.product.category,
              ].join(" ")
            : b.type === "gallery"
              ? b.images.map((i) => i.alt).join(" ")
              : b.type === "media"
                ? b.title + " " + b.description
                : b.text || b.alt || "",
        ),
      ]
        .join(" ")
        .replace(/\s+/g, " ");
      const position = text
        .normalize("NFKC")
        .toLocaleLowerCase()
        .indexOf(needle);
      return position < 0
        ? []
        : [
            {
              index,
              id: page.id,
              title: page.title,
              snippet:
                (position > 35 ? "…" : "") +
                text.slice(
                  Math.max(0, position - 35),
                  position + needle.length + 90,
                ) +
                (position + needle.length + 90 < text.length ? "…" : ""),
            },
          ];
    })
    .slice(0, 100);
}
