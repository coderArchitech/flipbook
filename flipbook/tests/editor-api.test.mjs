import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startTestServer } from "./server-fixture.mjs";
import { upgradeDocument } from "../shared/editor-commands.mjs";

test(
  "advanced editor persistence and access contracts",
  { timeout: 120000 },
  async (t) => {
    const server = await startTestServer();
    t.after(server.stop);
    async function account(email) {
      const r = await fetch(server.url + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: "Editor tests",
          password: "editor-tests-only-2026",
        }),
      });
      assert.equal(r.status, 201);
      return {
        cookie: r.headers.get("set-cookie").split(";")[0],
        csrf: (await r.json()).csrf,
      };
    }
    const owner = await account("editor@example.test"),
      other = await account("other-editor@example.test");
    const call = (
      path,
      {
        method = "GET",
        body,
        who = owner,
        key = randomUUID(),
        csrf = who.csrf,
      } = {},
    ) =>
      fetch(server.url + path, {
        method,
        headers: {
          Cookie: who.cookie,
          "X-CSRF-Token": csrf,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const read = async (path, options) => {
      const r = await call(path, options);
      assert.ok(r.ok, await r.clone().text());
      return r.json();
    };
    const seed = (await read("/api/publications"))[0];
    const duplicate = () =>
      read("/api/publications/" + seed.id + "/duplicate", {
        method: "POST",
        body: {},
      });
    await t.test(
      "draft history retains the previous draft and restore creates an idempotent new revision",
      async () => {
        let p = await duplicate();
        const original = p.document,
          base = "/api/publications/" + p.id;
        assert.equal((await read(base + "/history")).length, 1);
        const changed = {
          ...upgradeDocument(original),
          title: "Updated title",
        };
        const saved = await read(base + "/draft", {
          method: "PUT",
          body: { revision: p.revision, document: changed },
        });
        assert.equal(
          (await read(base + "/history/" + p.revision)).document.title,
          original.title,
        );
        const key = randomUUID(),
          body = { sourceRevision: p.revision, revision: saved.revision };
        const restored = await read(base + "/restore", {
          method: "POST",
          key,
          body,
        });
        assert.equal(restored.revision, saved.revision + 1);
        assert.equal(restored.document.title, original.title);
        assert.deepEqual(
          await read(base + "/restore", { method: "POST", key, body }),
          restored,
        );
        assert.equal(
          (await read(base + "/history/" + saved.revision)).document.title,
          "Updated title",
        );
        assert.equal(
          (await call(base + "/restore", { method: "POST", body })).status,
          409,
        );
        assert.equal(
          (await call(base + "/history", { who: other })).status,
          404,
        );
        assert.equal(
          (
            await call(base + "/restore", {
              method: "POST",
              who: other,
              body: { sourceRevision: 1, revision: 1 },
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "draft history retains only the latest 100 snapshots without truncating the current document",
      async () => {
        const p = await duplicate(),
          base = "/api/publications/" + p.id;
        let revision = p.revision;
        for (let i = 0; i < 102; i++)
          revision = (
            await read(base + "/draft", {
              method: "PUT",
              body: {
                revision,
                document: { ...p.document, title: "History " + i },
              },
            })
          ).revision;
        const history = await read(base + "/history");
        assert.equal(history.length, 100);
        assert.equal(history[0].revision, revision);
        assert.equal((await call(base + "/history/1")).status, 404);
        assert.equal((await read(base)).document.title, "History 101");
      },
    );
    await t.test(
      "reusable designs are owner-scoped, revision checked and validate all asset references",
      async () => {
        const d = upgradeDocument(seed.document),
          content = { page: d.pages[0], styles: d.styles, brand: d.brand };
        const resource = await read("/api/design-resources", {
          method: "POST",
          body: { kind: "page", name: "Saved cover", content },
        });
        assert.equal((await read("/api/design-resources")).length, 1);
        assert.equal(
          (await read("/api/design-resources", { who: other })).length,
          0,
        );
        assert.equal(
          (
            await call("/api/design-resources/" + resource.id, {
              method: "PUT",
              who: other,
              body: { kind: "page", name: "Stolen", content, revision: 1 },
            })
          ).status,
          404,
        );
        await read("/api/design-resources/" + resource.id, {
          method: "PUT",
          body: { kind: "page", name: "Updated cover", content, revision: 1 },
        });
        assert.equal(
          (
            await call("/api/design-resources/" + resource.id, {
              method: "PUT",
              body: { kind: "page", name: "Stale", content, revision: 1 },
            })
          ).status,
          409,
        );
        const bad = structuredClone(content);
        bad.page.background = {
          type: "image",
          assetId: (await read("/api/assets", { who: other }))[0].id,
        };
        assert.equal(
          (
            await call("/api/design-resources", {
              method: "POST",
              body: { kind: "page", name: "Invalid owner", content: bad },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await call("/api/design-resources/" + resource.id, {
              method: "DELETE",
              who: other,
            })
          ).status,
          404,
        );
        await read("/api/design-resources/" + resource.id, {
          method: "DELETE",
        });
        assert.equal((await read("/api/design-resources")).length, 0);
      },
    );
    await t.test(
      "comments resolve/reopen and approval is exact-revision and required before publishing",
      async () => {
        let p = await duplicate();
        const base = "/api/publications/" + p.id,
          document = { ...upgradeDocument(p.document), requireApproval: true };
        p.revision = (
          await read(base + "/draft", {
            method: "PUT",
            body: { revision: p.revision, document },
          })
        ).revision;
        assert.equal(
          (
            await call(base + "/publish", {
              method: "POST",
              body: { revision: p.revision },
            })
          ).status,
          409,
        );
        const note = await read(base + "/comments", {
          method: "POST",
          body: {
            pageId: document.pages[0].id,
            blockId: document.pages[0].blocks[0].id,
            text: "Check this heading",
          },
        });
        assert.equal(
          (
            await call(base + "/approval", {
              method: "POST",
              body: { revision: p.revision },
            })
          ).status,
          409,
        );
        assert.equal(
          (await call(base + "/comments", { who: other })).status,
          404,
        );
        assert.equal(
          (
            await call(base + "/comments/" + note.id, {
              method: "PATCH",
              who: other,
              body: { resolved: true, revision: 1 },
            })
          ).status,
          404,
        );
        await read(base + "/comments/" + note.id, {
          method: "PATCH",
          body: { resolved: true, revision: 1 },
        });
        assert.equal(
          (
            await call(base + "/comments/" + note.id, {
              method: "PATCH",
              body: { resolved: false, revision: 1 },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await read(base + "/approval", {
              method: "POST",
              body: { revision: p.revision },
            })
          ).approved,
          true,
        );
        assert.equal(
          (
            await call(base + "/publish", {
              method: "POST",
              body: { revision: p.revision },
            })
          ).status,
          202,
        );
        p.revision = (
          await read(base + "/draft", {
            method: "PUT",
            body: {
              revision: p.revision,
              document: { ...document, title: "Changed after approval" },
            },
          })
        ).revision;
        assert.equal((await read(base + "/approval")).approved, false);
        assert.equal(
          (
            await call(base + "/publish", {
              method: "POST",
              body: { revision: p.revision },
            })
          ).status,
          409,
        );
        await read(base + "/approval", {
          method: "POST",
          body: { revision: p.revision },
        });
        await read(base + "/comments/" + note.id, {
          method: "PATCH",
          body: { resolved: false, revision: 2 },
        });
        assert.equal((await read(base + "/approval")).approved, false);
      },
    );
    await t.test(
      "bulk product import is atomic, replay-safe and rejects cross-owner images",
      async () => {
        const products = await read("/api/products"),
          first = structuredClone(products[0].content),
          before = products.length;
        first.name = "Imported chair";
        first.sku = "IMPORT-001";
        const bad = { ...first, sku: "IMPORT-002", images: ["not-owned"] };
        const failed = await call("/api/products/import", {
          method: "POST",
          body: { products: [first, bad] },
        });
        assert.equal(failed.status, 422);
        assert.equal((await read("/api/products")).length, before);
        const key = randomUUID(),
          body = { products: [first] };
        const imported = await read("/api/products/import", {
          method: "POST",
          key,
          body,
        });
        assert.equal(imported.count, 1);
        assert.deepEqual(
          await read("/api/products/import", { method: "POST", key, body }),
          imported,
        );
        assert.equal((await read("/api/products")).length, before + 1);
        assert.equal(
          (
            await call("/api/products/import", {
              method: "POST",
              who: other,
              body,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await call("/api/products/import", {
              method: "POST",
              body,
              csrf: "",
            })
          ).status,
          403,
        );
      },
    );
  },
);
