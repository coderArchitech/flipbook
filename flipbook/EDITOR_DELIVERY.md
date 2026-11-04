# Advanced editor delivery tracker

Goal: implement the editor features E01–E19, update PRD/technical design, and verify unit/API/Playwright/PDF behavior. No feature is considered delivered solely because its design is documented.

PRD v1.2 and technical design v4.0 define the complete scope. Existing local data and immutable publications must be preserved.

Status reviewed against source on 28 October 2026. **Implemented** = editor UI, persistence, reader HTML and PDF output exist and a browser test exercises it. **Partial** = works, with the gap noted.

| ID | Feature | Status | Notes / gaps | Browser evidence (`tests/e2e/editor.spec.mjs`) |
|---|---|---|---|---|
| E01 | Rich text | Implemented | Bold/italic/underline/color/HTTPS links on selected words, bullet/numbered lists, line height, letter spacing. Formatting is applied from the inspector textarea selection, not WYSIWYG on the canvas. | Rich formatting, styles, layers… |
| E02 | Layers | Implemented | Layer list, rename, lock, hide; reorder via **Arrange layers** (front/forward/backward/back), not drag in the list. | Rich formatting, styles, layers… |
| E03 | Multi-select and groups | Implemented | Shift-select, Ctrl/Cmd+A, group/ungroup, bounded group move/resize. | Rich formatting…; drag previews snap guides… |
| E04 | Alignment and guides | Implemented | Align to selection or (single element) page edges/centres; distribute; snap to page edges/centre and neighbour edges/centres with visible guides. | Drag previews snap guides… |
| E05 | Image editing | Implemented | Drag-to-pan crop, focus/zoom sliders, rotation, flip, opacity, border, radius. | Image crop, frame, gallery… |
| E06 | Cross-page clipboard | Implemented | Copy/cut/paste/duplicate with fresh IDs across pages; in-app clipboard only (not OS clipboard, not across publications). | Rich formatting… cross-page clipboard |
| E07 | Styles and brand kit | Implemented | Named styles with propagation, brand colors, logo, reusable kits, 14 built-in fonts in a grouped picker (`shared/fonts.mjs`), plus uploaded TTF/OTF/WOFF fonts (licence-checked; WOFF2 refused) usable in brand and text styles, loaded in the reader and embedded in the PDF. | features-editor: E07 (built-in and custom); `tests/fonts-api.test.mjs`; `tests/backend/builtin-fonts.test.mjs` |
| E08 | Page backgrounds | Implemented | Solid, gradient, full-page image with crop and color overlay. | Backgrounds, brand, masters… |
| E09 | Master pages | Implemented | Shared header/footer/logo/page-number/publisher tokens; apply per page or to all pages; master page margins as non-printing guides with snapping, page alignment and an out-of-margin warning. | Backgrounds, brand, masters…; features-editor: E09 |
| E10 | Shapes and decorations | Implemented | Seven shapes with fill/border plus a searchable 47-icon library (Lucide, ISC) with color, line weight and optional accessible description; identical strokes in HTML and PDF. | features-editor: E10 |
| E11 | Product presentation | Implemented | Field visibility, price size/color, badge/card colors, apply to all product cards. | CSV mapping… product presentation |
| E12 | Bulk catalog | Implemented | CSV parse, column mapping, row preview/validation, atomic import (≤200 rows), grid/feature page generation. Images must reference existing uploads. | CSV mapping, preview, atomic import… |
| E13 | Image frames and galleries | Implemented | Rectangle/circle/ellipse/diamond frames, ordered galleries (≤12 images) with reader lightbox, and product cards with single, thumbnails or grid image layouts on the page and in the PDF. | Image crop, frame, gallery…; features-editor: E13 |
| E14 | Hotspots | Implemented | Overlay layer opening a URL, page or product dialog; PDF uses link/goTo annotations. | Image crop… internal hotspots |
| E15 | Live layout checks | Implemented | Debounced missing-content, out-of-bounds (incl. rotation), low-resolution and rendered text-overflow warnings; clicking focuses the layer. | Drag previews… live overflow checks |
| E16 | Version history | Implemented | Latest 100 saved revisions, preview, restore as a new revision. | Review notes… history restores |
| E17 | Custom templates | Implemented | Save page or selection group (and brand kit) to the library; reuse with fresh IDs. | Backgrounds… reusable templates |
| E18 | Comments and review | Implemented | Page/element-anchored notes, resolve/reopen, exact-revision approval, optional approval-gated publish. Single-owner workspace only. | Review notes gate publishing… |
| E19 | Video and audio | Implemented | HTTPS media, native controls, no autoplay, poster; PDF shows poster + clickable link. | Image crop… media… publish with PDF |

All visual features share one document model (schema 2) across editor, reader HTML and PDFKit output. Interactive blocks have explicit static PDF forms: hotspots → link/goTo annotations, galleries → static tiles, video/audio → poster plus link.

## Verification — 28 October 2026

Native run on macOS, Node 24.16.0, Playwright Chromium headless shell 1248:

- Vitest: 16 files, **85 tests passed**.
- Shared document contracts: **8 passed**.
- Real HTTP/SQLite/PDF integration: **16 passed**.
- Playwright (desktop + Pixel 7): **28 passed**, 0 failed, run without retries.

Logs: `../../work/fix-unit-api.log`, `../../work/fix-e2e.log`.

### Per-feature acceptance — `tests/e2e/features-editor.spec.mjs`

One focused case for each **Implemented** feature (E01–E06, E08, E11, E12, E14–E19). Each drives the real editor controls, then checks the persisted draft after reload, the published reader DOM and, where the feature has a PDF form, the exported PDF (link annotations / successful export). Highlights beyond the earlier combined cases: inline marks stay scoped to the selected words; hidden layers are absent from the reader and locked layers resist Delete/arrow keys; grouped elements move together; distribute produces equal gaps; crop/transform styles match in editor and reader; cut/paste/duplicate keep styles with fresh IDs; product presentation hides price for every card while each keeps its own SKU; an invalid CSV row blocks import; URL/product/page hotspots over an image all work; each live warning type appears and focuses its layer; restoring history keeps the newer revision; saved groups are reused in another publication with a fresh group ID; review notes are pinned to an element and never appear in the reader; video has controls, no autoplay and a PDF link.

Result: full Playwright run **43 passed** (28 existing + 15 new); new file repeated twice, **30/30 passed**. Unit/API unchanged and passing. Logs: `../../work/features-e2e.log`, `../../work/features-repeat.log`.

Bug found and fixed by these cases: when the server rejected a draft as invalid (e.g. an `http://` media URL), the editor showed "Save interrupted · retrying" and resent the same invalid draft every few seconds. It now shows "Not saved — fix the highlighted issue" and does not resend that draft until it changes (`client/main.jsx`).

Fixes in this pass:

- `tests/e2e/editor.spec.mjs`: the crop drag used raw mouse coordinates while the inspector had scrolled the preview off-screen, so the drag never reached it. The test now scrolls the preview into view first.
- `public/paper-renderer.js`: the off-screen 3D texture snapshot clone was inert but not `aria-hidden` and kept element IDs, briefly duplicating buttons/IDs in the accessibility tree while pages pre-rendered. It now matches the other reader clones (aria-hidden, IDs and page labels stripped).

## Remaining work

- Docker image rebuild/health check and refresh of `VERIFICATION.md` and the source archive (`../flipbook-local.zip`) for this release.
- Possible follow-ups beyond the original scope: deleting uploaded fonts (blocked today so published editions never lose a font), real bold/italic families for uploaded fonts, and per-page margin overrides.

## Previously partial features — 28 October 2026

E07, E09, E10 and E13 are now fully implemented; all 19 features are **Implemented**. Design notes are in the technical design ("Brand fonts, master margins, icons and product image layouts").

- Unit: `tests/backend/partial-features.test.mjs` — 6 cases covering validation, font ID collection, margin snapping/alignment/warnings, icon and product HTML, and a rendered PDF that embeds the uploaded font and draws three product tiles and round-capped icon strokes.
- Real API: `tests/fonts-api.test.mjs` — WOFF and TTF accepted; WOFF2, junk and a no-embedding licence refused; another account cannot read or reference the font; the reader serves it only for the live version and stops after unpublish; the exported PDF embeds it.
- Browser: E07, E09, E10 and E13 cases in `tests/e2e/features-editor.spec.mjs`, each through editor → reload → published reader → PDF.
- Visual check: a rendered PDF page and reader/editor screenshots showed the uploaded italic face, thumbnails/grid product cards, icons and the dashed margin guide (editor only).

Bug found while testing: the upload licence check first read OS/2 `fsType` as a number, but fontkit returns named flags, so restricted fonts would have been accepted. Fixed before release and covered by the API test.

Result: Vitest **91 passed**; document contracts **8 passed**; API integration **20 passed**; Playwright **47 passed** (desktop + Pixel 7) with no retries; features file repeated twice **38/38**; `npm audit --omit=dev` 0 vulnerabilities. Logs: `../../work/partial-unit-api.log`, `../../work/partial-e2e.log`, `../../work/partial-repeat.log`.

New dependency: `fontkit` 2.0.4 pinned as a direct dependency (it was already installed as PDFKit's font parser).
