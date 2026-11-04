import PDFDocument from "pdfkit";
import sharp from "sharp";
import { formatPrice, safeUrl } from "../shared/document.mjs";
import { rectangle, PAGE } from "../shared/layout.mjs";
import {
  brandOf,
  styleOf,
  effectivePage,
  galleryBoxes,
  productImageBoxes,
  DEFAULT_PRODUCT_FIELDS,
} from "../shared/design.mjs";
import { ICONS } from "../shared/icons.mjs";
import { richTextOf } from "../shared/rich-text.mjs";
import { shapePath } from "../shared/editor-render.mjs";

// All geometry is in the same 794 x 1123 coordinates as the HTML renderer.
export async function renderPDF({
  document: doc,
  assets = {},
  fonts,
  customFonts = {},
}) {
  const theme = brandOf(doc),
    scale = 595.28 / PAGE.width,
    findings = [];
  const pdf = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    info: {
      Title: doc.title,
      Author: doc.publisher,
      Creator: "Flipbook local studio",
    },
    lang: "en",
  });
  for (const [name, path] of Object.entries(fonts))
    pdf.registerFont(
      name.replace(".woff2", ""),
      path.replace(/woff2$/, "woff"),
    );
  // Uploaded fonts are registered under the same "custom:<id>" name the document uses.
  for (const [id, path] of Object.entries(customFonts))
    pdf.registerFont("custom:" + id, path);
  const chunks = [],
    finished = new Promise((resolve, reject) => {
      pdf.on("data", (b) => chunks.push(b));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });
  const images = {};
  for (const [id, a] of Object.entries(assets))
    images[id] = {
      buffer: await sharp(a.path).png().toBuffer(),
      width: a.width,
      height: a.height,
    };
  // Closest packaged style; a missing bold is drawn with a fine outline below.
  const fontName = (font, bold = false, italic = false) =>
    [
      font + (bold ? "-bold" : "") + (italic ? "-italic" : ""),
      font + (bold ? "-bold" : ""),
      font + (italic ? "-italic" : ""),
    ].find((name) => fonts[name + ".woff2"]) || font;
  function setFont(font, size) {
    pdf.font(font).fontSize(size);
  }
  function textHeight(value, font, size, width, lineHeight = 1.2) {
    setFont(font, size);
    return pdf.heightOfString(value || "", {
      width,
      lineGap: size * lineHeight - pdf.currentLineHeight(true),
    });
  }
  function text(value, x, y, width, font = "sans", size = 16, opt = {}) {
    setFont(font, size);
    pdf.fillColor(opt.color || theme.ink).text(value || "", x, y, {
      width,
      height: 2000,
      lineGap: size * (opt.lineHeight || 1.2) - pdf.currentLineHeight(true),
      ...opt,
    });
  }
  function clipFrame(frame, x, y, w, h, radius = 0) {
    if (frame === "ellipse") pdf.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
    else if (frame === "circle")
      pdf.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2);
    else if (frame === "diamond")
      pdf
        .moveTo(x + w / 2, y)
        .lineTo(x + w, y + h / 2)
        .lineTo(x + w / 2, y + h)
        .lineTo(x, y + h / 2)
        .closePath();
    else pdf.roundedRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
    pdf.clip();
  }
  function image(
    id,
    x,
    y,
    w,
    h,
    crop = { x: 50, y: 50, zoom: 1 },
    frame = "rectangle",
  ) {
    const im = images[id];
    if (!im || w <= 0 || h <= 0) return;
    const fit = Math.max(w / im.width, h / im.height),
      bw = im.width * fit,
      bh = im.height * fit;
    pdf.save();
    clipFrame(frame, x, y, w, h);
    pdf
      .image(
        im.buffer,
        x + ((w - bw) * crop.x) / 100 - (bw * (crop.zoom - 1)) / 2,
        y + ((h - bh) * crop.y) / 100 - (bh * (crop.zoom - 1)) / 2,
        { width: bw * crop.zoom, height: bh * crop.zoom },
      )
      .restore();
  }
  // Measure each styled word, wrap to lines, then draw selectable text runs. No HTML parser or raster text.
  function rich(b, x, y, w, h) {
    const style = styleOf(b, doc),
      size = style.size,
      lineH = size * style.lineHeight,
      lines = [];
    let number = 0;
    for (const paragraph of richTextOf(b)) {
      const prefix =
        paragraph.kind === "bullet"
          ? "• "
          : paragraph.kind === "number"
            ? `${++number}. `
            : "";
      if (paragraph.kind !== "number") number = 0;
      const indent = prefix ? size * 1.4 : 0;
      let line = { parts: [], width: 0, indent, prefix };
      const push = () => {
        lines.push(line);
        line = { parts: [], width: 0, indent, prefix: "" };
      };
      for (const run of paragraph.runs) {
        const marks = { ...style, ...run },
          font = fontName(style.font, marks.bold, marks.italic);
        setFont(font, size);
        // Like CSS letter-spacing, the PDF adds spacing after every glyph,
        // including a token's last one; widthOfString omits that final gap.
        const measure = (s) =>
          pdf.widthOfString(s, { characterSpacing: style.letterSpacing }) +
          style.letterSpacing;
        for (const word of run.text.split(/(\s+)/).filter(Boolean)) {
          const tokens = measure(word) > w - indent ? Array.from(word) : [word];
          for (const token of tokens) {
            const width = measure(token);
            if (line.parts.length && line.width + width > w - indent) push();
            if (!line.parts.length && /^\s+$/.test(token)) continue;
            line.parts.push({ text: token, width, font, marks });
            line.width += width;
          }
        }
      }
      push();
    }
    if (lines.length * lineH > h + 1) return true;
    for (const [i, line] of lines.entries()) {
      let xx =
        x +
        line.indent +
        (style.align === "center"
          ? (w - line.indent - line.width) / 2
          : style.align === "right"
            ? w - line.indent - line.width
            : 0);
      if (line.prefix)
        text(
          line.prefix,
          x,
          y + i * lineH,
          line.indent,
          fontName(style.font),
          size,
          { lineBreak: false, color: style.color },
        );
      for (const part of line.parts) {
        setFont(part.font, size);
        pdf
          .fillColor(part.marks.color)
          .strokeColor(part.marks.color)
          .lineWidth(0.15)
          .text(part.text, xx, y + i * lineH, {
            lineBreak: false,
            characterSpacing: style.letterSpacing,
            underline: part.marks.underline,
            // Fonts without a packaged bold weight get a fine outline instead.
            stroke: part.marks.bold && !fonts[style.font + "-bold.woff2"],
            fill: true,
            link: safeUrl(part.marks.href) || undefined,
          });
        xx += part.width;
      }
    }
    return false;
  }
  const pages = doc.pages.map((p, i) => effectivePage(p, doc, i));
  const visibleProductIds = new Set(
    pages.flatMap((p) =>
      p.blocks.filter((b) => b.type === "product").map((b) => b.id),
    ),
  );
  for (const [index, page] of pages.entries()) {
    pdf.addPage({ size: "A4", margin: 0 });
    pdf.addNamedDestination(page.id, "Fit");
    pdf.outline.addItem(page.title || `Page ${index + 1}`);
    pdf.save().scale(scale);
    const bg = page.background;
    let background = bg?.color || theme.paper;
    if (bg?.type === "gradient") {
      const angle = (bg.angle * Math.PI) / 180,
        dx = Math.sin(angle),
        dy = -Math.cos(angle),
        length = Math.abs(PAGE.width * dx) + Math.abs(PAGE.height * dy);
      background = pdf
        .linearGradient(
          PAGE.width / 2 - (dx * length) / 2,
          PAGE.height / 2 - (dy * length) / 2,
          PAGE.width / 2 + (dx * length) / 2,
          PAGE.height / 2 + (dy * length) / 2,
        )
        .stop(0, bg.color)
        .stop(1, bg.color2);
    }
    pdf.rect(0, 0, PAGE.width, PAGE.height).fill(background);
    if (bg?.type === "image")
      image(bg.assetId, 0, 0, PAGE.width, PAGE.height, bg.crop);
    if (bg?.overlayOpacity)
      pdf
        .save()
        .opacity(bg.overlayOpacity)
        .rect(0, 0, PAGE.width, PAGE.height)
        .fill(bg.overlayColor || "#000000")
        .restore();
    for (const b of page.blocks) {
      const { x, y, width: w, height: h } = rectangle(b.rect),
        a = b.appearance || {};
      let bad = false;
      pdf.addNamedDestination(b.id, "XYZ", x * scale, 841.89 - y * scale, null);
      pdf
        .save()
        .translate(x + w / 2, y + h / 2)
        .rotate(a.rotation || 0)
        .scale(a.flipX ? -1 : 1, a.flipY ? -1 : 1)
        .translate(-x - w / 2, -y - h / 2)
        .opacity(a.opacity ?? 1);
      if (a.fill && b.type !== "shape")
        pdf
          .roundedRect(x, y, w, h, Math.min(a.radius || 0, w / 2, h / 2))
          .fill(a.fill);
      pdf.save();
      clipFrame("rectangle", x, y, w, h, a.radius || 0);
      if (b.type === "text") bad = rich(b, x, y, w, h);
      if (b.type === "image") image(b.assetId, x, y, w, h, b.crop, a.frame);
      if (b.type === "divider")
        pdf
          .moveTo(x, y + 8)
          .lineTo(x + w, y + 8)
          .lineWidth(1)
          .stroke(theme.ink);
      if (b.type === "button") {
        const th = textHeight(b.text, "sans", 18, w - 16);
        bad = th > h - 16;
        if (!bad) {
          pdf.rect(x, y, w, h).fill(theme.ink);
          text(b.text, x + 8, y + (h - th) / 2, w - 16, "sans", 18, {
            align: "center",
            color: theme.paper,
          });
          pdf.link(x, y, w, h, safeUrl(b.url));
        }
      }
      if (b.type === "shape") {
        pdf
          .save()
          .translate(x, y)
          .scale(w / 100, h / 100)
          .lineWidth(a.borderWidth || (b.shape === "line" ? 1 : 0));
        if (b.shape === "ellipse") pdf.ellipse(50, 50, 48, 48);
        else if (b.shape === "rectangle")
          pdf.roundedRect(1, 1, 98, 98, Math.min(48, a.radius || 0));
        else if (b.shape === "line") pdf.moveTo(0, 50).lineTo(100, 50);
        else pdf.path(shapePath(b.shape));
        if (b.shape === "line") pdf.stroke(a.borderColor || theme.ink);
        else if (a.borderWidth)
          pdf.fillAndStroke(a.fill || theme.accent, a.borderColor || theme.ink);
        else pdf.fill(a.fill || theme.accent);
        pdf.restore();
      }
      if (b.type === "gallery")
        for (const im of galleryBoxes(b, w, h))
          image(
            im.assetId,
            x + im.x,
            y + im.y,
            im.width,
            im.height,
            undefined,
            a.frame,
          );
      if (b.type === "product") {
        const p = b.product,
          pr = b.presentation || {},
          fields = pr.fields || DEFAULT_PRODUCT_FIELDS,
          has = (f) => fields.includes(f),
          size = b.size;
        if (pr.background) pdf.rect(x, y, w, h).fill(pr.background);
        const rows = [
          ["name", p.name, theme.headingFont, size * 1.25, theme.ink, 1.15],
          ["summary", p.summary, theme.bodyFont, size * 0.85, theme.ink, 1.4],
          [
            "description",
            p.description,
            theme.bodyFont,
            size * 0.85,
            theme.ink,
            1.4,
          ],
          [
            "sku",
            p.sku ? "SKU: " + p.sku : "",
            theme.bodyFont,
            size * 0.85,
            theme.ink,
            1.4,
          ],
          ["category", p.category, theme.bodyFont, size * 0.85, theme.ink, 1.4],
          [
            "price",
            formatPrice(p),
            "sans-bold",
            pr.priceSize || size * 0.85,
            pr.priceColor || theme.ink,
            1.4,
          ],
          [
            "link",
            p.url ? "View product" : "",
            theme.bodyFont,
            size * 0.75,
            theme.accent,
            1.4,
          ],
        ]
          .filter(([key, value]) => has(key) && value)
          .map((r) => ({
            ...{
              key: r[0],
              value: r[1],
              font: r[2],
              size: r[3],
              color: r[4],
              lineHeight: r[5],
            },
            height: textHeight(r[1], r[2], r[3], w - 4, r[5]),
          }));
        const copyH = rows.reduce((n, r) => n + r.height + 5, 0) + 8,
          photoH = has("image") ? h - copyH - 8 : 0;
        bad = has("image") ? photoH < 40 : copyH > h;
        if (!bad) {
          if (has("image"))
            for (const tile of productImageBoxes(p.images, pr.imageLayout))
              image(
                tile.assetId,
                x + tile.x * w,
                y + tile.y * photoH,
                tile.width * w,
                tile.height * photoH,
                undefined,
                a.frame,
              );
          if (has("badge") && p.badge) {
            setFont("sans", 10);
            const bw = pdf.widthOfString(p.badge.toUpperCase()) + 16;
            pdf.rect(x + 10, y + 10, bw, 22).fill(pr.badgeColor || theme.paper);
            text(p.badge.toUpperCase(), x + 18, y + 15, bw - 16, "sans", 10, {
              color: pr.badgeTextColor || theme.ink,
            });
          }
          let yy = y + (photoH ? photoH + 12 : 8);
          for (const row of rows) {
            text(row.value, x + 2, yy, w - 4, row.font, row.size, {
              color: row.color,
              lineHeight: row.lineHeight,
              link: row.key === "link" ? safeUrl(p.url) : undefined,
            });
            yy += row.height + 5;
          }
        }
      }
      if (b.type === "icon") {
        const size = Math.min(w, h),
          k = size / 24;
        pdf
          .save()
          .translate(x + (w - size) / 2, y + (h - size) / 2)
          .scale(k)
          .lineWidth(b.strokeWidth)
          .lineCap("round")
          .lineJoin("round")
          .strokeColor(b.color || theme.accent);
        for (const d of ICONS[b.icon] || []) pdf.path(d).stroke();
        pdf.restore();
      }
      if (b.type === "hotspot") {
        if (b.showLabel)
          text(b.label, x, y, w, theme.bodyFont, 16, { align: "center" });
        if (b.action.kind === "url")
          pdf.link(x, y, w, h, safeUrl(b.action.url));
        if (b.action.kind === "page") pdf.goTo(x, y, w, h, b.action.pageId);
        if (b.action.kind === "product") {
          // Master product destinations are scoped to the current page.
          const target = visibleProductIds.has(b.action.blockId)
            ? b.action.blockId
            : `${page.id}:${b.action.blockId}`;
          if (visibleProductIds.has(target)) pdf.goTo(x, y, w, h, target);
        }
      }
      if (b.type === "media") {
        const caption = b.title + "\n" + b.description,
          th = textHeight(caption, theme.bodyFont, 14, w);
        bad = th + 40 > h;
        if (!bad) {
          image(b.posterId, x, y, w, h - th - 8);
          if (!b.posterId) pdf.rect(x, y, w, h - th - 8).fill("#e7e5df");
          text("Open " + b.mediaKind, x + 10, y + 12, w - 20, "sans", 16, {
            color: theme.ink,
            link: safeUrl(b.url),
          });
          text(caption, x, y + h - th, w, theme.bodyFont, 14);
          pdf.link(x, y, w, h, safeUrl(b.url));
        }
      }
      pdf.restore();
      if (a.borderWidth && b.type !== "shape")
        pdf
          .roundedRect(
            x + a.borderWidth / 2,
            y + a.borderWidth / 2,
            w - a.borderWidth,
            h - a.borderWidth,
            Math.min(a.radius || 0, w / 2, h / 2),
          )
          .lineWidth(a.borderWidth)
          .stroke(a.borderColor || theme.ink);
      pdf.restore();
      if (bad)
        findings.push({
          pageId: page.id,
          blockId: b.masterSourceId || b.id,
          message:
            "Content does not fit. Shorten the copy, reduce its size, or enlarge the block.",
        });
    }
    if (page.footer !== false) {
      text(doc.publisher, 45, 1095, 650, "sans", 9, { color: "#8f9385" });
      text(String(index + 1).padStart(2, "0"), 700, 1095, 49, "sans", 9, {
        align: "right",
        color: "#8f9385",
      });
    }
    pdf.restore();
  }
  if (pdf.bufferedPageRange().count !== doc.pages.length)
    findings.push({
      message:
        "Text overflow created an extra PDF page. Shorten the affected content.",
    });
  pdf.end();
  const bytes = await finished;
  if (findings.length) {
    const error = new Error("Some content does not fit on its page.");
    error.findings = findings;
    throw error;
  }
  if (bytes.length > 100 * 1024 ** 2)
    throw Error("PDF exceeds the 100 MB export limit.");
  return bytes;
}
