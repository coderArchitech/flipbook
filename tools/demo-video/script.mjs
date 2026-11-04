// Narration for the Flipbook demo, one entry per scene in the demo plan.
// Each sentence is synthesized separately so actions can be paced against it.
export const VOICE = { name: "Samantha", rate: 178 };

export const SCENES = [
  {
    id: "s01",
    title: "A catalog, as a magazine",
    lines: [
      "This is Slow Living, a ten page product magazine made in Flipbook.",
      "It started as a spreadsheet and a folder of images.",
      "Readers open it like a real book. Drag a page, and the paper curls with you.",
      "Let go early, and it settles back.",
    ],
  },
  {
    id: "s02",
    title: "Start from templates",
    lines: [
      "Every magazine starts in the library.",
      "Create a publication, then add pages from templates: covers, product features, grids, stories and closing pages.",
      "Reorder pages, duplicate them, and undo anything.",
      "For this demo, the Autumn Edit is already laid out. Let's make it ours.",
    ],
  },
  {
    id: "s03",
    title: "Brand once",
    lines: [
      "First, the brand. Upload your own typeface, and set it as the heading font.",
      "The cover headline switches to it straight away.",
      "Open the master page. It holds a shared header and a footer with automatic page numbers.",
      "Give it page margins, apply it to every page, and the numbering fills in.",
    ],
  },
  {
    id: "s04",
    title: "Real typography",
    lines: [
      "In the editor's letter, format individual words: italics, colour, and a link.",
      "Turn the contents into a bulleted list.",
      "Save the paragraph as a named style. Change it once, and every linked paragraph follows.",
      "Then add an icon from the built in library.",
    ],
  },
  {
    id: "s05",
    title: "Layout tools",
    lines: [
      "Layout works like a design tool.",
      "Shift select the icons, distribute them evenly, and align their tops.",
      "Group them with their captions and drag. Smart guides show where things line up.",
      "Lock the headline, so it can't move by accident.",
    ],
  },
  {
    id: "s06",
    title: "Images and hotspots",
    lines: [
      "Images are edited in place. Drag to reposition the crop, zoom in, rotate, and round the corners.",
      "Hide a layer while you work, then bring it back.",
      "Add a hotspot over the lamp that opens its product details.",
      "And copy a decoration from one page, straight onto another.",
    ],
  },
  {
    id: "s07",
    title: "Catalog in",
    lines: [
      "Now the catalog. Paste a spreadsheet and map its columns.",
      "One row is missing its image, so the preview flags it, and nothing is imported.",
      "Fix the row, import all four products, and generate a product page in one click.",
    ],
  },
  {
    id: "s08",
    title: "One card design",
    lines: [
      "Product cards share one presentation.",
      "Show the product code, set the price colour, and apply it to every product.",
      "A feature card can show several images: a main image with thumbnails, or a grid.",
    ],
  },
  {
    id: "s09",
    title: "Checks and history",
    lines: [
      "Design checks run while you edit.",
      "Push an element past the margin, or use a low resolution image, and it's flagged. Click a warning to jump straight to it.",
      "Everything autosaves, and survives a reload.",
      "Draft history keeps every saved revision, ready to preview or restore.",
    ],
  },
  {
    id: "s10",
    title: "Review, then publish",
    lines: [
      "Before publishing, a reviewer pins a note to the cover headline.",
      "Resolve it, require approval, and approve this exact revision.",
      "Publish runs a final checklist, and the magazine goes live.",
    ],
  },
  {
    id: "s11",
    title: "The reader",
    lines: [
      "Readers don't need an account.",
      "Browse thumbnails, or search for a product code.",
      "Open product details, and the studio photo gallery.",
      "Hotspots jump between pages, and the maker's film plays right on the page.",
      "Zoom in, or switch to a flat book, a slide view, or a scrolling reader.",
    ],
  },
  {
    id: "s12",
    title: "On a phone",
    lines: [
      "The same link works on a phone, one page at a time. Swipe to turn.",
      "Or scroll, for comfortable reading.",
    ],
  },
  {
    id: "s13",
    title: "The PDF",
    lines: [
      "Every edition also exports as a PDF.",
      "Ten A4 pages, with selectable text in the uploaded typeface, crisp images, and links that still work.",
      "The film becomes a poster, with a link.",
    ],
  },
  {
    id: "s14",
    title: "Drafts stay private",
    lines: [
      "Drafts stay private. Change a price in the editor, and the live magazine doesn't move until you publish again.",
      "Analytics show reading sessions, page depth and product clicks.",
      "Slow Living. Your catalog, as a magazine, made with Flipbook.",
    ],
  },
];
