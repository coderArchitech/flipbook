import { test as base, expect, request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { duplicatePage } from "../../shared/document.mjs";

export const test = base.extend({
  _noPageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(errors, "Uncaught browser errors").toEqual([]);
    },
    { auto: true },
  ],
  studio: [
    async ({}, use, workerInfo) => {
      const api = await request.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      const email = `browser-${randomUUID()}@example.test`,
        password = "browser-test-only-2026";
      const response = await api.post("/api/auth/register", {
        data: { name: "Browser Studio", email, password },
      });
      expect(response.status()).toBe(201);
      const auth = await response.json();
      const storageState = await api.storageState();
      const mutate = async (path, data, method = "post") => {
        const result = await api[method](path, {
          data,
          headers: {
            "X-CSRF-Token": auth.csrf,
            "Idempotency-Key": randomUUID(),
          },
        });
        expect(result.ok(), await result.text()).toBeTruthy();
        return result.json();
      };
      const seed = (await (await api.get("/api/publications")).json())[0];
      await use({ api, mutate, storageState, seed, email, password });
      await api.dispose();
    },
    { scope: "worker" },
  ],
  storageState: async ({ studio }, use) => use(studio.storageState),
  publication: async ({ studio }, use) => {
    const pub = await studio.mutate(
      `/api/publications/${studio.seed.id}/duplicate`,
      {},
    );
    await use(pub);
  },
  published: async ({ studio, publication }, use) => {
    const document = structuredClone(publication.document);
    document.pages.push(
      duplicatePage(document.pages[2]),
      duplicatePage(document.pages[3]),
    );
    const saved = await studio.mutate(
      `/api/publications/${publication.id}/draft`,
      { document, revision: publication.revision },
      "put",
    );
    const job = await studio.mutate(
      `/api/publications/${publication.id}/publish`,
      { revision: saved.revision },
    );
    await waitJob(studio, job.id);
    const pdf = await studio.mutate(
      `/api/publications/${publication.id}/export`,
      {},
    );
    await waitJob(studio, pdf.id);
    await use({ ...publication, document });
  },
});
export { expect };
export async function waitJob(studio, id) {
  let job;
  await expect
    .poll(
      async () => {
        job = await (await studio.api.get("/api/jobs/" + id)).json();
        return job.status;
      },
      { timeout: 30000, intervals: [250, 500, 1000] },
    )
    .toMatch(/succeeded|failed|cancelled/);
  expect(job.status, JSON.stringify(job.error)).toBe("succeeded");
  return job;
}
export async function waitTurn(page) {
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-turning",
    "false",
  );
}
