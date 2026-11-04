import { randomUUID } from "node:crypto";
import { all, get, run, now } from "./db.mjs";
import {
  makeDocument,
  makePage,
  validateDocument,
  validateProduct,
} from "../shared/document.mjs";
import { upgradeDocument } from "../shared/editor-commands.mjs";

export function approvalState(publication) {
  const approval = get(
    "SELECT revision,approved_by,created_at FROM review_approvals WHERE publication_id=?",
    publication.id,
  );
  const unresolved = get(
    "SELECT count(*) AS n FROM review_comments WHERE publication_id=? AND resolved=0",
    publication.id,
  ).n;
  return {
    revision: publication.revision,
    required: Boolean(JSON.parse(publication.document).requireApproval),
    approved: Boolean(
      approval && approval.revision === publication.revision && !unresolved,
    ),
    approval: approval || null,
    unresolved,
  };
}
export function requireApproval(publication, fail) {
  const state = approvalState(publication);
  if (state.required && !state.approved)
    fail(
      409,
      "Resolve review notes and approve this saved revision before publishing.",
      { code: "REVIEW_REQUIRED" },
    );
}
export function resourceDocument(kind, content, fail) {
  if (!content || typeof content !== "object" || Array.isArray(content))
    fail(422, "Resource content is required.");
  const doc = upgradeDocument(makeDocument("Reusable design"));
  doc.pages = [makePage("blank")];
  if (kind === "page") {
    if (!content.page || typeof content.page !== "object")
      fail(422, "Choose a page to save.");
    doc.pages = [content.page];
    doc.masters = content.masters || [];
  } else if (kind === "group") {
    if (!Array.isArray(content.blocks) || !content.blocks.length)
      fail(422, "Choose elements to save.");
    doc.pages[0].blocks = content.blocks;
  } else if (kind !== "brand")
    fail(422, "Choose page, group or brand resource.");
  if (content.brand !== undefined) doc.brand = content.brand;
  if (content.styles !== undefined) doc.styles = content.styles;
  const findings = validateDocument(doc);
  if (findings.length)
    fail(422, "The reusable design has invalid content.", { findings });
  return doc;
}
export function registerEditorRoutes(
  app,
  { authenticate, owned, fail, checkAssets, jsonIdempotent, summary },
) {
  app.get("/api/publications/:id/history", authenticate, (req, res) => {
    const p = owned(req.params.id, req.user.id);
    res.json(
      all(
        "SELECT revision,reason,created_at FROM draft_revisions WHERE publication_id=? ORDER BY revision DESC LIMIT 100",
        p.id,
      ),
    );
  });
  app.get(
    "/api/publications/:id/history/:revision",
    authenticate,
    (req, res) => {
      const p = owned(req.params.id, req.user.id),
        row = get(
          "SELECT * FROM draft_revisions WHERE publication_id=? AND revision=?",
          p.id,
          Number(req.params.revision),
        );
      if (!row) fail(404, "Draft revision not found.");
      res.json({ ...row, document: JSON.parse(row.document) });
    },
  );
  app.post("/api/publications/:id/restore", authenticate, (req, res) =>
    res.json(
      jsonIdempotent(req, "restore:" + req.params.id, () => {
        const p = owned(req.params.id, req.user.id);
        if (p.state !== "active")
          fail(409, "Unarchive the publication before restoring.");
        if (p.revision !== req.body.revision)
          fail(409, "The draft changed. Reload history before restoring.", {
            code: "REVISION_CONFLICT",
            revision: p.revision,
          });
        if (
          !Number.isInteger(req.body.sourceRevision) ||
          req.body.sourceRevision < 1
        )
          fail(422, "Choose a valid draft revision.");
        const source = get(
          "SELECT * FROM draft_revisions WHERE publication_id=? AND revision=?",
          p.id,
          req.body.sourceRevision,
        );
        if (!source) fail(404, "Draft revision not found.");
        const document = JSON.parse(source.document),
          findings = validateDocument(document);
        if (findings.length)
          fail(422, "This revision needs repair before it can be restored.", {
            findings,
          });
        checkAssets(document, req.user.id);
        run(
          "UPDATE publications SET document=?,title=?,revision=revision+1,updated_at=? WHERE id=?",
          source.document,
          document.title,
          now(),
          p.id,
        );
        run(
          "UPDATE draft_revisions SET reason=? WHERE publication_id=? AND revision=?",
          "Restored revision " + source.revision,
          p.id,
          p.revision + 1,
        );
        return summary(owned(p.id, req.user.id));
      }),
    ),
  );
  app.get("/api/design-resources", authenticate, (req, res) =>
    res.json(
      all(
        "SELECT * FROM design_resources WHERE user_id=? ORDER BY updated_at DESC",
        req.user.id,
      ).map((r) => ({ ...r, content: JSON.parse(r.content) })),
    ),
  );
  function validateResource(req) {
    if (
      typeof req.body.name !== "string" ||
      !req.body.name.trim() ||
      req.body.name.length > 80
    )
      fail(422, "Use a resource name of 1–80 characters.");
    const doc = resourceDocument(req.body.kind, req.body.content, fail);
    checkAssets(doc, req.user.id);
  }
  app.post("/api/design-resources", authenticate, (req, res) =>
    res.status(201).json(
      jsonIdempotent(req, "resource-create", () => {
        validateResource(req);
        if (
          get(
            "SELECT count(*) AS n FROM design_resources WHERE user_id=?",
            req.user.id,
          ).n >= 200
        )
          fail(422, "Keep at most 200 reusable designs.");
        const id = randomUUID(),
          stamp = now();
        run(
          "INSERT INTO design_resources VALUES(?,?,?,?,?,?,?,?)",
          id,
          req.user.id,
          req.body.kind,
          req.body.name.trim(),
          JSON.stringify(req.body.content),
          1,
          stamp,
          stamp,
        );
        return {
          id,
          kind: req.body.kind,
          name: req.body.name.trim(),
          content: req.body.content,
          revision: 1,
        };
      }),
    ),
  );
  app.put("/api/design-resources/:resourceId", authenticate, (req, res) =>
    res.json(
      jsonIdempotent(req, "resource-update:" + req.params.resourceId, () => {
        const resource =
          get(
            "SELECT * FROM design_resources WHERE id=? AND user_id=?",
            req.params.resourceId,
            req.user.id,
          ) || fail(404, "Reusable design not found.");
        if (req.body.revision !== resource.revision)
          fail(409, "This reusable design changed. Reload it first.");
        validateResource(req);
        run(
          "UPDATE design_resources SET name=?,kind=?,content=?,revision=revision+1,updated_at=? WHERE id=?",
          req.body.name.trim(),
          req.body.kind,
          JSON.stringify(req.body.content),
          now(),
          resource.id,
        );
        return { id: resource.id, revision: resource.revision + 1 };
      }),
    ),
  );
  app.delete("/api/design-resources/:resourceId", authenticate, (req, res) => {
    const resource =
      get(
        "SELECT id FROM design_resources WHERE id=? AND user_id=?",
        req.params.resourceId,
        req.user.id,
      ) || fail(404, "Reusable design not found.");
    run("DELETE FROM design_resources WHERE id=?", resource.id);
    res.json({ ok: true });
  });
  app.get("/api/publications/:id/comments", authenticate, (req, res) => {
    const p = owned(req.params.id, req.user.id);
    res.json(
      all(
        "SELECT c.*,u.name AS author FROM review_comments c JOIN users u ON u.id=c.author_id WHERE publication_id=? ORDER BY created_at DESC",
        p.id,
      ),
    );
  });
  app.post("/api/publications/:id/comments", authenticate, (req, res) =>
    res.status(201).json(
      jsonIdempotent(req, "comment:" + req.params.id, () => {
        const p = owned(req.params.id, req.user.id),
          doc = JSON.parse(p.document),
          page = doc.pages.find((p) => p.id === req.body.pageId);
        if (!page) fail(422, "Choose an existing page for this comment.");
        if (
          req.body.blockId &&
          !page.blocks.some((b) => b.id === req.body.blockId) &&
          !(doc.masters || [])
            .find((m) => m.id === page.masterId)
            ?.blocks.some((b) => b.id === req.body.blockId)
        )
          fail(422, "The selected element is no longer on this page.");
        if (
          typeof req.body.text !== "string" ||
          !req.body.text.trim() ||
          req.body.text.length > 4000
        )
          fail(422, "Write a comment of 1–4000 characters.");
        const id = randomUUID(),
          stamp = now();
        run(
          "INSERT INTO review_comments VALUES(?,?,?,?,?,?,0,1,?,?)",
          id,
          p.id,
          page.id,
          req.body.blockId || null,
          req.user.id,
          req.body.text.trim(),
          stamp,
          stamp,
        );
        run("DELETE FROM review_approvals WHERE publication_id=?", p.id);
        return { id, revision: 1 };
      }),
    ),
  );
  app.patch(
    "/api/publications/:id/comments/:commentId",
    authenticate,
    (req, res) =>
      res.json(
        jsonIdempotent(req, "comment-update:" + req.params.commentId, () => {
          const p = owned(req.params.id, req.user.id),
            comment =
              get(
                "SELECT * FROM review_comments WHERE id=? AND publication_id=?",
                req.params.commentId,
                p.id,
              ) || fail(404, "Comment not found.");
          if (typeof req.body.resolved !== "boolean")
            fail(422, "Choose resolved or open.");
          if (req.body.revision !== comment.revision)
            fail(409, "This comment changed. Reload the review panel.");
          run(
            "UPDATE review_comments SET resolved=?,revision=revision+1,updated_at=? WHERE id=?",
            req.body.resolved ? 1 : 0,
            now(),
            comment.id,
          );
          if (!req.body.resolved)
            run("DELETE FROM review_approvals WHERE publication_id=?", p.id);
          return {
            id: comment.id,
            resolved: req.body.resolved,
            revision: comment.revision + 1,
          };
        }),
      ),
  );
  app.get("/api/publications/:id/approval", authenticate, (req, res) =>
    res.json(approvalState(owned(req.params.id, req.user.id))),
  );
  app.post("/api/publications/:id/approval", authenticate, (req, res) =>
    res.json(
      jsonIdempotent(req, "approve:" + req.params.id, () => {
        const p = owned(req.params.id, req.user.id);
        if (p.state !== "active") fail(409, "Unarchive before approving.");
        if (p.revision !== req.body.revision)
          fail(409, "Approve the current saved revision.", {
            code: "REVISION_CONFLICT",
            revision: p.revision,
          });
        if (approvalState(p).unresolved)
          fail(409, "Resolve open review notes before approving.");
        run(
          "INSERT INTO review_approvals VALUES(?,?,?,?) ON CONFLICT(publication_id) DO UPDATE SET revision=excluded.revision,approved_by=excluded.approved_by,created_at=excluded.created_at",
          p.id,
          p.revision,
          req.user.id,
          now(),
        );
        return approvalState(p);
      }),
    ),
  );
  app.post("/api/products/import", authenticate, (req, res) =>
    res.status(201).json(
      jsonIdempotent(req, "products-import", () => {
        const products = req.body.products;
        if (
          !Array.isArray(products) ||
          products.length < 1 ||
          products.length > 200
        )
          fail(422, "Import between 1 and 200 products.");
        const findings = [],
          skus = new Set();
        for (const [index, p] of products.entries()) {
          for (const message of validateProduct(p, true))
            findings.push({ row: index + 2, message });
          if (!p || typeof p !== "object") continue;
          if (p.sku) {
            if (skus.has(p.sku))
              findings.push({
                row: index + 2,
                message: "SKU is duplicated within this import.",
              });
            skus.add(p.sku);
          }
          for (const id of Array.isArray(p.images) ? p.images : [])
            if (
              !get(
                "SELECT id FROM assets WHERE id=? AND user_id=?",
                id,
                req.user.id,
              )
            )
              findings.push({
                row: index + 2,
                message: "Image is not available in this workspace.",
              });
        }
        if (findings.length)
          fail(422, "Fix the import rows before saving.", { findings });
        const rows = products.map((content) => {
          const id = randomUUID(),
            stamp = now();
          run(
            "INSERT INTO products VALUES(?,?,?,?,?,?)",
            id,
            req.user.id,
            JSON.stringify(content),
            1,
            stamp,
            stamp,
          );
          return { id, revision: 1, content };
        });
        return { count: rows.length, products: rows };
      }),
    ),
  );
}
