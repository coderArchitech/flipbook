// @vitest-environment jsdom
import { test, expect, afterEach } from "vitest";
import {
  makeDocument,
  makePage,
  block,
  emptyProduct,
} from "../../shared/document.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
import { renderPage, renderPrint } from "../../shared/render.mjs";
const doc = () => ({
  ...upgradeDocument(makeDocument()),
  pages: [makePage("blank")],
});
const mount = (d) => {
  document.body.innerHTML = renderPage(d.pages[0], d, (id) => "/assets/" + id);
  return document.body;
};
afterEach(() => document.body.replaceChildren());
test("rich text renders semantic marks/lists/links while user markup stays text", () => {
  const d = doc();
  d.pages[0].blocks = [
    block("text", [0, 0, 12, 8], {
      text: "Hello <script>\nLink",
      richText: [
        {
          kind: "bullet",
          runs: [{ text: "Hello <script>", bold: true, color: "#112233" }],
        },
        {
          kind: "paragraph",
          runs: [
            {
              text: "Link",
              italic: true,
              underline: true,
              href: "https://example.com",
            },
          ],
        },
      ],
    }),
  ];
  const root = mount(d);
  expect(root.querySelector("script")).toBeNull();
  expect(root.querySelector("li strong").textContent).toBe("Hello <script>");
  expect(root.querySelector("a em u, a u em")).not.toBeNull();
  expect(root.querySelector("a").rel).toBe("noopener noreferrer");
});
test("effective styles, hidden layers, master tokens and gradient background appear in rendered HTML", () => {
  const d = doc();
  d.styles = [{ id: "heading", name: "Heading", size: 44, color: "#123456" }];
  d.pages[0].background = {
    type: "gradient",
    color: "#112233",
    color2: "#ffffff",
    angle: 90,
  };
  d.pages[0].blocks = [
    block("text", [0, 4, 12, 6], { text: "Heading", styleId: "heading" }),
    block("text", [0, 12, 6, 4], { text: "Hidden", hidden: true }),
  ];
  d.masters = [
    {
      id: "master",
      name: "Header",
      blocks: [
        block("text", [0, 0, 12, 2], { text: "Page {{page}} of {{pages}}" }),
      ],
    },
  ];
  d.pages[0].masterId = "master";
  const root = mount(d);
  expect(root.textContent).toContain("Page 1 of 1");
  expect(root.textContent).not.toContain("Hidden");
  expect(
    root.querySelector(
      '[data-block-id="' + d.pages[0].blocks[0].id + '"] .mag-text',
    ).style.fontSize,
  ).toBe("44px");
  expect(root.querySelector(".page-background").style.background).toContain(
    "linear-gradient",
  );
});
test("image transforms, frames, galleries and vector shapes have stable geometry", () => {
  const d = doc();
  d.pages[0].blocks = [
    block("image", [0, 0, 4, 8], {
      assetId: "a",
      alt: "A",
      appearance: {
        rotation: 15,
        flipX: true,
        frame: "circle",
        radius: 8,
        opacity: 0.7,
      },
    }),
    {
      ...newElement("gallery", [4, 0, 8, 8]),
      images: [
        { assetId: "b", alt: "B" },
        { assetId: "c", alt: "C" },
      ],
    },
    newElement("shape", [0, 10, 4, 4]),
  ];
  const root = mount(d);
  expect(root.querySelector(".mag-block").style.transform).toContain(
    "rotate(15deg)",
  );
  expect(root.querySelector(".mag-image .image-frame").style.clipPath).toBe(
    "circle(closest-side)",
  );
  expect(root.querySelectorAll("[data-page-gallery]")).toHaveLength(2);
  expect(root.querySelector("svg rect")).not.toBeNull();
});
test("product presentation changes fields without changing embedded product values", () => {
  const d = doc(),
    product = {
      ...emptyProduct(),
      name: "Chair",
      summary: "A seat",
      price: "45",
      sku: "CH-1",
      images: ["a"],
    };
  d.pages[0].blocks = [
    block("product", [0, 0, 6, 18], {
      product,
      presentation: { fields: ["name", "sku"], priceColor: "#ff0000" },
    }),
  ];
  const root = mount(d);
  expect(root.querySelector("h3").textContent).toBe("Chair");
  expect(root.querySelector(".price")).toBeNull();
  expect(root.querySelector(".product-photo")).toBeNull();
  expect(root.textContent).toContain("CH-1");
  expect(product.price).toBe("45");
});
test("hotspots carry explicit page/product targets and media has no autoplay with static print fallback", () => {
  const d = doc();
  d.pages[0].blocks = [
    {
      ...newElement("hotspot"),
      action: { kind: "page", pageId: d.pages[0].id },
    },
    {
      ...newElement("media"),
      url: "https://example.com/story.mp4",
      posterId: "poster",
      title: "Story",
      description: "Meet the maker",
    },
  ];
  const root = mount(d);
  expect(root.querySelector("[data-page-link]").dataset.pageLink).toBe(
    d.pages[0].id,
  );
  expect(root.querySelector("video").hasAttribute("autoplay")).toBe(false);
  expect(root.querySelector("video").preload).toBe("none");
  const printed = renderPrint(d, (id) => "/assets/" + id);
  expect(printed).not.toContain("<video");
  expect(printed).toContain("https://example.com/story.mp4");
  expect(printed).toContain("/assets/poster");
});
