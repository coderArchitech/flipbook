// @vitest-environment jsdom
import { beforeEach, test, expect, vi } from "vitest";
import { api, setCsrf, uploadImage } from "../../client/api.js";
beforeEach(() => {
  setCsrf("session-csrf");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ revision: 2 }) }),
  );
});
test("save includes CSRF and reuses a supplied idempotency key", async () => {
  expect(
    await api("/draft", {
      method: "PUT",
      key: "stable-save-key",
      body: { revision: 1 },
    }),
  ).toEqual({ revision: 2 });
  expect(fetch).toHaveBeenCalledWith(
    "/api/draft",
    expect.objectContaining({
      method: "PUT",
      body: '{"revision":1}',
      headers: expect.objectContaining({
        "X-CSRF-Token": "session-csrf",
        "Idempotency-Key": "stable-save-key",
      }),
    }),
  );
});
test("read calls do not send a mutation key or JSON body", async () => {
  await api("/publications");
  const args = fetch.mock.calls[0][1];
  expect(args.body).toBeUndefined();
  expect(args.headers["Idempotency-Key"]).toBeUndefined();
});
test("revision errors preserve status, code and server revision for recovery", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({
      error: "Conflict",
      code: "REVISION_CONFLICT",
      revision: 5,
    }),
  });
  await expect(api("/draft")).rejects.toMatchObject({
    message: "Conflict",
    status: 409,
    code: "REVISION_CONFLICT",
    revision: 5,
  });
});
test("upload sends binary image metadata, reports progress and handles server failure", async () => {
  let xhr;
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      constructor() {
        xhr = this;
        this.upload = {};
        this.open = vi.fn();
        this.setRequestHeader = vi.fn();
        this.send = vi.fn();
      }
    },
  );
  const progress = vi.fn(),
    file = new File(["image"], "local image.png", { type: "image/png" }),
    pending = uploadImage(file, progress);
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    "X-File-Name",
    "local%20image.png",
  );
  expect(xhr.send).toHaveBeenCalledWith(file);
  xhr.upload.onprogress({ lengthComputable: true, loaded: 4, total: 8 });
  expect(progress).toHaveBeenCalledWith(50);
  xhr.status = 413;
  xhr.responseText = '{"error":"Too large"}';
  xhr.onload();
  await expect(pending).rejects.toThrow("Too large");
});
