import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { startTestServer } from "./server-fixture.mjs";
import { upgradeDocument, newElement } from "../shared/editor-commands.mjs";
import {
  CUSTOM_WOFF,
  CUSTOM_WOFF2,
  CUSTOM_POSTSCRIPT,
  woffToTtf,
} from "./font-fixture.mjs";

test(
  "uploaded fonts: validation, ownership, publishing and PDF embedding",
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
          name: "Font tests",
          password: "font-tests-only-2026",
        }),
      });
      assert.equal(r.status, 201);
      return {
        cookie: r.headers.get("set-cookie").split(";")[0],
        csrf: (await r.json()).csrf,
      };
    }
    const owner = await account("fonts@example.test"),
      other = await account("other-fonts@example.test");
    const call = (path, { method = "GET", body, who = owner, raw } = {}) =>
      fetch(server.url + path, {
        method,
        headers: who
          ? {
              Cookie: who.cookie,
              "X-CSRF-Token": who.csrf,
              "Idempotency-Key": randomUUID(),
              "Content-Type": raw
                ? "application/octet-stream"
                : "application/json",
              "X-File-Name": "brand-font",
            }
          : {},
        ...(raw
          ? { body: raw }
          : body === undefined
            ? {}
            : { body: JSON.stringify(body) }),
      });
    const upload = (bytes, who = owner) =>
      call("/api/fonts", { method: "POST", raw: bytes, who });
    async function waitJob(id) {
      for (let i = 0; i < 150; i++) {
        const j = await (await call("/api/jobs/" + id)).json();
        if (["succeeded", "failed", "cancelled"].includes(j.status)) return j;
        await delay(200);
      }
      throw new Error("Job timeout: " + server.logs());
    }

    let font;
    await t.test(
      "accepts WOFF and TTF, rejects WOFF2, junk and no-embedding licences",
      async () => {
        const woff = await upload(readFileSync(CUSTOM_WOFF));
        assert.equal(woff.status, 201, await woff.clone().text());
        font = await woff.json();
        assert.equal(font.value, "custom:" + font.id);
        assert.equal(font.family, "Instrument Serif Italic");
        assert.equal(font.format, "woff");
        const ttf = await upload(woffToTtf());
        assert.equal(ttf.status, 201);
        assert.equal((await ttf.json()).format, "ttf");

        const woff2 = await upload(readFileSync(CUSTOM_WOFF2));
        assert.equal(woff2.status, 400);
        assert.match((await woff2.json()).error, /WOFF2/);
        const junk = await upload(Buffer.from("this is not a font at all"));
        assert.equal(junk.status, 400);
        const restricted = await upload(woffToTtf(undefined, { fsType: 2 }));
        assert.equal(restricted.status, 400);
        assert.match((await restricted.json()).error, /licence/);
        const unsigned = await fetch(server.url + "/api/fonts", {
          method: "POST",
          body: readFileSync(CUSTOM_WOFF),
        });
        assert.equal(unsigned.status, 401);

        const list = await (await call("/api/fonts")).json();
        assert.equal(list.length, 2);
        const file = await call(`/api/fonts/${font.id}/file`);
        assert.equal(file.status, 200);
        assert.equal(file.headers.get("content-type"), "font/woff");
      },
    );

    await t.test("another account cannot read or use the font", async () => {
      assert.equal(
        (await call(`/api/fonts/${font.id}/file`, { who: other })).status,
        404,
      );
      assert.deepEqual(
        await (await call("/api/fonts", { who: other })).json(),
        [],
      );
      const seed = (
        await (await call("/api/publications", { who: other })).json()
      )[0];
      const document = upgradeDocument(seed.document);
      document.brand = { headingFont: font.value };
      const save = await call(`/api/publications/${seed.id}/draft`, {
        method: "PUT",
        who: other,
        body: { revision: seed.revision, document },
      });
      assert.equal(save.status, 422);
      assert.match((await save.json()).error, /font is not available/);
    });

    await t.test(
      "published reader serves the font for the live version and the PDF embeds it",
      async () => {
        const seed = (await (await call("/api/publications")).json())[0];
        const document = upgradeDocument(seed.document);
        document.brand = { ...document.brand, headingFont: font.value };
        const heading = newElement("text", [0, 30, 12, 4]);
        heading.text = "Typeset in an uploaded font";
        heading.textStyle = { font: font.value };
        document.pages[1].blocks = document.pages[1].blocks.filter(
          (b) => b.rect[1] + b.rect[3] <= 29,
        );
        document.pages[1].blocks.push(heading);
        const saved = await call(`/api/publications/${seed.id}/draft`, {
          method: "PUT",
          body: { revision: seed.revision, document },
        });
        assert.equal(saved.status, 200, await saved.clone().text());
        const publish = await call(`/api/publications/${seed.id}/publish`, {
          method: "POST",
          body: { revision: (await saved.json()).revision },
        });
        const job = await waitJob((await publish.json()).id);
        assert.equal(job.status, "succeeded", JSON.stringify(job.error));
        const pub = await (await call(`/api/publications/${seed.id}`)).json();
        const html = await (await call("/m/" + pub.slug, { who: null })).text();
        const url = `/api/reader/${pub.slug}/fonts/${font.id}?version=${pub.liveVersion}`;
        assert.ok(html.includes(`font-family:'ff-${font.id}'`));
        assert.ok(html.includes(url));
        assert.equal((await call(url, { who: null })).status, 200);
        assert.equal(
          (
            await call(`/api/reader/${pub.slug}/fonts/${font.id}?version=old`, {
              who: null,
            })
          ).status,
          409,
        );
        const unused = (await (await call("/api/fonts")).json()).find(
          (f) => f.id !== font.id,
        );
        assert.equal(
          (
            await call(
              `/api/reader/${pub.slug}/fonts/${unused.id}?version=${pub.liveVersion}`,
              { who: null },
            )
          ).status,
          404,
        );

        const exportJob = await (
          await call(`/api/publications/${seed.id}/export`, {
            method: "POST",
            body: {},
          })
        ).json();
        const pdfJob = await waitJob(exportJob.id);
        assert.equal(pdfJob.status, "succeeded", JSON.stringify(pdfJob.error));
        const pdf = Buffer.from(
          await (await call(`/api/jobs/${pdfJob.id}/download`)).arrayBuffer(),
        ).toString("latin1");
        assert.match(
          pdf,
          new RegExp(`/FontName /[A-Z]{6}\\+${CUSTOM_POSTSCRIPT}`),
        );

        await call(`/api/publications/${seed.id}/unpublish`, {
          method: "POST",
          body: {},
        });
        assert.equal((await call(url, { who: null })).status, 404);
      },
    );
  },
);
