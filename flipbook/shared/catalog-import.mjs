import { emptyProduct, validateProduct } from "./document.mjs";
export const IMPORT_FIELDS = [
  "name",
  "summary",
  "description",
  "price",
  "currency",
  "sku",
  "category",
  "badge",
  "url",
  "image",
];
/** Bounded RFC-4180-style parser. Quotes/newlines remain data, never executable formulas. */
export function parseCsv(
  source,
  { maxRows = 201, maxColumns = 50, maxLength = 2 * 1024 * 1024 } = {},
) {
  if (typeof source !== "string" || source.length > maxLength)
    throw Error("CSV exceeds the 2 MiB limit.");
  const text = source.replace(/^\uFEFF/, ""),
    rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(field);
    field = "";
    closed = false;
    if (row.length > maxColumns) throw Error("CSV has too many columns.");
  };
  const line = () => {
    cell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    if (rows.length > maxRows)
      throw Error("Import at most 200 products at a time.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === ",") cell();
    else if (c === "\n" || c === "\r") {
      line();
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (c === '"') {
      if (field || closed)
        throw Error("A quoted CSV field must start with a quote.");
      quoted = true;
    } else if (closed) {
      if (!/[ \t]/.test(c))
        throw Error("Unexpected text after a closing quote.");
    } else field += c;
  }
  if (quoted) throw Error("CSV contains an unclosed quoted field.");
  if (field || row.length || closed) line();
  if (!rows.length) throw Error("The CSV file is empty.");
  const headers = rows.shift().map((s) => s.trim());
  if (
    headers.some((s) => !s) ||
    new Set(headers.map((s) => s.toLocaleLowerCase())).size !== headers.length
  )
    throw Error("CSV column names must be nonempty and unique.");
  const records = rows.map((cells, index) => ({
    row: index + 2,
    cells,
    errors:
      cells.length === headers.length
        ? []
        : ["The number of cells does not match the header."],
  }));
  return { headers, records };
}
export function suggestMapping(headers) {
  const aliases = {
    name: ["name", "product", "product name"],
    summary: ["summary", "short description"],
    description: ["description"],
    price: ["price"],
    currency: ["currency"],
    sku: ["sku", "code"],
    category: ["category"],
    badge: ["badge", "label"],
    url: ["url", "link", "product url"],
    image: ["image", "image id", "image filename"],
  };
  return Object.fromEntries(
    IMPORT_FIELDS.map((field) => [
      field,
      headers.findIndex((h) =>
        aliases[field].includes(h.toLocaleLowerCase().trim()),
      ),
    ]),
  );
}
export function previewImport(parsed, mapping, assets = []) {
  const assigned = Object.values(mapping).filter(
    (i) => Number.isInteger(i) && i >= 0,
  );
  if (new Set(assigned).size !== assigned.length)
    throw Error("Map each CSV column to only one product field.");
  if (
    Object.keys(mapping).some((k) => !IMPORT_FIELDS.includes(k)) ||
    Object.values(mapping).some(
      (i) => !Number.isInteger(i) || i < -1 || i >= parsed.headers.length,
    )
  )
    throw Error("Invalid CSV column mapping.");
  if (!Number.isInteger(mapping.name) || mapping.name < 0)
    throw Error("Map a product name column.");
  const byId = new Map(assets.map((a) => [a.id, a])),
    byName = new Map();
  for (const asset of assets) {
    const list = byName.get(asset.name) || [];
    list.push(asset);
    byName.set(asset.name, list);
  }
  const seenSku = new Set();
  return parsed.records.map((row) => {
    const product = emptyProduct(),
      errors = [...row.errors];
    for (const field of IMPORT_FIELDS) {
      const column = mapping[field];
      if (field !== "image" && column >= 0)
        product[field] = (row.cells[column] || "").trim();
    }
    if (!product.currency) product.currency = "USD";
    product.currency = product.currency.toUpperCase();
    const image =
      mapping.image >= 0 ? (row.cells[mapping.image] || "").trim() : "";
    if (image) {
      const candidates = byId.has(image)
        ? [byId.get(image)]
        : byName.get(image) || [];
      if (candidates.length === 1) product.images = [candidates[0].id];
      else
        errors.push(
          candidates.length
            ? "Image filename is ambiguous; use its asset ID."
            : "Upload the image first and map its filename or asset ID.",
        );
    }
    if (product.sku) {
      if (seenSku.has(product.sku))
        errors.push("SKU is duplicated within this import.");
      seenSku.add(product.sku);
    }
    errors.push(...validateProduct(product, true));
    return { row: row.row, product, errors };
  });
}
