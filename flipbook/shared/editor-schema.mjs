import { plainText } from "./rich-text.mjs";
import { ICON_NAMES } from "./icons.mjs";
import { BUILTIN_FONTS } from "./fonts.mjs";
export const FONT_CHOICES = Object.freeze(
  Object.fromEntries(BUILTIN_FONTS.map((f) => [f.key, f.family])),
);
// Uploaded fonts are referenced as "custom:<font id>" and resolved per owner.
export const CUSTOM_FONT = /^custom:[0-9a-f-]{36}$/;
export const isFontChoice = (font) =>
  typeof font === "string" &&
  (Object.hasOwn(FONT_CHOICES, font) || CUSTOM_FONT.test(font));
export const PRODUCT_IMAGE_LAYOUTS = ["single", "thumbnails", "grid"];
// Master margins are grid units: columns for left/right, rows for top/bottom.
export const MARGIN_LIMITS = Object.freeze({
  left: 3,
  right: 3,
  top: 9,
  bottom: 9,
});
export const SHAPES = [
  "rectangle",
  "ellipse",
  "line",
  "arrow",
  "star",
  "badge",
  "heart",
];
export const PRODUCT_FIELDS = [
  "image",
  "name",
  "summary",
  "description",
  "price",
  "sku",
  "category",
  "badge",
  "link",
];
export const isColor = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const bounded = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
const short = (s, max) => typeof s === "string" && s.length <= max;
export function validateEditorExtensions(doc, safeUrl, complete = false) {
  const errors = [],
    add = (message, pageId, blockId) =>
      errors.push({ message, pageId, blockId });
  const ids = new Set(),
    pageIds = new Set(doc.pages.map((p) => p?.id));
  const styles = doc.styles || [],
    masters = doc.masters || [];
  const textStyle = (s, where) => {
    if (!object(s)) {
      add("Invalid " + where + ".");
      return;
    }
    for (const k of ["color", "background"])
      if (s[k] !== undefined && !isColor(s[k]))
        add("Invalid " + where + " color.");
    if (s.font !== undefined && !isFontChoice(s.font))
      add("Choose an approved font.");
    for (const [key, min, max] of [
      ["size", 10, 64],
      ["lineHeight", 0.8, 3],
      ["letterSpacing", -2, 12],
    ])
      if (s[key] !== undefined && !bounded(s[key], min, max))
        add("Invalid " + where + " " + key + ".");
    for (const k of ["bold", "italic", "underline"])
      if (s[k] !== undefined && typeof s[k] !== "boolean")
        add("Invalid " + where + " " + k + ".");
    if (s.align !== undefined && !["left", "center", "right"].includes(s.align))
      add("Invalid text alignment.");
  };
  if (!Array.isArray(styles) || styles.length > 50)
    add("Use at most 50 named styles.");
  else
    for (const style of styles) {
      if (
        !object(style) ||
        !short(style.id, 100) ||
        !short(style.name, 80) ||
        !style.name.trim() ||
        ids.has(style.id)
      ) {
        add("Invalid or duplicate named style.");
        continue;
      }
      ids.add(style.id);
      textStyle(style, "named style");
    }
  if (doc.brand !== undefined) {
    const brand = doc.brand;
    if (!object(brand)) add("Invalid brand kit.");
    else {
      for (const key of ["ink", "paper", "accent"])
        if (brand[key] !== undefined && !isColor(brand[key]))
          add("Invalid brand color.");
      for (const key of ["headingFont", "bodyFont"])
        if (brand[key] !== undefined && !isFontChoice(brand[key]))
          add("Choose an approved brand font.");
      if (brand.logoAssetId != null && !short(brand.logoAssetId, 100))
        add("Invalid brand logo.");
    }
  }
  if (
    doc.requireApproval !== undefined &&
    typeof doc.requireApproval !== "boolean"
  )
    add("Invalid review setting.");
  if (!Array.isArray(masters) || masters.length > 10)
    add("Use at most 10 master pages.");
  const masterIds = new Set();
  if (Array.isArray(masters))
    for (const master of masters) {
      if (
        !object(master) ||
        !short(master.id, 100) ||
        !short(master.name, 80) ||
        !master.name.trim() ||
        masterIds.has(master.id)
      ) {
        add("Invalid master page.");
        continue;
      }
      masterIds.add(master.id);
      if (!Array.isArray(master.blocks) || master.blocks.length > 20)
        add("Use at most 20 blocks on a master page.");
      if (
        master.margins !== undefined &&
        (!object(master.margins) ||
          Object.keys(master.margins).some(
            (k) => !Object.hasOwn(MARGIN_LIMITS, k),
          ) ||
          Object.entries(MARGIN_LIMITS).some(
            ([k, max]) => !bounded(master.margins[k], 0, max),
          ))
      )
        add("Invalid master page margins.");
    }
  const containers = [
    ...doc.pages,
    ...(Array.isArray(masters)
      ? masters.map((m) => m && { ...m, title: m.name })
      : []),
  ];

  for (const page of containers) {
    if (!object(page)) continue;
    if (page.masterId != null && !masterIds.has(page.masterId))
      add("Master page is no longer available.", page.id);
    if (page.footer !== undefined && typeof page.footer !== "boolean")
      add("Invalid page footer setting.", page.id);
    const bg = page.background;
    if (bg !== undefined) {
      if (!object(bg) || !["solid", "gradient", "image"].includes(bg.type))
        add("Invalid page background.", page.id);
      else {
        for (const key of ["color", "color2", "overlayColor"])
          if (bg[key] !== undefined && !isColor(bg[key]))
            add("Invalid background color.", page.id);
        if (
          bg.type === "gradient" &&
          (!isColor(bg.color) ||
            !isColor(bg.color2) ||
            !bounded(bg.angle, 0, 360))
        )
          add("Choose two gradient colors and a valid angle.", page.id);
        if (bg.type === "image" && !short(bg.assetId, 100))
          add("Choose a background image.", page.id);
        if (
          bg.overlayOpacity !== undefined &&
          !bounded(bg.overlayOpacity, 0, 1)
        )
          add("Invalid background opacity.", page.id);
        if (
          bg.crop !== undefined &&
          (!object(bg.crop) ||
            !bounded(bg.crop.x, 0, 100) ||
            !bounded(bg.crop.y, 0, 100) ||
            !bounded(bg.crop.zoom, 1, 3))
        )
          add("Invalid background crop.", page.id);
      }
    }
    for (const b of Array.isArray(page.blocks) ? page.blocks : []) {
      if (!object(b)) continue;
      const issue = (m) => add(m, page.id, b.id);
      for (const key of ["locked", "hidden", "showLabel"])
        if (b[key] !== undefined && typeof b[key] !== "boolean")
          issue("Invalid layer " + key + ".");
      for (const key of ["name", "groupId"])
        if (b[key] !== undefined && !short(b[key], 100))
          issue("Invalid layer " + key + ".");
      if (b.styleId != null && !ids.has(b.styleId))
        issue("Named style is no longer available.");
      if (b.textStyle !== undefined) textStyle(b.textStyle, "text style");
      if (b.richText !== undefined) {
        let valid = Array.isArray(b.richText) && b.richText.length <= 500;
        let runCount = 0;
        if (valid)
          for (const p of b.richText) {
            if (
              !object(p) ||
              !["paragraph", "bullet", "number"].includes(p.kind) ||
              !Array.isArray(p.runs)
            ) {
              valid = false;
              break;
            }
            runCount += p.runs.length;
            for (const r of p.runs) {
              if (!object(r) || !short(r.text, 20000)) {
                valid = false;
                break;
              }
              if (
                Object.keys(r).some(
                  (k) =>
                    ![
                      "text",
                      "bold",
                      "italic",
                      "underline",
                      "color",
                      "href",
                    ].includes(k),
                )
              )
                valid = false;
              for (const k of ["bold", "italic", "underline"])
                if (r[k] !== undefined && typeof r[k] !== "boolean")
                  valid = false;
              if (r.color !== undefined && !isColor(r.color)) valid = false;
              if (r.href !== undefined && !safeUrl(r.href)) valid = false;
            }
          }
        if (!valid || runCount > 2000) issue("Invalid rich text.");
        else if (plainText(b.richText) !== b.text)
          issue("Rich text and its plain-text copy must match.");
      }
      const a = b.appearance;
      if (a !== undefined) {
        if (!object(a)) issue("Invalid element appearance.");
        else {
          for (const [k, min, max] of [
            ["opacity", 0, 1],
            ["rotation", -180, 180],
            ["borderWidth", 0, 12],
            ["radius", 0, 400],
          ])
            if (a[k] !== undefined && !bounded(a[k], min, max))
              issue("Invalid appearance " + k + ".");
          for (const k of ["fill", "borderColor"])
            if (a[k] !== undefined && !isColor(a[k]))
              issue("Invalid appearance color.");
          for (const k of ["flipX", "flipY"])
            if (a[k] !== undefined && typeof a[k] !== "boolean")
              issue("Invalid image flip.");
          if (
            a.frame !== undefined &&
            !["rectangle", "circle", "ellipse", "diamond"].includes(a.frame)
          )
            issue("Unsupported image frame.");
        }
      }
      if (b.type === "shape" && !SHAPES.includes(b.shape))
        issue("Choose a supported shape.");
      if (
        b.type === "icon" &&
        (!ICON_NAMES.includes(b.icon) ||
          (b.color != null && !isColor(b.color)) ||
          !bounded(b.strokeWidth, 0.5, 4) ||
          !short(b.label ?? "", 200))
      )
        issue("Choose a supported icon, color and line weight.");
      if (b.type === "gallery") {
        if (
          complete &&
          !b.hidden &&
          (!Array.isArray(b.images) ||
            !b.images.length ||
            b.images.some((i) => typeof i?.alt !== "string" || !i.alt.trim()))
        )
          issue("Add gallery images and their descriptions.");
        if (
          !Array.isArray(b.images) ||
          b.images.length > 12 ||
          b.images.some(
            (i) => !object(i) || !short(i.assetId, 100) || !short(i.alt, 500),
          )
        )
          issue("Choose up to 12 gallery images with descriptions.");
        if (
          !Number.isInteger(b.columns) ||
          b.columns < 1 ||
          b.columns > 4 ||
          !bounded(b.gap, 0, 24)
        )
          issue("Invalid gallery layout.");
      }
      if (b.type === "hotspot") {
        const action = b.action;
        if (
          !short(b.label, 200) ||
          !b.label.trim() ||
          !object(action) ||
          !["url", "page", "product"].includes(action.kind)
        )
          issue("Add a hotspot label and destination.");
        else if (action.kind === "url" && !safeUrl(action.url))
          issue("Hotspot links must use HTTPS.");
        else if (action.kind === "page" && !pageIds.has(action.pageId))
          issue("Hotspot page is no longer available.");
        else if (
          action.kind === "product" &&
          !containers.some((p) =>
            p?.blocks?.some(
              (x) => x?.id === action.blockId && x.type === "product",
            ),
          )
        )
          issue("Hotspot product is no longer available.");
      }
      if (b.type === "media") {
        if (
          complete &&
          !b.hidden &&
          (typeof b.title !== "string" ||
            !b.title.trim() ||
            typeof b.description !== "string" ||
            !b.description.trim())
        )
          issue("Add a media title and description.");
        if (
          !["video", "audio"].includes(b.mediaKind) ||
          !safeUrl(b.url) ||
          !short(b.title, 160) ||
          !short(b.description, 1000)
        )
          issue("Add valid media type, HTTPS URL, title and description.");
        if (b.posterId != null && !short(b.posterId, 100))
          issue("Invalid media poster.");
      }
      if (b.presentation !== undefined) {
        const p = b.presentation;
        if (
          !object(p) ||
          !Array.isArray(p.fields) ||
          p.fields.some((f) => !PRODUCT_FIELDS.includes(f)) ||
          new Set(p.fields).size !== p.fields.length
        )
          issue("Invalid product field selection.");
        else {
          for (const k of [
            "priceColor",
            "badgeColor",
            "badgeTextColor",
            "background",
          ])
            if (p[k] !== undefined && !isColor(p[k]))
              issue("Invalid product presentation color.");
          if (p.priceSize !== undefined && !bounded(p.priceSize, 10, 48))
            issue("Invalid product price size.");
          if (
            p.imageLayout !== undefined &&
            !PRODUCT_IMAGE_LAYOUTS.includes(p.imageLayout)
          )
            issue("Invalid product image layout.");
        }
      }
    }
  }
  return errors;
}
export function editorAssetIds(doc) {
  const ids = [];
  if (doc.brand?.logoAssetId) ids.push(doc.brand.logoAssetId);
  for (const p of [...(doc.pages || []), ...(doc.masters || [])]) {
    if (p.background?.type === "image" && p.background.assetId)
      ids.push(p.background.assetId);
    for (const b of p.blocks || []) {
      if (b.assetId) ids.push(b.assetId);
      if (b.type === "media" && b.posterId) ids.push(b.posterId);
      for (const id of b.type === "product" && Array.isArray(b.product?.images)
        ? b.product.images
        : [])
        ids.push(id);
      for (const image of b.type === "gallery" && Array.isArray(b.images)
        ? b.images
        : [])
        if (image.assetId) ids.push(image.assetId);
    }
  }
  return [...new Set(ids)];
}

// Uploaded font IDs referenced anywhere a font can be chosen.
export function editorFontIds(doc) {
  const fonts = [doc.brand?.headingFont, doc.brand?.bodyFont];
  for (const style of Array.isArray(doc.styles) ? doc.styles : [])
    fonts.push(style?.font);
  for (const p of [...(doc.pages || []), ...(doc.masters || [])])
    for (const b of p?.blocks || []) fonts.push(b?.textStyle?.font);
  return [
    ...new Set(
      fonts
        .filter((f) => typeof f === "string" && CUSTOM_FONT.test(f))
        .map((f) => f.slice(7)),
    ),
  ];
}
