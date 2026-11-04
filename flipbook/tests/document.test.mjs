import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDocument,
  makePage,
  duplicatePage,
  validateDocument,
  validateProduct,
  safeUrl,
  TEMPLATES,
  block,
} from "../shared/document.mjs";
import { visiblePages, adjacentPage } from "../public/book-model.js";

test("all seven templates are valid editable drafts", () => {
  for (const template of TEMPLATES) {
    const doc = makeDocument();
    doc.pages = [makePage(template.id)];
    assert.deepEqual(validateDocument(doc), [], template.id);
  }
});
test("publish validation rejects incomplete content and accepts a closing page", () => {
  const doc = makeDocument();
  assert.ok(validateDocument(doc, true).length);
  doc.pages = [makePage("closing")];
  assert.deepEqual(validateDocument(doc, true), []);
});
test("malformed content returns findings without throwing", () => {
  for (const value of [
    null,
    {},
    [],
    { pages: [null] },
    { ...makeDocument(), title: 42 },
    { ...makeDocument(), pages: [null] },
    { ...makeDocument(), pages: [{ id: "p", title: "P", blocks: [null] }] },
  ]) {
    assert.ok(validateDocument(value, true).length);
  }
  assert.ok(validateProduct({ name: 4, summary: 3, images: 2 }, true).length);
  const doc = makeDocument();
  doc.pages[0].blocks[0].text = null;
  assert.ok(validateDocument(doc, true).length);
});
test("geometry, duplicate identities, prototype themes and overlaps are rejected", () => {
  const doc = makeDocument();
  doc.pages = [makePage("blank")];
  doc.pages[0].blocks = [
    block("text", [0, 0, 6, 4]),
    block("text", [0, 0, 6, 4]),
  ];
  assert.ok(validateDocument(doc).some((e) => e.message.includes("overlap")));
  doc.pages[0].blocks[1].rect = [11, 0, 2, 4];
  assert.ok(validateDocument(doc).some((e) => e.message.includes("inside")));
  doc.pages[0].blocks[1].id = doc.pages[0].blocks[0].id;
  assert.ok(validateDocument(doc).some((e) => e.message.includes("unique")));
  doc.theme = "constructor";
  assert.ok(validateDocument(doc).length);
});
test("duplicate pages get fresh page/block IDs and independent content", () => {
  const page = makePage("cover"),
    copy = duplicatePage(page);
  assert.notEqual(page.id, copy.id);
  assert.notEqual(page.blocks[0].id, copy.blocks[0].id);
  copy.blocks[0].text = "changed";
  assert.notEqual(page.blocks[0].text, copy.blocks[0].text);
});
test("links accept HTTPS and reject executable, credentialed and malformed URLs", () => {
  assert.equal(
    safeUrl("https://example.com/product"),
    "https://example.com/product",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
    "data:text/html,a",
    {},
    null,
  ])
    assert.equal(safeUrl(url), "");
});
test("book opens from cover to facing pages and ends on the back cover", () => {
  assert.deepEqual(visiblePages(0, 6), [0]);
  assert.deepEqual(visiblePages(1, 6), [1, 2]);
  assert.deepEqual(visiblePages(2, 6), [1, 2]);
  assert.deepEqual(visiblePages(5, 6), [5]);
  assert.equal(adjacentPage(0, 6, 1), 1);
  assert.equal(adjacentPage(1, 6, 1), 3);
  assert.equal(adjacentPage(3, 6, -1), 2);
  assert.equal(adjacentPage(1, 6, -1), 0);
  assert.equal(adjacentPage(5, 6, 1), 5);
  assert.equal(adjacentPage(0, 6, -1), 0);
});
test("odd and single-page books, mobile pagination and empty lists are bounded", () => {
  assert.deepEqual(visiblePages(4, 5), [3, 4]);
  assert.deepEqual(visiblePages(0, 1), [0]);
  assert.deepEqual(visiblePages(2, 5, true), [2]);
  assert.equal(adjacentPage(2, 5, 1, true), 3);
  assert.deepEqual(visiblePages(0, 0), []);
});
