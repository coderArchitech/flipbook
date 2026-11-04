import { test, expect, vi, beforeEach } from "vitest";
vi.mock("../../server/db.mjs", () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
  now: () => "2026-10-27T00:00:00Z",
}));
import { get } from "../../server/db.mjs";
import {
  resourceDocument,
  approvalState,
  requireApproval,
} from "../../server/editor-routes.mjs";
import { makePage } from "../../shared/document.mjs";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
beforeEach(() => vi.clearAllMocks());
test("resource validation accepts supported design kinds and rejects malformed or unsafe data", () => {
  expect(
    resourceDocument("page", { page: makePage("closing") }, fail).schemaVersion,
  ).toBe(2);
  expect(
    resourceDocument(
      "brand",
      { brand: { ink: "#112233", headingFont: "serif" } },
      fail,
    ).brand.ink,
  ).toBe("#112233");
  for (const [kind, content] of [
    ["script", {}],
    ["page", {}],
    ["group", { blocks: [] }],
    ["brand", { brand: { ink: "url(https://evil.test)" } }],
  ])
    expect(() => resourceDocument(kind, content, fail)).toThrow();
});
test("approval requires the current revision and no unresolved comments", () => {
  const p = {
    id: "p",
    revision: 3,
    document: JSON.stringify({ requireApproval: true }),
  };
  get.mockImplementation((sql) =>
    sql.includes("count") ? { n: 0 } : { revision: 2 },
  );
  expect(approvalState(p).approved).toBe(false);
  expect(() => requireApproval(p, fail)).toThrow("approve");
  get.mockImplementation((sql) =>
    sql.includes("count") ? { n: 1 } : { revision: 3 },
  );
  expect(approvalState(p).approved).toBe(false);
  get.mockImplementation((sql) =>
    sql.includes("count") ? { n: 0 } : { revision: 3 },
  );
  expect(approvalState(p).approved).toBe(true);
  expect(() => requireApproval(p, fail)).not.toThrow();
});
test("review gate is optional for ordinary publication workflows", () => {
  get.mockImplementation((sql) =>
    sql.includes("count") ? { n: 2 } : undefined,
  );
  expect(() =>
    requireApproval({ id: "p", revision: 1, document: "{}" }, fail),
  ).not.toThrow();
});
