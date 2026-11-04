import { registerEditorRoutes, requireApproval } from "./editor-routes.mjs";
import { copyDocument } from "../shared/editor-commands.mjs";
import express from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import * as fontkit from "fontkit";
import { get, all, run, tx, now, dataDir, db } from "./db.mjs";
import {
  authenticate,
  checkOrigin,
  startSession,
  passwordHash,
  verifyPassword,
  digest,
  secret,
  rateLimit,
} from "./auth.mjs";
import { seedWorkspace } from "./seed.mjs";
import { enqueue, startWorker, fontPaths } from "./jobs.mjs";
import { readerHTML } from "./reader.mjs";
import { sharedBuildId } from "./build-id.mjs";
import {
  makeDocument,
  assetIds,
  fontIds,
  validateDocument,
  validateProduct,
  duplicatePage,
  THEMES,
} from "../shared/document.mjs";
const app = express();
// Shared code as loaded by this process; the editor compares it with its own.
const BUILD_ID = sharedBuildId();
app.disable("x-powered-by");
const keyPath = join(dataDir, ".secret");
if (!existsSync(keyPath)) writeFileSync(keyPath, secret(), { mode: 0o600 });
const appSecret = readFileSync(keyPath, "utf8");
const fail = (status, message, extra = {}) => {
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra);
  throw e;
};
const owned = (id, user) =>
  get(
    "SELECT * FROM publications WHERE id=? AND user_id=? AND state!='deleted'",
    id,
    user,
  ) || fail(404, "Publication not found.");
const live = (slug) =>
  get(
    "SELECT p.*,v.document AS published_document FROM publications p JOIN versions v ON v.id=p.live_version WHERE p.slug=? AND p.state='active' AND v.status='ready'",
    slug,
  ) || fail(404, "This publication is not available.");
const summary = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  revision: p.revision,
  state: p.state,
  liveVersion: p.live_version,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  document: JSON.parse(p.document),
});
function checkAssets(doc, user) {
  for (const id of assetIds(doc))
    if (!get("SELECT id FROM assets WHERE id=? AND user_id=?", id, user))
      fail(422, "An image is not available in this workspace.");
  for (const id of fontIds(doc))
    if (!get("SELECT id FROM fonts WHERE id=? AND user_id=?", id, user))
      fail(422, "A font is not available in this workspace.");
}
function jsonIdempotent(req, scope, operation) {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || key.length > 100 || key.length < 8)
    fail(400, "An idempotency key is required.");
  const hash = digest(JSON.stringify(req.body));
  return tx(() => {
    const prior = get(
      "SELECT * FROM idempotency WHERE user_id=? AND scope=? AND key=?",
      req.user.id,
      scope,
      key,
    );
    if (prior) {
      if (prior.hash !== hash)
        fail(409, "That request key was already used with different content.");
      return JSON.parse(prior.response);
    }
    const result = operation();
    run(
      "INSERT INTO idempotency VALUES(?,?,?,?,?,?)",
      req.user.id,
      scope,
      key,
      hash,
      JSON.stringify(result),
      Date.now(),
    );
    return result;
  });
}
function signEvent(pub) {
  const payload = Buffer.from(
    JSON.stringify({
      publicationId: pub.id,
      versionId: pub.live_version,
      sessionId: randomUUID(),
      expires: Date.now() + 2 * 3600e3,
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", appSecret).update(payload).digest("base64url")
  );
}
function eventData(token) {
  if (typeof token !== "string" || token.length > 2000)
    fail(400, "Invalid event token.");
  const [p, s] = token.split(".");
  const expected = createHmac("sha256", appSecret)
    .update(p || "")
    .digest("base64url");
  if (
    !s ||
    s.length !== expected.length ||
    !timingSafeEqual(Buffer.from(s), Buffer.from(expected))
  )
    fail(403, "Invalid event token.");
  let data;
  try {
    data = JSON.parse(Buffer.from(p, "base64url"));
  } catch {
    fail(400, "Invalid event token.");
  }
  if (data.expires < Date.now()) fail(403, "Event session expired.");
  return data;
}
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  if (req.path.startsWith("/api") || req.path.startsWith("/m/"))
    res.set("Cache-Control", "no-store");
  if (req.path.startsWith("/api")) res.set("X-Flipbook-Build", BUILD_ID);
  next();
});
app.use("/api", checkOrigin, express.json({ limit: "2mb" }));
app.get("/api/health", (_req, res) => {
  get("SELECT 1");
  res.json({ ok: true, storage: "sqlite", version: "1.0.0", build: BUILD_ID });
});
app.post("/api/auth/register", async (req, res) => {
  rateLimit("register:" + req.ip, 8, 3600e3);
  const { name, email, password } = req.body || {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 80 ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    fail(
      400,
      "Enter your name, a valid email, and a password of 10–128 characters.",
    );
  if (get("SELECT id FROM users WHERE email=?", email.toLowerCase()))
    fail(409, "An account already exists for this email.");
  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: email.toLowerCase(),
  };
  const hash = await passwordHash(password);
  run(
    "INSERT INTO users VALUES(?,?,?,?,?)",
    user.id,
    user.email,
    user.name,
    hash,
    now(),
  );
  try {
    await seedWorkspace(user);
  } catch (e) {
    console.error("Demo seed failed: " + e.message);
  }
  const csrf = startSession(res, user.id);
  res.status(201).json({ user, csrf });
});
app.post("/api/auth/login", async (req, res) => {
  rateLimit("login:" + req.ip, 20, 600e3);
  const { email, password } = req.body || {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length > 128
  )
    fail(400, "Enter an email and password.");
  const user = get("SELECT * FROM users WHERE email=?", email.toLowerCase());
  if (!user || !(await verifyPassword(password, user.password)))
    fail(401, "Email or password is incorrect.");
  const csrf = startSession(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email }, csrf });
});
app.get("/api/session", authenticate, (req, res) =>
  res.json({ user: req.user, csrf: req.session.csrf }),
);
app.post("/api/auth/logout", authenticate, (req, res) => {
  run("DELETE FROM sessions WHERE token=?", req.session.token);
  res.clearCookie("flipbook_session", { path: "/" }).json({ ok: true });
});
app.get("/api/publications", authenticate, (req, res) =>
  res.json(
    all(
      "SELECT * FROM publications WHERE user_id=? AND state!='deleted' ORDER BY updated_at DESC",
      req.user.id,
    ).map(summary),
  ),
);
app.post("/api/publications", authenticate, (req, res) => {
  res.status(201).json(
    jsonIdempotent(req, "create", () => {
      if (req.body.theme && !Object.hasOwn(THEMES, req.body.theme))
        fail(422, "Choose a supported theme.");
      const title = String(req.body.title || "Untitled magazine").slice(0, 160),
        doc = makeDocument(title, req.body.theme || "editorial");
      doc.publisher = req.user.name;
      const id = randomUUID();
      run(
        "INSERT INTO publications(id,user_id,slug,title,document,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        id,
        req.user.id,
        "edition-" + randomUUID().slice(0, 12),
        title,
        JSON.stringify(doc),
        now(),
        now(),
      );
      return summary(owned(id, req.user.id));
    }),
  );
});
app.get("/api/publications/:id", authenticate, (req, res) => {
  const p = owned(req.params.id, req.user.id);
  res.json({
    ...summary(p),
    jobs: all(
      "SELECT id,kind,status,stage,error,version_id FROM jobs WHERE publication_id=? ORDER BY created_at DESC LIMIT 8",
      p.id,
    ),
  });
});
app.put("/api/publications/:id/draft", authenticate, (req, res) => {
  const { document, revision } = req.body;
  const findings = validateDocument(document);
  if (findings.length)
    fail(422, "Please resolve these document issues.", { findings });
  checkAssets(document, req.user.id);
  res.json(
    jsonIdempotent(req, "save:" + req.params.id, () => {
      const p = owned(req.params.id, req.user.id);
      if (p.state !== "active")
        fail(409, "Unarchive the publication before editing.");
      if (p.revision !== revision)
        fail(
          409,
          "This publication changed in another tab. Save your local copy or reload.",
          { code: "REVISION_CONFLICT", revision: p.revision },
        );
      run(
        "UPDATE publications SET document=?,title=?,revision=revision+1,updated_at=? WHERE id=?",
        JSON.stringify(document),
        document.title,
        now(),
        p.id,
      );
      return { revision: p.revision + 1, savedAt: now() };
    }),
  );
});
app.post("/api/publications/:id/duplicate", authenticate, (req, res) =>
  res.status(201).json(
    jsonIdempotent(req, "duplicate:" + req.params.id, () => {
      const p = owned(req.params.id, req.user.id),
        doc = req.body.document || JSON.parse(p.document);
      const errors = validateDocument(doc);
      if (errors.length)
        fail(422, "Invalid recovery document.", { findings: errors });
      checkAssets(doc, req.user.id);
      doc.title = (doc.title + " — copy").slice(0, 160);
      Object.assign(doc, copyDocument(doc));
      const id = randomUUID();
      run(
        "INSERT INTO publications(id,user_id,slug,title,document,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        id,
        req.user.id,
        "edition-" + randomUUID().slice(0, 12),
        doc.title,
        JSON.stringify(doc),
        now(),
        now(),
      );
      return summary(owned(id, req.user.id));
    }),
  ),
);
registerEditorRoutes(app, {
  authenticate,
  owned,
  fail,
  checkAssets,
  jsonIdempotent,
  summary,
});
app.post("/api/publications/:id/publish", authenticate, (req, res) =>
  res.status(202).json(
    jsonIdempotent(req, "publish:" + req.params.id, () => {
      const p = owned(req.params.id, req.user.id);
      if (p.state !== "active") fail(409, "Unarchive before publishing.");
      if (p.revision !== req.body.revision)
        fail(409, "Save the latest changes before publishing.");
      requireApproval(p, fail);
      const doc = JSON.parse(p.document),
        findings = validateDocument(doc, true);
      if (findings.length)
        fail(422, "Complete the publication checklist.", { findings });
      checkAssets(doc, req.user.id);
      const active = get(
        "SELECT count(*) AS n FROM jobs WHERE user_id=? AND status IN ('queued','running')",
        req.user.id,
      );
      if (active.n >= 10)
        fail(429, "Please wait for queued publications and exports to finish.");
      const id = randomUUID();
      run("UPDATE publications SET generation=generation+1 WHERE id=?", p.id);
      run(
        "INSERT INTO versions VALUES(?,?,?,?,?,?,?)",
        id,
        p.id,
        p.document,
        p.revision,
        p.generation + 1,
        "building",
        now(),
      );
      return enqueue(req.user.id, p.id, id, "publish");
    }),
  ),
);
app.post("/api/publications/:id/:action", authenticate, (req, res, next) => {
  const { action } = req.params;
  if (!["unpublish", "archive", "unarchive", "delete"].includes(action))
    return next();
  res.json(
    jsonIdempotent(req, action + ":" + req.params.id, () => {
      const p = owned(req.params.id, req.user.id),
        state =
          action === "archive"
            ? "archived"
            : action === "delete"
              ? "deleted"
              : "active";
      run(
        "UPDATE publications SET state=?,live_version=NULL,generation=generation+1,updated_at=? WHERE id=?",
        state,
        now(),
        p.id,
      );
      return { ok: true };
    }),
  );
});
app.post("/api/publications/:id/export", authenticate, (req, res) => {
  const p = owned(req.params.id, req.user.id);
  if (!p.live_version) fail(409, "Publish this magazine before exporting it.");
  res.json(tx(() => enqueue(req.user.id, p.id, p.live_version, "pdf")));
});
app.get("/api/jobs/:id", authenticate, (req, res) => {
  const job =
    get(
      "SELECT * FROM jobs WHERE id=? AND user_id=?",
      req.params.id,
      req.user.id,
    ) || fail(404, "Job not found.");
  res.json({
    ...job,
    path: undefined,
    error: job.error ? JSON.parse(job.error) : null,
  });
});
app.post("/api/jobs/:id/retry", authenticate, (req, res) => {
  const job =
    get(
      "SELECT * FROM jobs WHERE id=? AND user_id=?",
      req.params.id,
      req.user.id,
    ) || fail(404, "Job not found.");
  if (job.status !== "failed") fail(409, "Only a failed job can be retried.");
  const p = owned(job.publication_id, req.user.id),
    v = get("SELECT * FROM versions WHERE id=?", job.version_id);
  if (
    p.state !== "active" ||
    (job.kind === "publish" && p.generation !== v.generation)
  )
    fail(409, "Publish the current draft to create a new version.");
  run(
    "UPDATE jobs SET status='queued',stage='Queued',attempts=0,error=NULL,run_at=0,updated_at=? WHERE id=?",
    now(),
    job.id,
  );
  if (job.kind === "publish")
    run("UPDATE versions SET status='building' WHERE id=?", v.id);
  res.json({ ok: true });
});
app.get("/api/jobs/:id/download", authenticate, (req, res) => {
  const job =
    get(
      "SELECT * FROM jobs WHERE id=? AND user_id=? AND kind='pdf' AND status='succeeded'",
      req.params.id,
      req.user.id,
    ) || fail(404, "The PDF is not ready.");
  const p = owned(job.publication_id, req.user.id);
  res.download(
    job.path,
    p.title.replace(/[^a-z0-9 _-]/gi, "").slice(0, 100) + ".pdf",
  );
});
app.get("/api/products", authenticate, (req, res) =>
  res.json(
    all(
      "SELECT * FROM products WHERE user_id=? ORDER BY updated_at DESC",
      req.user.id,
    ).map((p) => ({ ...p, content: JSON.parse(p.content) })),
  ),
);
app.post("/api/products", authenticate, (req, res) => {
  const findings = validateProduct(req.body.content, true);
  if (findings.length) fail(422, findings.join(" "));
  for (const id of req.body.content.images)
    if (!get("SELECT id FROM assets WHERE id=? AND user_id=?", id, req.user.id))
      fail(422, "Invalid product image.");
  const id = randomUUID();
  run(
    "INSERT INTO products VALUES(?,?,?,?,?,?)",
    id,
    req.user.id,
    JSON.stringify(req.body.content),
    1,
    now(),
    now(),
  );
  res.status(201).json({ id, revision: 1, content: req.body.content });
});
app.put("/api/products/:id", authenticate, (req, res) => {
  const p =
    get(
      "SELECT * FROM products WHERE id=? AND user_id=?",
      req.params.id,
      req.user.id,
    ) || fail(404, "Product not found.");
  if (p.revision !== req.body.revision)
    fail(409, "Product changed. Reload it before editing.");
  const findings = validateProduct(req.body.content, true);
  if (findings.length) fail(422, findings.join(" "));
  for (const id of req.body.content.images)
    if (!get("SELECT id FROM assets WHERE id=? AND user_id=?", id, req.user.id))
      fail(422, "Invalid image.");
  run(
    "UPDATE products SET content=?,revision=revision+1,updated_at=? WHERE id=?",
    JSON.stringify(req.body.content),
    now(),
    p.id,
  );
  res.json({ id: p.id, revision: p.revision + 1, content: req.body.content });
});
app.delete("/api/products/:id", authenticate, (req, res) => {
  run(
    "DELETE FROM products WHERE id=? AND user_id=?",
    req.params.id,
    req.user.id,
  );
  res.json({ ok: true });
});
app.get("/api/assets", authenticate, (req, res) =>
  res.json(
    all(
      "SELECT id,name,width,height,bytes,created_at FROM assets WHERE user_id=? ORDER BY created_at DESC",
      req.user.id,
    ),
  ),
);
app.post(
  "/api/assets",
  authenticate,
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "20mb",
  }),
  async (req, res) => {
    rateLimit("upload:" + req.user.id, 30, 60000);
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      fail(400, "Upload a JPEG, PNG, or WebP image.");
    const usage = get(
      "SELECT coalesce(sum(bytes),0) AS bytes FROM assets WHERE user_id=?",
      req.user.id,
    );
    if (usage.bytes + req.body.length > 1024 ** 3)
      fail(413, "This local workspace has reached its 1 GiB media limit.");
    const processor = sharp(req.body, {
      limitInputPixels: 40000000,
      animated: false,
    });
    let metadata;
    try {
      metadata = await processor.metadata();
    } catch {
      fail(400, "This file could not be decoded as an image.");
    }
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      metadata.pages > 1 ||
      metadata.width > 12000 ||
      metadata.height > 12000
    )
      fail(400, "Use a static JPEG, PNG, or WebP within 40 megapixels.");
    const id = randomUUID(),
      original = join(dataDir, "assets", id + ".original"),
      file = join(dataDir, "assets", id + ".webp");
    let processed;
    try {
      processed = await processor
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      fail(400, "This image is damaged or unsupported.");
    }
    const { data, info } = processed;
    const currentUsage = get(
      "SELECT coalesce(sum(bytes),0) AS bytes FROM assets WHERE user_id=?",
      req.user.id,
    );
    if (currentUsage.bytes + req.body.length + data.length > 1024 ** 3)
      fail(413, "This local workspace has reached its 1 GiB media limit.");
    await writeFile(original, req.body, { mode: 0o600 });
    await writeFile(file, data, { mode: 0o600 });
    const name = String(req.headers["x-file-name"] || "Image").slice(0, 200);
    run(
      "INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?,?)",
      id,
      req.user.id,
      name,
      file,
      original,
      "image/webp",
      info.width,
      info.height,
      req.body.length + data.length,
      now(),
    );
    res.status(201).json({ id, name, width: info.width, height: info.height });
  },
);
app.get("/api/assets/:id", authenticate, (req, res) => {
  const a =
    get(
      "SELECT * FROM assets WHERE id=? AND user_id=?",
      req.params.id,
      req.user.id,
    ) || fail(404, "Image not found.");
  res.type(a.mime).sendFile(a.path);
});
const FONT_TYPES = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff" };
// Sniff the container, parse it with fontkit (the PDF engine's parser) and
// refuse fonts whose OS/2 licence bits forbid embedding in a PDF.
function inspectFont(bytes) {
  const tag = bytes.subarray(0, 4).toString("latin1");
  if (tag === "wOF2")
    fail(
      400,
      "WOFF2 cannot be embedded in PDFs. Upload a TTF, OTF or WOFF file.",
    );
  const format =
    tag === "wOFF"
      ? "woff"
      : tag === "OTTO"
        ? "otf"
        : tag === "\0\x01\0\0" || tag === "true"
          ? "ttf"
          : null;
  if (!format) fail(400, "Upload a TTF, OTF or WOFF font file.");
  let font;
  try {
    font = fontkit.create(bytes);
  } catch {
    fail(400, "This font file is damaged or unsupported.");
  }
  if (!font || font.fonts || !(font.numGlyphs > 0) || !font.familyName)
    fail(400, "This font file is damaged or unsupported.");
  // fontkit decodes OS/2 fsType into flags; noEmbedding is the 0x0002
  // "restricted licence" bit and bitmapOnly is 0x0200.
  const fsType = font["OS/2"]?.fsType || {};
  if (fsType.noEmbedding || fsType.bitmapOnly)
    fail(400, "This font's licence does not allow embedding in documents.");
  return {
    format,
    family: String(font.familyName).slice(0, 120),
    subfamily: String(font.subfamilyName || "Regular").slice(0, 60),
  };
}
const fontRow = (f) => ({
  id: f.id,
  value: "custom:" + f.id,
  family: f.family,
  name: f.name,
  format: f.format,
  bytes: f.bytes,
  createdAt: f.created_at,
});
app.get("/api/fonts", authenticate, (req, res) =>
  res.json(
    all(
      "SELECT * FROM fonts WHERE user_id=? ORDER BY created_at DESC",
      req.user.id,
    ).map(fontRow),
  ),
);
app.post(
  "/api/fonts",
  authenticate,
  express.raw({ type: () => true, limit: "5mb" }),
  async (req, res) => {
    rateLimit("upload:" + req.user.id, 30, 60000);
    if (!Buffer.isBuffer(req.body) || req.body.length < 12)
      fail(400, "Upload a TTF, OTF or WOFF font file.");
    if (
      get("SELECT count(*) AS n FROM fonts WHERE user_id=?", req.user.id).n >=
      30
    )
      fail(413, "This workspace already has 30 uploaded fonts.");
    const info = inspectFont(req.body),
      id = randomUUID(),
      file = join(dataDir, "fonts", id + "." + info.format);
    let name = "Font";
    try {
      name = decodeURIComponent(String(req.headers["x-file-name"] || "Font"));
    } catch {}
    await writeFile(file, req.body, { mode: 0o600 });
    const family =
      info.subfamily && !/^regular$/i.test(info.subfamily)
        ? `${info.family} ${info.subfamily}`
        : info.family;
    run(
      "INSERT INTO fonts VALUES(?,?,?,?,?,?,?,?)",
      id,
      req.user.id,
      family,
      name.slice(0, 200),
      file,
      info.format,
      req.body.length,
      now(),
    );
    res.status(201).json(fontRow(get("SELECT * FROM fonts WHERE id=?", id)));
  },
);
const sendFont = (res, f) => res.type(FONT_TYPES[f.format]).sendFile(f.path);
app.get("/api/fonts/:id/file", authenticate, (req, res) =>
  sendFont(
    res,
    get(
      "SELECT * FROM fonts WHERE id=? AND user_id=?",
      req.params.id,
      req.user.id,
    ) || fail(404, "Font not found."),
  ),
);
app.get("/api/publications/:id/analytics", authenticate, (req, res) => {
  const p = owned(req.params.id, req.user.id);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "")
    ? req.query.from
    : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || "")
    ? req.query.to
    : new Date().toISOString().slice(0, 10);
  const events = all(
      "SELECT * FROM events WHERE publication_id=? AND created_at>=? AND created_at<?",
      p.id,
      from,
      to + "T23:59:59.999Z",
    ),
    sessions = new Map(),
    clicks = [];
  for (const e of events) {
    if (!sessions.has(e.session_id))
      sessions.set(e.session_id, {
        view: false,
        pages: new Set(),
        active: 0,
        clicked: false,
      });
    const s = sessions.get(e.session_id);
    if (e.type === "view") s.view = true;
    if (e.type === "page") s.pages.add(e.page_id);
    if (e.type === "click") {
      s.clicked = true;
      clicks.push(e);
    }
    if (e.type === "engagement") s.active += e.active_ms;
  }
  const list = [...sessions.values()].filter((s) => s.view);
  const daily = {};
  for (const e of events)
    if (e.type === "view")
      daily[e.created_at.slice(0, 10)] =
        (daily[e.created_at.slice(0, 10)] || 0) + 1;
  res.json({
    views: list.length,
    clicks: clicks.length,
    averageDepth: list.length
      ? list.reduce((n, s) => n + s.pages.size, 0) / list.length
      : 0,
    averageSeconds: list.length
      ? list.reduce((n, s) => n + s.active, 0) / list.length / 1000
      : 0,
    clickRate: list.length
      ? list.filter((s) => s.clicked).length / list.length
      : 0,
    daily,
    from,
    to,
    updatedAt: now(),
  });
});
app.get("/m/:slug", (req, res) => {
  const p = live(req.params.slug),
    v = get("SELECT * FROM versions WHERE id=?", p.live_version);
  res.type("html").send(readerHTML(p, v, signEvent(p)));
});
app.get("/api/reader/:slug/status", (req, res) => {
  const p = live(req.params.slug);
  res.json({ versionId: p.live_version });
});
app.get("/api/reader/:slug/assets/:id", (req, res) => {
  const p = live(req.params.slug);
  if (req.query.version !== p.live_version)
    fail(409, "An updated edition is available.");
  const doc = JSON.parse(p.published_document);
  if (!assetIds(doc).includes(req.params.id)) fail(404, "Image not found.");
  const a =
    get(
      "SELECT * FROM assets WHERE id=? AND user_id=?",
      req.params.id,
      p.user_id,
    ) || fail(404, "Image not found.");
  res.type(a.mime).sendFile(a.path);
});
app.get("/api/reader/:slug/fonts/:id", (req, res) => {
  const p = live(req.params.slug);
  if (req.query.version !== p.live_version)
    fail(409, "An updated edition is available.");
  if (!fontIds(JSON.parse(p.published_document)).includes(req.params.id))
    fail(404, "Font not found.");
  sendFont(
    res,
    get(
      "SELECT * FROM fonts WHERE id=? AND user_id=?",
      req.params.id,
      p.user_id,
    ) || fail(404, "Font not found."),
  );
});
app.get("/api/reader/:slug/pdf", (req, res) => {
  const p = live(req.params.slug),
    job = get(
      "SELECT * FROM jobs WHERE version_id=? AND kind='pdf'",
      p.live_version,
    );
  if (!job || !["succeeded", "failed"].includes(job.status))
    return res
      .status(202)
      .set("Retry-After", "3")
      .json({ message: "Your PDF is being prepared." });
  if (job.status === "failed")
    fail(
      503,
      "The PDF could not be prepared. The publisher can retry the export.",
    );
  res.download(
    job.path,
    p.title.replace(/[^a-z0-9 _-]/gi, "").slice(0, 100) + ".pdf",
  );
});
app.post("/api/reader/events", (req, res) => {
  const data = eventData(req.body.token);
  rateLimit("events:" + data.sessionId, 100, 60000);
  const e = req.body.event;
  if (
    !e ||
    !["view", "page", "click", "engagement"].includes(e.type) ||
    typeof e.id !== "string" ||
    e.id.length > 100
  )
    fail(400, "Invalid event.");
  const v =
    get(
      "SELECT * FROM versions WHERE id=? AND publication_id=?",
      data.versionId,
      data.publicationId,
    ) || fail(404, "Publication not found.");
  const d = JSON.parse(v.document);
  if (e.pageId && !d.pages.some((p) => p.id === e.pageId))
    fail(400, "Invalid page.");
  if (
    e.blockId &&
    !d.pages.some((p) => p.blocks.some((b) => b.id === e.blockId))
  )
    fail(400, "Invalid product.");
  if (
    e.type === "view" &&
    get(
      "SELECT id FROM events WHERE session_id=? AND type='view'",
      data.sessionId,
    )
  )
    return res.status(202).json({ ok: true });
  const active = Math.min(10000, Math.max(0, Number(e.activeMs) || 0));
  run(
    "INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?,?)",
    e.id,
    data.publicationId,
    data.versionId,
    data.sessionId,
    e.type,
    e.pageId || null,
    e.blockId || null,
    active,
    now(),
  );
  res.status(202).json({ ok: true });
});
app.post("/api/reader/:slug/reports", (req, res) => {
  rateLimit("report:" + req.ip, 5, 3600e3);
  const p = live(req.params.slug);
  if (
    typeof req.body.reason !== "string" ||
    req.body.reason.length < 3 ||
    req.body.reason.length > 2000
  )
    fail(400, "Please describe the issue in 3–2,000 characters.");
  run(
    "INSERT INTO reports VALUES(?,?,?,?)",
    randomUUID(),
    p.id,
    req.body.reason,
    now(),
  );
  res.status(202).json({ ok: true });
});
for (const [name, path] of Object.entries(fontPaths))
  app.get("/fonts/" + name, (_req, res) =>
    res.set("Cache-Control", "public,max-age=86400").sendFile(path),
  );
app.get("/reader.js", (_req, res) =>
  res.sendFile(resolve("dist/reader/reader.js")),
);
app.use("/reader", express.static(resolve("dist/reader")));
app.use(express.static(resolve("public")));
app.use(express.static(resolve("dist")));
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.get("/{*path}", (_req, res) => {
  if (existsSync(resolve("dist/index.html")))
    res.sendFile(resolve("dist/index.html"));
  else
    res
      .status(503)
      .send("Build the web app with npm run build, or use npm run dev.");
});
app.use((e, req, res, _next) => {
  const status = e.status || 500;
  if (status >= 500)
    console.error(
      JSON.stringify({
        event: "request_error",
        path: req.path,
        message: e.message,
      }),
    );
  res.status(status).json({
    error:
      status >= 500 ? "Something went wrong. Please try again." : e.message,
    code: e.code,
    findings: e.findings,
    revision: e.revision,
  });
});
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Flipbook: http://localhost:" + (process.env.PORT || 3000)),
);
const stopWorker = startWorker();
const cleanup = setInterval(() => {
  run("DELETE FROM sessions WHERE expires_at<?", Date.now());
  run("DELETE FROM idempotency WHERE created_at<?", Date.now() - 7 * 864e5);
  run(
    "DELETE FROM events WHERE created_at<?",
    new Date(Date.now() - 30 * 864e5).toISOString(),
  );
}, 3600e3);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopWorker();
    clearInterval(cleanup);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  });
