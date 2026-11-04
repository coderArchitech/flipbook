import { test, expect } from "./fixtures.mjs";

test("a finding opens a dialog that explains it, says how to fix it and shows the element", async ({
  page,
  studio,
}) => {
  const fresh = await studio.mutate("/api/publications", {
    title: "Incomplete cover",
  });
  await page.goto("/#/edit/" + fresh.id);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const panel = page.getByRole("alert");
  await expect(panel).toContainText(/\d+ things? to check/);
  await panel
    .getByRole("button", { name: /Add an image and description/ })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: /things? to check/ });
  await expect(dialog).toBeVisible();
  const issue = dialog.locator(".issue.focused");
  await expect(issue.getByRole("heading", { level: 3 })).toHaveText(
    "Image needs a picture and a description",
  );
  await expect(issue).toContainText("Screen-reader users hear the description");
  await expect(issue.locator(".issue-steps li")).toHaveCount(2);
  await expect(issue.locator(".issue-steps")).toContainText(
    "tick Decorative image",
  );
  await expect(issue.locator(".issue-where")).toContainText("Page 1");
  // Editor and server come from the same build, so no version warning.
  await expect(page.locator(".server-version-notice")).toHaveCount(0);

  await issue.getByRole("button", { name: "Show on page" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Image description")).toBeVisible();
  await expect(page.getByText("Decorative image")).toBeVisible();
});

test("an older server's generic rejection is explained and the version mismatch is flagged", async ({
  page,
  publication,
}) => {
  // Simulate a server started before the editor was updated: it rejects the
  // draft with its catch-all message and sends no build header.
  await page.route("**/api/publications/*/draft", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Unsupported document or theme.",
            findings: [{ message: "Unsupported document or theme." }],
          }),
        })
      : route.fallback(),
  );
  await page.goto("/#/edit/" + publication.id);
  await page.getByLabel("Publication title").fill("Renamed after update");
  await expect(
    page.getByText("Not saved — fix the highlighted issue", { exact: true }),
  ).toBeVisible();

  const banner = page.locator(".editor > .server-version-notice");
  await expect(banner).toContainText(
    "The Flipbook server is older than this editor",
  );
  await expect(page.getByRole("alert")).toContainText("1 thing to check");
  await page
    .getByRole("alert")
    .getByRole("button", { name: /Unsupported document or theme/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "1 thing to check" });
  await expect(
    dialog.getByRole("heading", {
      name: "The server rejected the draft's structure",
    }),
  ).toBeVisible();
  await expect(dialog.locator(".server-version-notice")).toBeVisible();
  await expect(dialog.locator(".issue-steps")).toContainText(
    "restart the server",
  );
  await expect(
    dialog.getByRole("button", { name: "Show on page" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
