import { test, expect, waitTurn } from "./fixtures.mjs";

test("phone reader fits one page, supports swipe, scroll and desktop resize", async ({
  page,
  context,
  published,
}, info) => {
  await page.goto("/m/" + published.slug);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "1",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2",
  );
  const box = await page.locator("#magazine").boundingBox();
  expect(box.width).toBeLessThanOrEqual(page.viewportSize().width);
  // Chromium generates real touch/pointer events, including touch-action handling.
  // Swipe along the page margin so this gesture cannot activate a product card.
  const paper = await page
    .locator("#magazine > .book-stage > .mag-page:visible")
    .boundingBox();
  const touch = await context.newCDPSession(page),
    y = paper.y + paper.height * 0.95;
  const point = (x) => ({ x, y, id: 1, radiusX: 2, radiusY: 2 });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(paper.x + paper.width * 0.8)],
  });
  for (let i = 1; i <= 8; i++)
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(paper.x + paper.width * (0.8 - (0.6 * i) / 8))],
    });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  await waitTurn(page);
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "3",
  );
  await page.screenshot({
    path: info.outputPath("phone-reader.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await expect(
    page.locator("#magazine > .book-stage > .mag-page:visible"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Book view", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
});

test("phone navigation panel closes after selection and pinch zoom keeps the current page", async ({
  page,
  context,
  published,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m/" + published.slug);
  await page
    .getByRole("button", { name: "Show thumbnails", exact: true })
    .click();
  await page.locator('[data-page-index="2"]').click();
  await expect(page.locator("#reader-sidebar")).toBeHidden();
  const book = page.locator("#magazine");
  await expect(book).toHaveAttribute("data-visible-pages", "3");
  const b = await page
    .locator("#magazine > .book-stage > .mag-page:visible")
    .boundingBox();
  const touch = await context.newCDPSession(page),
    y = b.y + b.height - 15,
    cx = b.x + b.width / 2;
  const points = (distance) =>
    [1, 2].map((id) => ({
      id,
      x: cx + (id === 1 ? -distance : distance),
      y,
      radiusX: 2,
      radiusY: 2,
    }));
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(35),
  });
  for (const distance of [45, 55, 65, 75])
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(distance),
    });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  await expect(book).toHaveAttribute("data-zoomed", "true");
  await expect(book).toHaveAttribute("data-visible-pages", "3");
  await page.getByRole("button", { name: "Fit book", exact: true }).click();
  await expect(book).toHaveAttribute("data-zoomed", "false");
});
