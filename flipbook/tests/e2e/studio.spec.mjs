import sharp from "sharp";
import { test, expect, waitJob } from "./fixtures.mjs";
import { readFile } from "node:fs/promises";

test("edit text and products, autosave, reload, preview, publish and download PDF", async ({
  page,
  studio,
  publication,
}, info) => {
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByLabel("Publication title")
    .fill("The browser-tested collection");
  await page
    .getByRole("button", { name: "Select text block", exact: true })
    .first()
    .dblclick();
  await page
    .getByLabel("Edit text in place")
    .fill("THE LOCAL EDIT / VOLUME 02");
  await page.getByLabel("Edit text in place").press("Tab");
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select product block", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Morning ritual mug");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Publication title")).toHaveValue(
    "The browser-tested collection",
  );
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select product block", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Morning ritual mug",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Next preview page" }).click();
  await expect(
    page.locator(".book-preview-surround .book-viewer"),
  ).toHaveAttribute("data-visible-pages", "2,3");
  await expect(
    page.locator(".book-preview-surround .book-viewer"),
  ).toHaveAttribute("data-turning", "false");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const live = page.getByRole("link", { name: "Open publication" });
  await expect(live).toBeVisible({ timeout: 30000 });
  const popupPromise = page.waitForEvent("popup");
  await live.click();
  const reader = await popupPromise;
  await expect(reader.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "1",
  );
  await reader.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(reader.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2,3",
  );
  await expect(
    reader.getByRole("button", { name: "View Morning ritual mug details" }),
  ).toBeVisible();
  const pdf = await studio.mutate(
    `/api/publications/${publication.id}/export`,
    {},
  );
  await waitJob(studio, pdf.id);
  const downloadPromise = reader.waitForEvent("download");
  await reader.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  await reader.screenshot({
    path: info.outputPath("published-book.png"),
    fullPage: true,
  });
});

test("page templates, ordering, duplication, undo and redo persist", async ({
  page,
  publication,
}) => {
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Add page", exact: true })
    .first()
    .click();
  await page
    .locator(".template-picker")
    .getByRole("button")
    .filter({ has: page.getByText("Closing", { exact: true }) })
    .click();
  await expect(
    page.getByRole("button", { name: "Select page 5", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate page", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select page 6", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select page 6", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("button", { name: "Move page 6 up", exact: true })
    .click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select page 6", exact: true }),
  ).toBeVisible();
});

test("editor book preview opens product details and restores keyboard focus", async ({
  page,
  publication,
}) => {
  await page.goto("/#/edit/" + publication.id);
  const previewButton = page.getByRole("button", {
    name: "Preview",
    exact: true,
  });
  await previewButton.click();
  const preview = page.locator(".book-preview-surround .book-viewer");
  await page.getByRole("button", { name: "Next preview page" }).click();
  await expect(preview).toHaveAttribute("data-visible-pages", "2,3");
  await expect(preview).toHaveAttribute("data-turning", "false");
  const product = preview.locator("[data-product]:visible").first();
  await product.focus();
  await page.keyboard.press("Enter");
  const details = page.locator("dialog:has(> .preview-product)");
  const expected = publication.document.pages[1].blocks.find(
    (b) => b.type === "product",
  ).product;
  await expect(
    details.getByRole("heading", { name: expected.name, exact: true }),
  ).toBeVisible();
  await details.getByRole("button", { name: "View image 1" }).click();
  await expect
    .poll(() =>
      details
        .locator(".preview-product > img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect(
    details.getByRole("link", { name: "View product", exact: true }),
  ).toHaveAttribute("href", expected.url);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(product).toBeFocused();
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await expect(
    preview.locator(":scope > .book-stage > .mag-page:visible"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "Book view", exact: true }).click();
  await expect(preview).toHaveAttribute("data-visible-pages", "2,3");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(previewButton).toBeFocused();
});

test("two tabs detect a revision conflict without overwriting the saved draft", async ({
  page,
  context,
  publication,
  studio,
}) => {
  await page.goto("/#/edit/" + publication.id);
  await expect(page.getByLabel("Publication title")).toBeVisible();
  const second = await context.newPage();
  await second.goto("/#/edit/" + publication.id);
  await expect(second.getByLabel("Publication title")).toBeVisible();
  await page.getByLabel("Publication title").fill("Saved in first tab");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await second.getByLabel("Publication title").fill("Competing change");
  await expect(
    second.getByText("Conflicting edits — action needed"),
  ).toBeVisible();
  const saved = await (
    await studio.api.get("/api/publications/" + publication.id)
  ).json();
  expect(saved.document.title).toBe("Saved in first tab");
  await expect(
    second.getByRole("button", { name: "Save my copy" }),
  ).toBeVisible();
});

test("uploads a real image and reuses it in a catalog product", async ({
  page,
  studio,
}) => {
  await page.goto("/#/assets");
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#c9b9a0" },
  })
    .png()
    .toBuffer();
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-upload.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("heading", { name: "browser-upload.png" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Browser product");
  await page
    .getByLabel("Short description")
    .fill("An image upload and catalog persistence check.");
  await page.getByRole("button", { name: "Add product image" }).click();
  await page.getByRole("button", { name: "browser-upload.png" }).click();
  await page.getByRole("button", { name: "Save product" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser product", exact: true }),
  ).toBeVisible();
});

test("incomplete publications show actionable publish validation", async ({
  page,
  studio,
}) => {
  const fresh = await studio.mutate("/api/publications", {
    title: "Incomplete cover",
  });
  await page.goto("/#/edit/" + fresh.id);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add an image and description",
  );
  await expect(
    page.getByRole("link", { name: "Open publication" }),
  ).toHaveCount(0);
});

test.describe("local account lifecycle", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("create a studio, sign out, reject wrong password and sign back in", async ({
    page,
  }) => {
    const email = "signup-" + crypto.randomUUID() + "@example.test";
    await page.goto("/");
    await page
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
    await page.getByLabel("Your name").fill("Signup Studio");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("signup-test-only-2026");
    await page.getByRole("button", { name: "Create my studio" }).click();
    await expect(
      page.getByRole("heading", { name: "Your publications." }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Signup Studio.*Sign out/ }).click();
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Email or password is incorrect",
    );
    await page
      .getByLabel("Password", { exact: true })
      .fill("signup-test-only-2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your publications." }),
    ).toBeVisible();
  });
});
