# Flipbook — local publishing studio

Create product magazines, edit their pages, publish an interactive book, and export an A4 PDF. One repository, one application container, SQLite, and local files. No cloud accounts or API keys are required.

- [← Repository overview: prerequisites, setup and docs index](../README.md)
- [Product requirements](../docs/PRD.md)
- [Technical design: HLD, LLD, APIs, storage, jobs, security](../docs/TECHNICAL_DESIGN.md)
- [Verification record](VERIFICATION.md)
- [Editor delivery and coverage](EDITOR_DELIVERY.md)

## Start locally

From this `flipbook/` directory of the cloned repository:

```bash
./scripts/install.sh
```

The installer prepares Docker and Compose, builds the application, starts it, and waits for its health check. On macOS it reuses Docker Desktop, or installs Homebrew/Colima when needed. Ubuntu and Debian use Docker’s official package repository. On Windows, run the scripts inside WSL2 with Docker Desktop integration enabled. Administrator prompts or first-launch dialogs may require your input.

If Docker is already running:

```bash
./scripts/start.sh
# Equivalent when Docker CLI and Compose are on PATH:
docker compose up -d --build --wait
```

Open **http://localhost:3000**, choose **Create an account**, and create your local studio. Each new account receives a sample magazine, four reusable products, and sample illustrations. There are no shared default credentials.

To use another port, copy `.env.example` to `.env`, change `FLIPBOOK_PORT`, then run the start script. Existing `.env` files are preserved by the installer.

## What you can do

### Create and edit

- Publication library with search, drafts/published/archived filters, duplication, archiving, and deletion.
- Seven page layouts: cover, product feature, four-product grid, story, chapter divider, closing, and blank.
- Add rich text, images, product cards, links, dividers, vector shapes, galleries, hotspots, video and audio. Select an element to edit it; double-click text for inline editing.
- Shift-select layers, group/ungroup, move/resize together, align/distribute and snap to guides. Layers can overlap, be renamed, reordered, locked or hidden.
- Format selected words with bold/italic/underline/color/links, choose paragraph/list styles and save shared text styles. Pan/zoom image crops, rotate/flip, set opacity/borders/corners and choose frames.
- Reorder, duplicate, add, and remove pages. Undo and redo changes.
- Three themes, reusable brand kits, named styles, page backgrounds and shared master headers/footers/logos/page numbers.
- Image uploads, a reusable product catalog, CSV mapping/preview/atomic import, and generated product pages. Product presentation can be applied to every card.
- Save/reuse page and group templates; preview and restore the latest 100 saved draft revisions.
- Anchored private review notes, resolve/reopen and exact-revision approval, optionally required before publishing.
- Live design checks flag incomplete content, bounds, low-resolution images and visible text overflow.
- Autosave, saved reload, local recovery, and revision-conflict protection across tabs.

### Read like a book

- A centered front cover opens into facing pages: 2–3, 4–5, and so on.
- Curved WebGL paper with two-sided textures, a stable spine, page edges and moving shadows. Drag a page to scrub the turn; reverse a short drag to return it. Nearby pages prewarm and rapid navigation coalesces to the latest destination.
- Hard/soft covers, spiral binding, left-to-right/right-to-left navigation, and warm/light/dark surrounds. Reader preferences survive reload.
- A 2D fallback when WebGL is blocked or lost; selectable HTML and product buttons remain available when the turn finishes.
- A soft page-flip sound after user interaction, with a persistent mute toggle in the reader and editor preview.
- Previous/next and first/last controls, page jump, thumbnails, contents, page-specific URLs, pointer swipes, and keyboard navigation.
- Local search across page text, product descriptions and SKU; no search query leaves the browser.
- Automatic, single or double pages; a slide viewer and scroll/reflow view for larger text.
- 1–3× zoom, fit, drag-to-pan, touch pinch, Ctrl+wheel zoom, and browser fullscreen where supported.
- Opt-in autoplay pauses on manual interaction, hidden tabs and the final page. Browser printing exposes every page and hides reader controls.
- Reduced-motion preference uses instant page changes.
- Product detail dialogs with galleries, merchant links, sharing, and PDF downloads.
- The editor preview uses the same book component as the published reader.

### Publish and export

Publish checks required content, assets, and page fit, then activates an immutable edition. Editing a draft does not change the published edition until you publish again. Unpublish immediately prevents new reader, image, and PDF requests.

PDF export runs in a background Node worker. It embeds images and fonts, retains selectable text and clickable links, and generates one A4 portrait page per magazine page. Product-dialog descriptions and gallery images appear in the PDF only when placed on a page. Rich text, masters, backgrounds, shapes, image frames and product field selections are included. Video/audio export as a poster and clickable HTTPS link. Browser and PDF text wrapping may differ slightly.

Basic analytics include reader sessions, product clicks, page depth, and active reading time. Events remain local and are retained for 30 days.

## Everyday commands

```bash
./scripts/start.sh       # Build/start and wait for health
./scripts/stop.sh        # Stop; retain data
./scripts/logs.sh        # Follow logs
./scripts/doctor.sh      # Runtime, configuration and service status
./scripts/backup.sh      # Briefly stop, archive data, restart if previously running
```

Data lives in the `flipbook-data` named Docker volume, including SQLite, sessions, assets, version documents, exports, and the event-signing secret. Backups are written under `backups/`. Backups contain account and publication data; keep them private. Normal `docker compose down` preserves data. **`docker compose down -v` deletes it.**

For disaster recovery, restore the complete archive into a new, empty Docker volume while the application is stopped, then configure Compose to mount that volume at `/app/data`. Preserve the `node` user ownership (UID 1000) and include `.secret` and all asset/export files. Do not restore just the SQLite main file from a live database; WAL files may contain committed changes.

## Lightweight runtime

| Component | Choice |
|---|---|
| Backend | Node.js 24, Express 5 |
| Frontend | React 19, Vite |
| Database | Built-in Node SQLite, WAL mode |
| Files | One local volume |
| Jobs | SQLite queue; one active worker |
| PDF | PDFKit and Sharp, no browser process |
| Runtime containers | One |
| Container limits | 1 GiB memory, 2 CPUs |
| Suggested Docker VM | 2 CPUs, 4 GiB RAM |

These are configuration targets, not measured minimum hardware requirements. Initial builds need internet access; normal local editing and export work without external services. The default port binds only to your computer. A localhost reader link is not a publicly hosted website.

## Development without Docker

Install **Node.js 24** and npm, then:

```bash
npm ci
npm run dev
```

The editor runs at http://localhost:5173 and the API/reader at http://localhost:3000. Vite proxies API, reader, and font requests. Stop with Ctrl+C. Production-style native execution:

```bash
npm run build
npm start
```

Native data defaults to `./data`. Optional environment variables: `DATA_DIR`, `PORT`, `HOST`, and `PUBLIC_URL`. Keep `HOST=127.0.0.1` for local use. Docker supplies its own bind host and data path.

## Automated tests

### Frontend, backend, document, and API tests

```bash
npm ci
npm test                    # All unit and API integration checks
npm run test:frontend       # React, geometry, drag, reader tools, sound, API client
npm run test:backend        # Auth, sessions, CSRF, origin policy, HTML escaping
npm run test:unit           # Frontend + backend + shared document contracts
npm run test:integration    # Real HTTP, SQLite, publishing, PDF jobs
```

Frontend/backend units use Vitest; component tests use jsdom and React Testing Library. Animation completion and audio are controlled in unit fixtures, while Playwright checks the real browser behavior. Integration tests create temporary databases and accounts, exercise real HTTP endpoints and PDF jobs, then remove their own temporary data. Tests do not reuse your studio database.

### Playwright browser tests

```bash
npm ci
npx playwright install chromium --only-shell
npm run test:e2e
npm run test:report
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium --only-shell`. For visible browser runs, install the full browser using `npx playwright install chromium`, then `npm run test:e2e:headed`.

The suite builds the client and starts an isolated server on port 4179. Set `PLAYWRIGHT_PORT` to change that test port. An existing server on the test port is deliberately not reused. It runs desktop and phone Chromium projects with one worker to keep memory use modest.

Coverage includes the full edit → autosave → reload → preview → publish → read → download journey; page templates/order/undo; concurrent-edit protection; image upload/product reuse; validation; facing-page animation; keyboard/deep links; product dialogs; scroll mode; odd/single-page books; mobile touch swipe/resize; rapid navigation; gesture-driven sound and mute persistence; preview product dialogs; fullscreen and sharing. Added cases require WebGL for held-drag/rollback evidence and cover thumbnails/contents/search, persisted RTL/view options, zoom/pinch, autoplay, print and blocked-WebGL fallback. Every case rejects uncaught browser errors.

HTML reports are in `playwright-report/`; failure traces, videos, screenshots, and successful reader screenshots are in `test-results/playwright/`. Open a trace with `npx playwright show-trace <trace.zip>`.

### Run all checks inside Docker

```bash
./scripts/test.sh
```

This optional test image uses Microsoft’s version-matched Playwright image, which includes browser binaries and their system dependencies. It is a larger, development-only download. It is separate from the lightweight application image and does not run during normal startup. It mounts test sources read-only, uses temporary databases, publishes no ports, and writes reports to `test-results/docker/`. Open its HTML report with `npx playwright show-report test-results/docker/html`. The test container has a 2 GiB memory cap and is removed on completion. Its cached image remains for future runs.

## Limits and next releases

Authoring targets desktop browsers; the published reader supports phones. The MVP supports a single local installation and personal workspaces, with up to 100 pages per magazine. Uploads are static JPEG/PNG/WebP, at most 20 MiB and 40 megapixels. Each account has a 1 GiB media budget.

The current editor uses English/Latin font fixtures. Wider-script typography, PDF import, team collaboration, ecommerce connectors, embedding, password-protected readers, scheduled publishing, and internet hosting are later-release work. RTL page navigation is available; it does not imply localized controls or full non-Latin typesetting. This implementation does not include checkout or payment processing. The [PRD feature comparison](../docs/PRD.md#19-dearflip-reference-review-and-delivery-scope) records implemented reader features separately from future PDF/image imports, embeds and platform plugins.

## Troubleshooting

- **Docker unavailable:** open Docker Desktop or run `colima start --cpu 2 --memory 4`, then `./scripts/doctor.sh`.
- **Docker command missing:** the scripts detect Docker Desktop’s bundled CLI even when it is absent from PATH.
- **Port occupied:** change `FLIPBOOK_PORT` in `.env` and restart.
- **Build cannot download a base image:** check Docker’s internet/proxy/registry access, then retry. Application installation is not complete until the image builds and health passes.
- **Publish needs attention:** select each checklist item to find missing images/text or a block that needs more room.
- **Conflicting edits:** use **Save my copy** to preserve your local changes, or **Use saved version** to reload the server draft.
- **PDF still preparing:** wait for the job to finish. Failed jobs expose a retry action in the editor.
- **3D unavailable or slow:** choose **View options → 2D book** or **Scroll reader**. The GPU renderer loads only when needed and automatically falls back after a context or snapshot failure. First use may briefly keep the existing page visible while fonts/images are prepared.
- **Playwright blocked by a desktop sandbox:** run `./scripts/test.sh`, or run the native test command from your own terminal where Chromium can start.


## Advanced editing guide

**Fonts:** every font picker (brand heading/body, text styles and text elements) offers 14 built-in fonts, grouped as sans serif, serif, display, handwriting and monospace. All of them load in the reader and embed in the PDF. **Your own fonts:** in **Page design & brand → Brand kit**, upload a TTF, OTF or WOFF (up to 5 MB). It then appears as "(uploaded)" in every font picker, loads in the reader and is embedded in the PDF. WOFF2 files and fonts whose licence forbids embedding are refused. **Master margins:** select a master in the same dialog and set its page margins; pages using it show a dashed guide, snap and align to it, and warn when content crosses it. **Icons:** add an **icon** from the toolbar, search the library, then set its color, line weight and optional description. **Product images:** in **Product presentation**, choose a single image, a main image with thumbnails, or an image grid.

Use **Page design & brand** for backgrounds, fonts/colors/logo, and shared masters. In master text, `{{page}}`, `{{pages}}` and `{{publisher}}` resolve per page. **Reusable designs** saves page templates, selected groups or brand kits as independent copies. **Import catalog** previews and maps a CSV before importing; its image column accepts an existing uploaded filename or asset ID. After import, generate grid or feature pages.

The left **Layers** panel handles overlapping elements. Shift-click layers to multi-select; the canvas toolbar groups, aligns, distributes and changes order. The inspector edits the first selected element. Group drag/resize affects the whole selection; locks prevent edits. Crop preview supports dragging; the focus and zoom sliders offer precise adjustments. **Appearance & transforms** contains frame, border, radius, opacity, rotation and flip controls.

Select words in **Your words**, then use the rich-text toolbar. Named styles are shared: apply a style, adjust local settings and use **Update shared style** to propagate those settings to other linked elements. Use **Draft history** to preview/restore a saved revision. **Review & approval** anchors notes to the current page/element and can require approval before publish. Editing after approval requires approving the new saved revision.

Shortcuts outside text fields/dialogs: Ctrl/Cmd+A selects all; C/X/V copy/cut/paste across pages; D duplicates; Z/Shift+Z or Y undo/redo; arrows nudge (Shift for a larger step); Delete removes; Escape deselects. This clipboard stays within the open editor session.

Review notes and media controls are private authoring / reader features respectively; generated PDFs contain neither private review notes nor playable media. HTTPS media playback requires a reachable host and a browser-supported format. Fonts remain bundled locally. See [editor delivery and coverage](EDITOR_DELIVERY.md) for the complete feature matrix.
