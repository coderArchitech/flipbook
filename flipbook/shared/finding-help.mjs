// Plain-language explanations for validation findings: what went wrong, why
// it matters and how to fix it. Matched on the finding message, so findings
// from the editor, the server and older servers all get help. `server: true`
// marks problems a server running older code than the editor can cause.
const RESTART =
  "If Flipbook was updated recently, restart the server (Ctrl+C then npm start, or docker compose up --build -d) and reload this page.";
const HISTORY =
  "If you can't find the cause, open Draft history and restore the last revision that saved.";

const HELP = [
  {
    match: "Unsupported document or theme.",
    title: "The server rejected the draft's structure",
    why: "Older Flipbook servers use this one message for five different problems. By far the most common is a server started before the editor was updated: the editor saves a newer document format that the old server doesn't recognise. The other causes are more than 100 pages, an unknown theme, or a damaged draft.",
    steps: [
      RESTART,
      "After restarting, this finding is replaced by a specific one if anything is still wrong.",
      "Check the magazine has at most 100 pages and that a theme is selected in the Publication tab.",
      HISTORY,
    ],
    server: true,
  },
  {
    match: /^Document format .* is not supported by this server\.$/,
    title: "The server is older than the editor",
    why: "The editor saved this draft in a newer document format than the server understands. This happens when the editor was updated but the server process kept running the previous version.",
    steps: [RESTART, HISTORY],
    server: true,
  },
  {
    match: "The draft could not be read.",
    title: "The draft is empty or damaged",
    why: "The server received something that isn't a Flipbook document, so nothing else could be checked.",
    steps: ["Reload the page to fetch the last saved draft.", HISTORY],
  },
  {
    match: "The draft has no page list.",
    title: "The draft has no pages list",
    why: "Every publication stores its pages as a list. This draft is missing it, usually because it was damaged or edited outside Flipbook.",
    steps: ["Reload the page.", HISTORY],
  },
  {
    match: /^This magazine has \d+ pages; the limit is \d+\.$/,
    title: "Too many pages",
    why: "A publication can have at most 100 pages, so readers and PDF export stay fast.",
    steps: [
      "Delete pages you don't need (select a page, then Delete page).",
      "To keep everything, duplicate the publication from your library (… → Duplicate) and split the pages between the two copies.",
    ],
  },
  {
    match: /^Theme .* is not available\.$/,
    title: "Unknown theme",
    why: "The draft refers to a theme this server doesn't have.",
    steps: [
      "Open the Publication tab in the right-hand panel and choose a Theme.",
      RESTART,
    ],
    server: true,
  },
  {
    match: "Unsupported block type.",
    title: "Element type not supported by the server",
    why: "The page contains a kind of element the server doesn't recognise. New element types (such as icons) need an up-to-date server.",
    steps: [
      RESTART,
      "Otherwise, select the element and delete it, then add it again from the toolbar.",
    ],
    server: true,
  },
  {
    match: /^Choose an approved (brand )?font\.$/,
    title: "Font not available",
    why: "The text uses a font this server doesn't know: an uploaded font that was deleted, or a newly added built-in font on a server that hasn't been restarted.",
    steps: [
      "Select the element and choose another font in Text font (for brand fonts: Page design & brand → Heading font / Body font).",
      RESTART,
    ],
    server: true,
  },
  {
    match: "Add a title, publisher, and at least one page.",
    title: "Publication details are missing",
    why: "Readers see the title and publisher in the reader bar and the PDF.",
    steps: [
      "Type a title in the box at the top of the editor.",
      "Open the Publication tab in the right-hand panel and fill in Publisher / brand.",
      "Make sure there's at least one page (Add page).",
    ],
  },
  {
    match: "Add content or remove this empty page.",
    title: "Empty page",
    why: "Blank pages look like a mistake in the reader and PDF.",
    steps: [
      "Add an element from the toolbar, or apply a template.",
      "Or remove the page with Delete page.",
    ],
  },
  {
    match: "Add text or remove this empty block.",
    title: "Empty text box",
    why: "An empty text box publishes as blank space.",
    steps: [
      "Select the text box and type its text, or remove it with Delete selected block.",
    ],
  },
  {
    match: "Add an image and description, or mark it decorative.",
    title: "Image needs a picture and a description",
    why: "Screen-reader users hear the description in place of the image. Purely decorative images can be skipped by screen readers instead.",
    steps: [
      "Select the image and choose a picture if it's empty.",
      "Fill in Image description, or tick Decorative image if it carries no information.",
    ],
  },
  {
    match:
      /^Add a (description for your product|product name, summary, and image)\.$/,
    title: "Product details are incomplete",
    why: "Product cards and the reader's product dialog need a name, a short description and at least one image.",
    steps: [
      "Select the product card and fill in Product name and Short description.",
      "Add an image with Add product image.",
    ],
  },
  {
    match:
      /^Add gallery images and their descriptions\.$|^Choose up to 12 gallery images/,
    title: "Gallery images need attention",
    why: "A gallery shows 1–12 images, and each one needs a description for screen readers.",
    steps: [
      "Select the gallery, add images, and fill in each Gallery image description.",
      "Remove images beyond the twelfth.",
    ],
  },
  {
    match: "Add a hotspot label and destination.",
    title: "Hotspot is incomplete",
    why: "A hotspot needs a label (read aloud to screen-reader users) and somewhere to go.",
    steps: [
      "Select the hotspot, fill in Hotspot label, and choose a Hotspot destination: a URL, a product or a page.",
    ],
  },
  {
    match:
      /^Add (a media title and description|valid media type, HTTPS URL, title and description)\.$/,
    title: "Video or audio is incomplete",
    why: "Media needs a type, an HTTPS address, a title and a description so it can play in the reader and appear as a link in the PDF.",
    steps: [
      "Select the media element and fill in Media type, Media URL (HTTPS), Media title and Media description.",
    ],
  },
  {
    match: /links must (use HTTPS|be a valid HTTPS URL)\.$/,
    title: "Link isn't a secure web address",
    why: "Links in published magazines must start with https:// so they are safe to open.",
    steps: [
      "Select the element and change the link (Destination URL, Hotspot URL, Product URL or Selection link) to an address starting with https://.",
    ],
  },
  {
    match:
      /^(Hotspot page|Hotspot product|Master page|Named style) is no longer available\.$/,
    title: "Points to something that was deleted",
    why: "This element refers to a page, product, master or named style that no longer exists.",
    steps: [
      "Select the element and choose an existing target (Hotspot destination, Page master or Named text style), or clear the setting.",
    ],
  },
  {
    match:
      /^(Image is not available in this workspace|An image is no longer available|Invalid image reference)\.$/,
    title: "Image is missing",
    why: "The element uses an image that was deleted or belongs to another workspace.",
    steps: [
      "Select the element and choose the image again from your uploads, or upload it again.",
    ],
  },
  {
    match: "A font is no longer available.",
    title: "Uploaded font is missing",
    why: "The publication uses an uploaded font that was deleted.",
    steps: [
      "Upload the font again in Page design & brand, or switch the affected text and brand fonts to another font.",
    ],
  },
  {
    match:
      /^Use at most \d+ (blocks per page|blocks on a master page|master pages|named styles)\.$/,
    title: "Over the element limit",
    why: "Limits keep pages fast to edit, read and export.",
    steps: [
      "Delete or combine elements (or masters / styles), or move some content to another page.",
    ],
  },
  {
    match:
      /^(Text exceeds the supported length|Publication exceeds the 2 MiB document limit)\.$/,
    title: "Too much content",
    why: "A single text element or the whole draft is larger than Flipbook allows.",
    steps: [
      "Split long text across several text boxes or pages.",
      "Remove unused pages and elements.",
    ],
  },
  {
    match: "Choose up to 8 product images.",
    title: "Too many product images",
    why: "A product can have at most 8 images.",
    steps: ["Select the product and remove the extra images."],
  },
  {
    match: "Keep blocks inside the page grid.",
    title: "Element is off the page",
    why: "Part of the element is outside the page area.",
    steps: ["Drag the element back onto the page or make it smaller."],
  },
  {
    match: "Element is outside the master page margins.",
    title: "Element crosses the page margins",
    why: "The page's master defines margins; content outside them may be trimmed in print or look misaligned. This is a warning and doesn't block publishing.",
    steps: [
      "Move or resize the element inside the dashed margin guide.",
      "Or change the margins in Page design & brand.",
    ],
  },
  {
    match: "Rotated element extends beyond the page.",
    title: "Rotated element sticks out",
    why: "Once rotated, the element's corners go past the edge of the page.",
    steps: ["Reduce its Rotation, make it smaller, or move it inwards."],
  },
  {
    match: /may look soft in print/,
    title: "Low-resolution image",
    why: "The image has too few pixels for its printed size, so it will look blurry in the PDF.",
    steps: [
      "Upload a larger version of the image, or make the element smaller.",
    ],
  },
  {
    match:
      /^(Content does not fit|Text overflow created an extra PDF page|Some content does not fit on its page)/,
    title: "Content doesn't fit",
    why: "Text runs past the bottom of its box, so it would be cut off in the PDF.",
    steps: [
      "Shorten the text, reduce Text size or Line spacing, or make the box taller.",
    ],
  },
  {
    match: /^(Page|Block) IDs must be unique\.$/,
    title: "Duplicate internal IDs",
    why: "Two pages or elements share an internal ID, usually after a draft was edited outside Flipbook.",
    steps: [
      "Delete the duplicated page or element and recreate it (Duplicate page creates fresh IDs).",
      HISTORY,
    ],
  },
  {
    match: /^(Enter a nonnegative price|Use a three-letter currency code)/,
    title: "Price or currency is invalid",
    why: "Prices must be zero or more with up to 3 decimals, and currencies a three-letter code such as EUR or USD.",
    steps: ["Select the product and correct Price or Currency."],
  },
  {
    match:
      /^Choose (a background image|two gradient colors and a valid angle)\.$/,
    title: "Page background is incomplete",
    why: "The page background type needs an image or two gradient colours.",
    steps: [
      "Open Page design & brand and pick a background image or both gradient colours, or change Background type.",
    ],
  },
  {
    match:
      /^(Unsupported image frame|Choose a supported shape|Choose a supported icon, color and line weight)\.$/,
    title: "Unsupported option",
    why: "The element uses a frame, shape or icon this server doesn't know.",
    steps: [
      "Select the element and pick another option from its list.",
      RESTART,
    ],
    server: true,
  },
  {
    match: "Blocks overlap. Move or resize one of them.",
    title: "Elements overlap",
    why: "On a classic-layout page, two elements share the same grid space, so one would hide the other.",
    steps: ["Move or resize one of the elements so they no longer overlap."],
  },
  {
    match:
      /^(The CSV file is empty|CSV (exceeds the 2 MiB limit|has too many columns|contains an unclosed quoted field|column names must be nonempty and unique)|A quoted CSV field must start with a quote|Unexpected text after a closing quote)\.$/,
    title: "The CSV file can't be read",
    why: "Catalog import needs a comma-separated file with one header row of unique column names, under 2 MiB.",
    steps: [
      "Export the sheet again as CSV (UTF-8) from your spreadsheet app.",
      "Check that quoted values open and close with a double quote, and that every column has a unique name.",
    ],
  },
  {
    match:
      /^(Map a product name column|Map each CSV column to only one product field|Import at most 200 products at a time)\.$/,
    title: "Catalog import settings need attention",
    why: "Each product needs a name, each CSV column can feed one product field, and one import holds at most 200 products.",
    steps: [
      "In Import catalog, map one column to the product name and don't map a column twice.",
      "Split larger catalogs into several CSV files of up to 200 rows.",
    ],
  },
  {
    match:
      /^(PDF exceeds the 100 MB export limit|PDF worker exited before completing)/,
    title: "PDF export failed",
    why: "The PDF grew too large or the export process stopped, usually because of many very large images.",
    steps: [
      "Retry the export.",
      "Use smaller images (around 2000 px on the long side is plenty for A4), or split the publication.",
    ],
  },
  {
    match: "SKU is duplicated within this import.",
    title: "Duplicate SKU",
    why: "Two rows in the CSV have the same SKU / code, so products can't be told apart.",
    steps: ["Give each row a unique SKU in the CSV and import again."],
  },
  {
    match: "Complete the publication checklist.",
    title: "Publishing checklist incomplete",
    why: "Publishing stops until every item in the checklist is fixed.",
    steps: ["Fix the other issues in this list, then publish again."],
  },
  {
    match: "Rendering exceeded the 180 second limit.",
    title: "Export took too long",
    why: "Very large or many high-resolution images can make rendering slow.",
    steps: [
      "Retry the export.",
      "If it keeps failing, use smaller images or fewer pages.",
    ],
  },
  {
    match:
      /^(Rich text and its plain-text copy must match|Invalid rich text)\.$/,
    title: "Text formatting is damaged",
    why: "The text's formatting data doesn't match its content.",
    steps: [
      "Select the text box, retype or paste its text, and save.",
      HISTORY,
    ],
  },
  {
    match: /^Invalid /,
    title: "A setting has an unexpected value",
    why: "One of this element's or page's settings has a value Flipbook doesn't accept. This usually means the server is older than the editor, or a draft was edited outside Flipbook.",
    steps: [
      "Use Undo, or select the element and set the named setting again.",
      RESTART,
      HISTORY,
    ],
    server: true,
  },
];

const FALLBACK = {
  title: "Needs attention",
  why: "Flipbook found a problem it has no specific guidance for.",
  steps: ["Select the affected element and review its settings.", HISTORY],
};

export function findingHelp(message = "") {
  // Catalog-import messages are prefixed with their CSV row.
  const text = String(message).replace(/^Row \d+: /, "");
  const entry = HELP.find((h) =>
    typeof h.match === "string" ? h.match === text : h.match.test(text),
  );
  return { server: false, ...(entry || FALLBACK), known: !!entry };
}
