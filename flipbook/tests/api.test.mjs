import sharp from "sharp";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer } from "./server-fixture.mjs";

test(
  "local API, ownership, snapshots, PDF and publication lifecycle",
  { timeout: 120000 },
  async (t) => {
    const server = await startTestServer();
    t.after(server.stop);
    async function account(email) {
      const response = await fetch(server.url + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: "Test Studio",
          password: "test-only-password-2026",
        }),
      });
      assert.equal(response.status, 201, await response.clone().text());
      const result = await response.json();
      return {
        cookie: response.headers.get("set-cookie").split(";")[0],
        csrf: result.csrf,
      };
    }
    const owner = await account("owner@example.test"),
      other = await account("other@example.test");
    async function call(
      path,
      {
        method = "GET",
        body,
        who = owner,
        key = randomUUID(),
        headers = {},
      } = {},
    ) {
      return fetch(server.url + path, {
        method,
        headers: {
          Cookie: who?.cookie || "",
          "X-CSRF-Token": who?.csrf || "",
          "Idempotency-Key": key,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    }
    const pubs = await (await call("/api/publications")).json();
    assert.equal(pubs.length, 1);
    let pub = pubs[0];
    const original = structuredClone(pub.document);
    await t.test(
      "authentication, CSRF, ownership and malformed documents",
      async () => {
        assert.equal(
          (await call("/api/publications", { who: null })).status,
          401,
        );
        assert.equal(
          (await call("/api/publications/" + pub.id, { who: other })).status,
          404,
        );
        assert.equal(
          (
            await call("/api/publications", {
              method: "POST",
              body: {},
              headers: { "X-CSRF-Token": "" },
            })
          ).status,
          403,
        );
        const bad = { ...pub.document, pages: [null] };
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              body: { document: bad, revision: pub.revision },
            })
          ).status,
          422,
        );
        const asset = (await (await call("/api/assets")).json())[0];
        assert.equal(
          (await call("/api/assets/" + asset.id, { who: other })).status,
          404,
        );
      },
    );
    await t.test(
      "idempotent saves do not increment twice; stale edits are rejected",
      async () => {
        const key = randomUUID(),
          body = {
            revision: pub.revision,
            document: { ...pub.document, title: "Integration edition" },
          };
        const saved = await (
          await call("/api/publications/" + pub.id + "/draft", {
            method: "PUT",
            key,
            body,
          })
        ).json();
        assert.equal(saved.revision, pub.revision + 1);
        assert.deepEqual(
          await (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              key,
              body,
            })
          ).json(),
          saved,
        );
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              body,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              key,
              body: { ...body, document: { ...body.document, title: "Other" } },
            })
          ).status,
          409,
        );
        pub = await (await call("/api/publications/" + pub.id)).json();
      },
    );
    await t.test(
      "image decoding, catalog revisions and asset ownership are enforced",
      async () => {
        const uploadHeaders = {
          Cookie: owner.cookie,
          "X-CSRF-Token": owner.csrf,
          "Content-Type": "image/png",
          "X-File-Name": "test-pixel.png",
        };
        const invalid = await fetch(server.url + "/api/assets", {
          method: "POST",
          headers: uploadHeaders,
          body: Buffer.from("not a png"),
        });
        assert.equal(invalid.status, 400);
        const png = await sharp({
          create: { width: 8, height: 8, channels: 3, background: "#c9b9a0" },
        })
          .png()
          .toBuffer();
        const uploaded = await fetch(server.url + "/api/assets", {
          method: "POST",
          headers: uploadHeaders,
          body: png,
        });
        assert.equal(uploaded.status, 201);
        const image = await uploaded.json();
        const content = {
          name: "Test product",
          summary: "A reusable catalog product",
          description: "Details",
          price: "25.00",
          currency: "USD",
          sku: "TEST",
          category: "Test",
          badge: "",
          url: "https://example.com/product",
          images: [image.id],
        };
        const created = await call("/api/products", {
          method: "POST",
          body: { content },
        });
        assert.equal(created.status, 201);
        const product = await created.json();
        assert.equal(
          (
            await call("/api/products/" + product.id, {
              method: "PUT",
              body: {
                content: { ...content, name: "Updated product" },
                revision: 1,
              },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call("/api/products/" + product.id, {
              method: "PUT",
              body: { content, revision: 1 },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await call("/api/products", {
              method: "POST",
              who: other,
              body: { content },
            })
          ).status,
          422,
        );
        const foreign = (
          await (await call("/api/assets", { who: other })).json()
        )[0];
        const document = structuredClone(pub.document);
        document.pages[0].blocks.find((b) => b.type === "image").assetId =
          foreign.id;
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              body: { document, revision: pub.revision },
            })
          ).status,
          422,
        );
      },
    );
    async function waitJob(id) {
      for (let i = 0; i < 150; i++) {
        const j = await (await call("/api/jobs/" + id)).json();
        if (["succeeded", "failed", "cancelled"].includes(j.status)) return j;
        await delay(200);
      }
      throw new Error("Job timeout: " + server.logs());
    }
    let liveVersion;
    await t.test(
      "publishes seeded content and produces a four-page PDF with links",
      async () => {
        const response = await call(
          "/api/publications/" + pub.id + "/publish",
          { method: "POST", body: { revision: pub.revision } },
        );
        assert.equal(response.status, 202, await response.clone().text());
        const result = await waitJob((await response.json()).id);
        assert.equal(result.status, "succeeded", JSON.stringify(result.error));
        pub = await (await call("/api/publications/" + pub.id)).json();
        liveVersion = pub.liveVersion;
        const html = await (await call("/m/" + pub.slug, { who: null })).text();
        assert.ok(html.includes("Integration edition"));
        assert.ok(html.includes("book-viewer.css"));
        const job = await (
          await call("/api/publications/" + pub.id + "/export", {
            method: "POST",
            body: {},
          })
        ).json();
        const pdfJob = await waitJob(job.id);
        assert.equal(pdfJob.status, "succeeded", JSON.stringify(pdfJob.error));
        const responsePDF = await call("/api/reader/" + pub.slug + "/pdf", {
          who: null,
        });
        assert.equal(responsePDF.status, 200);
        const bytes = Buffer.from(await responsePDF.arrayBuffer());
        assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
        assert.equal(
          (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
          4,
        );
        assert.ok(bytes.includes(Buffer.from("/URI")));
        if (process.env.FLIPBOOK_TEST_ARTIFACT_DIR) {
          await mkdir(process.env.FLIPBOOK_TEST_ARTIFACT_DIR, {
            recursive: true,
          });
          await writeFile(
            join(process.env.FLIPBOOK_TEST_ARTIFACT_DIR, "sample-magazine.pdf"),
            bytes,
          );
        }
      },
    );
    await t.test(
      "draft changes stay private; page analytics deduplicate event IDs",
      async () => {
        const html = await (await call("/m/" + pub.slug, { who: null })).text();
        const data = JSON.parse(
          html.match(/id="reader-data">(.*?)<\/script>/s)[1],
        );
        const event = { id: randomUUID(), type: "view" };
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await call("/api/reader/events", {
                method: "POST",
                who: null,
                body: { token: data.eventToken, event },
              })
            ).status,
            202,
          );
        const analytics = await (
          await call("/api/publications/" + pub.id + "/analytics")
        ).json();
        assert.equal(analytics.views, 1);
        pub.document.title = "Unpublished new title";
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/draft", {
              method: "PUT",
              body: { document: pub.document, revision: pub.revision },
            })
          ).status,
          200,
        );
        const current = await (
          await call("/m/" + pub.slug, { who: null })
        ).text();
        assert.ok(current.includes("Integration edition"));
        assert.ok(!current.includes("Unpublished new title"));
      },
    );
    await t.test(
      "unpublish fences queued work and revokes reader, PDF and asset access",
      async () => {
        pub = await (await call("/api/publications/" + pub.id)).json();
        const pending = await (
          await call("/api/publications/" + pub.id + "/publish", {
            method: "POST",
            body: { revision: pub.revision },
          })
        ).json();
        assert.equal(
          (
            await call("/api/publications/" + pub.id + "/unpublish", {
              method: "POST",
              body: {},
            })
          ).status,
          200,
        );
        const cancelled = await waitJob(pending.id);
        assert.equal(cancelled.status, "cancelled");
        assert.equal((await call("/m/" + pub.slug, { who: null })).status, 404);
        assert.equal(
          (await call("/api/reader/" + pub.slug + "/pdf", { who: null }))
            .status,
          404,
        );
        const asset = original.pages[0].blocks.find(
          (b) => b.type === "image",
        ).assetId;
        assert.equal(
          (
            await call(
              `/api/reader/${pub.slug}/assets/${asset}?version=${liveVersion}`,
              { who: null },
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "duplicates are independent drafts; archived documents cannot save",
      async () => {
        const copied = await (
          await call("/api/publications/" + pub.id + "/duplicate", {
            method: "POST",
            body: {},
          })
        ).json();
        assert.notEqual(copied.id, pub.id);
        assert.equal(copied.liveVersion, null);
        assert.notEqual(copied.document.pages[0].id, pub.document.pages[0].id);
        await call("/api/publications/" + copied.id + "/archive", {
          method: "POST",
          body: {},
        });
        assert.equal(
          (
            await call("/api/publications/" + copied.id + "/draft", {
              method: "PUT",
              body: { document: copied.document, revision: copied.revision },
            })
          ).status,
          409,
        );
        await call("/api/publications/" + copied.id + "/unarchive", {
          method: "POST",
          body: {},
        });
        assert.equal(
          (
            await call("/api/publications/" + copied.id + "/draft", {
              method: "PUT",
              body: { document: copied.document, revision: copied.revision },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "PDF layout overflow fails with an actionable block finding",
      async () => {
        const copied = await (
          await call("/api/publications/" + pub.id + "/duplicate", {
            method: "POST",
            body: {},
          })
        ).json();
        const b = copied.document.pages[0].blocks[0];
        b.text = "Text that cannot fit. ".repeat(150);
        b.size = 64;
        const saved = await (
          await call("/api/publications/" + copied.id + "/draft", {
            method: "PUT",
            body: { document: copied.document, revision: copied.revision },
          })
        ).json();
        const queued = await (
          await call("/api/publications/" + copied.id + "/publish", {
            method: "POST",
            body: { revision: saved.revision },
          })
        ).json();
        const result = await waitJob(queued.id);
        assert.equal(result.status, "failed");
        assert.ok(result.error.findings.some((f) => f.blockId === b.id));
        assert.equal(
          (await call("/m/" + copied.slug, { who: null })).status,
          404,
        );
      },
    );
    await t.test(
      "wrong passwords fail and logout invalidates the session",
      async () => {
        assert.equal(
          (
            await call("/api/auth/login", {
              method: "POST",
              who: null,
              body: { email: "other@example.test", password: "wrong-password" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await call("/api/auth/logout", {
              method: "POST",
              who: other,
              body: {},
            })
          ).status,
          200,
        );
        assert.equal((await call("/api/session", { who: other })).status, 401);
      },
    );
  },
);
