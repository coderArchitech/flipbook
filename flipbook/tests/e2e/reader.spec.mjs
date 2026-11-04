import { test, expect, waitTurn } from "./fixtures.mjs";

test("rapid page turns remain responsive and settle on the requested spread", async ({
  page,
  published,
}) => {
  await page.goto(
    "/m/" + published.slug + "?page=" + published.document.pages[1].id,
  );
  const next = page.getByRole("button", { name: "Next page", exact: true });
  await next.click();
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-turning",
    "true",
  );
  await expect(next).toBeEnabled();
  // During a GPU turn the canonical HTML is inert; the canvas paints both
  // sides. Assert the completed destination, not a transient DOM paint layer.
  await next.click();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "6",
  );
  await expect(page.locator(".book-leaf,.book-cover-turn")).toHaveCount(0);
  await expect(next).toBeDisabled();
  const previous = page.getByRole("button", {
    name: "Previous page",
    exact: true,
  });
  await previous.click();
  await previous.click();
  await previous.click();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "1",
  );
  await expect(previous).toBeDisabled();
});

test("an abandoned page drag across text settles back without selecting the text", async ({
  page,
  published,
}) => {
  await page.goto(
    "/m/" + published.slug + "?page=" + published.document.pages[1].id,
  );
  const book = page.locator("#magazine");
  await expect(book).toHaveAttribute("data-renderer", "webgl");
  const b = await page
    .locator("#magazine > .book-stage > .mag-page:visible")
    .last()
    .boundingBox();
  const y = b.y + b.height * 0.55,
    x = b.x + b.width - 14;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.72, y - 10, { steps: 40 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  await waitTurn(page);
  await expect(book).toHaveAttribute("data-visible-pages", "2,3");
  expect(await page.evaluate(() => String(document.getSelection()))).toBe("");
});

test("WebGL paper follows a held drag, settles, and reverses an abandoned drag", async ({
  page,
  published,
}, info) => {
  await page.goto(
    "/m/" + published.slug + "?page=" + published.document.pages[1].id,
  );
  const book = page.locator("#magazine");
  await expect(book).toHaveAttribute("data-renderer", "webgl");
  const sheet = page
    .locator("#magazine > .book-stage > .mag-page:visible")
    .last();
  const b = await sheet.boundingBox(),
    x = b.x + b.width - 8,
    y = b.y + b.height - 15;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - b.width * 0.46, y - 4, { steps: 12 });
  await expect(page.locator(".paper-canvas")).toBeVisible();
  await expect
    .poll(async () => Number(await book.getAttribute("data-turn-progress")))
    .toBeGreaterThan(0.4);
  await expect(book).toHaveAttribute("aria-busy", "true");
  await page.screenshot({
    path: info.outputPath("curved-paper-drag.png"),
    fullPage: true,
  });
  await page.mouse.up();
  await waitTurn(page);
  await expect(book).toHaveAttribute("data-visible-pages", "4,5");
  await expect(page.locator(".paper-canvas")).toBeHidden();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(2);
  const c = await page
    .locator("#magazine > .book-stage > .mag-page:visible")
    .last()
    .boundingBox();
  await page.mouse.move(c.x + c.width - 8, c.y + c.height - 15);
  await page.mouse.down();
  await page.mouse.move(
    c.x + c.width - 8 - c.width * 0.45,
    c.y + c.height - 15,
    { steps: 8 },
  );
  await expect(page.locator(".paper-canvas")).toBeVisible();
  await page.mouse.move(
    c.x + c.width - 8 - c.width * 0.1,
    c.y + c.height - 15,
    { steps: 10 },
  );
  await page.mouse.up();
  await waitTurn(page);
  await expect(book).toHaveAttribute("data-visible-pages", "4,5");
});

test("thumbnails, contents and product search navigate to real pages and restore focus", async ({
  page,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m/" + published.slug);
  const thumbnails = page.getByRole("button", {
    name: "Show thumbnails",
    exact: true,
  });
  await thumbnails.click();
  await expect(page.locator(".page-thumbnail")).toHaveCount(6);
  await page.getByRole("button", { name: "Contents", exact: true }).click();
  await expect(page.locator(".page-thumbnail")).toHaveCount(0);
  await page.locator('[data-page-index="3"]').click();
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "4,5",
  );
  await expect(page.locator('[data-page-index="3"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(thumbnails).toBeFocused();
  await page
    .getByRole("button", { name: "Search publication", exact: true })
    .click();
  const product = published.document.pages
    .flatMap((p) => p.blocks)
    .find((b) => b.type === "product").product;
  await page
    .getByRole("searchbox", { name: "Search publication", exact: true })
    .fill(product.sku || product.name);
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.locator(".search-result").first().click();
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await page
    .getByRole("searchbox", { name: "Search publication", exact: true })
    .fill("<script>not a product</script>");
  await expect(page.locator("#search-count")).toHaveText("0 matching pages");
  await expect(page.locator(".search-result")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Search publication", exact: true }),
  ).toBeFocused();
});

test("view preferences persist and RTL keyboard, single page, slide and scroll modes remain navigable", async ({
  page,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m/" + published.slug);
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByLabel("View mode", { exact: true }).selectOption("2d");
  await page.getByLabel("Page layout", { exact: true }).selectOption("single");
  await page.getByLabel("Reading direction").selectOption("rtl");
  await page.getByLabel("Binding", { exact: true }).selectOption("spiral");
  await page.getByLabel("Surround", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Close view options" }).click();
  const book = page.locator("#magazine");
  await book.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(book).toHaveAttribute("data-visible-pages", "2");
  await page.reload();
  await expect(book).toHaveAttribute("data-direction", "rtl");
  await expect(book).toHaveAttribute("data-binding", "spiral");
  await expect(page.locator("body")).toHaveAttribute("data-background", "dark");
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await expect(page.getByLabel("View mode", { exact: true })).toHaveValue("2d");
  await page.getByLabel("View mode", { exact: true }).selectOption("slide");
  await page.getByLabel("Page layout", { exact: true }).selectOption("spread");
  await page.getByRole("button", { name: "Close view options" }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(book).toHaveAttribute("data-visible-pages", "3");
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Book view", exact: true }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(1);
});

test("zoom pans without turning, fits back, and first/last controls respect boundaries", async ({
  page,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/m/" + published.slug + "?page=" + published.document.pages[1].id,
  );
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeDisabled();
  const book = page.locator("#magazine");
  await expect(book).toHaveAttribute("data-zoomed", "true");
  await page.mouse.move(500, 250);
  await page.mouse.down();
  await page.mouse.move(240, 250, { steps: 8 });
  await page.mouse.up();
  await expect(book).toHaveAttribute("data-visible-pages", "2,3");
  await page.getByRole("button", { name: "Fit book", exact: true }).click();
  await expect(book).toHaveAttribute("data-zoomed", "false");
  await expect(
    page.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Go to last page", exact: true })
    .click();
  await expect(book).toHaveAttribute("data-visible-pages", "6");
  await expect(
    page.getByRole("button", { name: "Go to last page", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Go to first page", exact: true })
    .click();
  await expect(book).toHaveAttribute("data-visible-pages", "1");
});

test("autoplay advances only after opting in and pauses on manual navigation and the last page", async ({
  page,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m/" + published.slug);
  await page.clock.install();
  await page.getByRole("button", { name: "Start autoplay" }).click();
  await page.clock.fastForward(4100);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start autoplay" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Start autoplay" }).click();
  await page.clock.fastForward(4100);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "6",
  );
  await expect(
    page.getByRole("button", { name: "Start autoplay" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("print renders every canonical page and restores the scroll view afterwards", async ({
  page,
  published,
}) => {
  await page.addInitScript(() => {
    window.printCalls = 0;
    window.print = () => window.printCalls++;
  });
  await page.goto("/m/" + published.slug);
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await page.getByRole("button", { name: "Print publication" }).click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  await expect(page.locator("#magazine")).toHaveClass(/flow/);
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(6);
  await expect(page.locator(".reader-nav")).toBeHidden();
  const size = await page
    .locator("#magazine > .book-stage > .mag-page")
    .first()
    .boundingBox();
  expect(size.width).toBeCloseTo(794, 0);
  expect(size.height).toBeCloseTo(1123, 0);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#magazine")).toHaveClass(/flow/);
});

test("blocked WebGL uses an operable 2D fallback with product interactions", async ({
  page,
  published,
}) => {
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : context.call(this, type, ...args);
    };
  });
  await page.goto("/m/" + published.slug);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-renderer",
    "css",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await page.locator("#magazine [data-product]:visible").first().click();
  await expect(page.locator("#product-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await expect(page.locator("#rendering-note")).toContainText(
    "2D reader stays fully usable",
  );
});

test("flip sound is gesture-driven, can be muted and remembers the preference", async ({
  page,
  published,
}) => {
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.audioChecks = { contexts: 0, starts: 0 };
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.audioChecks.contexts++;
      }
      createBufferSource() {
        const node = super.createBufferSource(),
          start = node.start.bind(node);
        node.start = (...args) => {
          window.audioChecks.starts++;
          return start(...args);
        };
        return node;
      }
    };
  });
  await page.goto("/m/" + published.slug);
  expect(await page.evaluate(() => window.audioChecks.contexts)).toBe(0);
  await page
    .getByRole("button", { name: "Mute flip sound", exact: true })
    .click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await waitTurn(page);
  expect(await page.evaluate(() => window.audioChecks.starts)).toBe(0);
  await page
    .getByRole("button", { name: "Enable flip sound", exact: true })
    .click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await waitTurn(page);
  await expect
    .poll(() => page.evaluate(() => window.audioChecks.starts))
    .toBe(1);
  await page
    .getByRole("button", { name: "Mute flip sound", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Enable flip sound", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.audioChecks.contexts)).toBe(0);
});

test("cover, two-sided page turns, boundaries, deep links and keyboard navigation", async ({
  page,
  published,
}, info) => {
  await page.goto("/m/" + published.slug);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "1",
  );
  await expect(
    page.getByRole("button", { name: "Previous page", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await page.getByRole("button", { name: "Turn to next spread" }).click();
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-turning",
    "true",
  );
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "4,5",
  );
  await page.screenshot({
    path: info.outputPath("interior-spread.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fit book", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fit book", exact: true }).click();
  await page.locator("#magazine").focus();
  await page.keyboard.press("ArrowLeft");
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await page.getByLabel("Jump to page").selectOption("5");
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "6",
  );
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "6",
  );
  await page.locator("#magazine").focus();
  await page.keyboard.press("Home");
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "1",
  );
});

test("product dialog, focus restoration, scroll view and reduced motion", async ({
  page,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m/" + published.slug);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".book-leaf")).toHaveCount(0);
  await waitTurn(page);
  const product = page.locator("#magazine [data-product]:visible").first();
  await product.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#product-dialog")).toBeVisible();
  await page.getByRole("button", { name: "View image 1" }).click();
  await expect(page.locator("#detail-hero")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#product-dialog")).not.toBeVisible();
  await expect(product).toBeFocused();
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Book view", exact: true }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(2);
});

test("odd-sized and one-page books never show phantom pages", async ({
  page,
  studio,
  publication,
}) => {
  for (const count of [5, 1]) {
    const doc = structuredClone(publication.document);
    if (count === 5)
      doc.pages.push({
        ...structuredClone(doc.pages[3]),
        id: crypto.randomUUID(),
        blocks: doc.pages[3].blocks.map((b) => ({
          ...b,
          id: crypto.randomUUID(),
        })),
      });
    else doc.pages = doc.pages.slice(0, 1);
    const current = await (
      await studio.api.get("/api/publications/" + publication.id)
    ).json();
    const saved = await studio.mutate(
      `/api/publications/${publication.id}/draft`,
      { document: doc, revision: current.revision },
      "put",
    );
    const job = await studio.mutate(
      `/api/publications/${publication.id}/publish`,
      { revision: saved.revision },
    );
    const { waitJob } = await import("./fixtures.mjs");
    await waitJob(studio, job.id);
    await page.goto("/m/" + publication.slug);
    await page.getByLabel("Jump to page").selectOption(String(count - 1));
    await waitTurn(page);
    await expect(page.locator("#magazine")).toHaveAttribute(
      "data-visible-pages",
      count === 5 ? "4,5" : "1",
    );
    await expect(
      page.getByRole("button", { name: "Next page", exact: true }),
    ).toBeDisabled();
    if (count === 1)
      await expect(
        page.getByRole("button", { name: "Previous page", exact: true }),
      ).toBeDisabled();
  }
});

test("fullscreen exits cleanly and sharing copies the selected page URL", async ({
  page,
  context,
  published,
}) => {
  await page.goto("/m/" + published.slug);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  await page.getByLabel("Jump to page").selectOption("3");
  await waitTurn(page);
  const url = page.url();
  expect(new URL(url).searchParams.get("page")).toBe(
    published.document.pages[3].id,
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator("#reader-status")).toHaveText(
    "Publication link copied.",
  );
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(url);
});
