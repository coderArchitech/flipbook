# Flipbook — Product Requirements Document

> **Document status:** Draft for product and design review  
> **Version:** 1.2 — editor expansion  
> **Last updated:** 27 October 2026

## 1. Product overview

**Flipbook** is a digital publishing tool for creating polished, page-based product magazines. A creator selects a page template, adds product details and images, edits the copy in a visual editor, and publishes a shareable digital magazine. The same publication can be exported as a PDF for offline viewing, printing, or distribution.

The published magazine should feel editorial and visual while making it easy for readers to discover products and take an action, such as visiting a product page or contacting the publisher. It should work well on mobile, tablet, and desktop.

### Product vision

Let any team turn a product catalog into a beautiful, easy-to-share digital magazine without needing design software or a developer.

### One-line value proposition

Create, publish, share, and export a shoppable digital product magazine from reusable page templates.

## 2. Problem and opportunity

Product information is often spread across spreadsheets, product pages, PDFs, and image folders. Teams that want a curated, story-led presentation must manually assemble and update those materials in design tools. The result is time-consuming to produce, difficult to keep current, and often poorly suited to phones or interactive product discovery.

Flipbook gives creators a guided editor and reusable layouts, then publishes the result as both an interactive reading experience and a downloadable PDF.

## 3. Goals and non-goals

### Goals

- Enable a non-designer to create a polished product magazine using page templates.
- Make editing text, images, product details, and page order straightforward.
- Support product-focused pages with images, descriptions, prices, links, and calls to action.
- Publish a responsive, shareable digital reader.
- Export a PDF that preserves the publication’s content and visual hierarchy.
- Help creators understand whether readers viewed the magazine and interacted with products.
- Provide reliable autosave and safe recovery from common editing mistakes.

### Non-goals for the initial release

- Replacing a full graphic-design suite or desktop-publishing application.
- Building a checkout, inventory-management, or order-fulfillment system.
- Providing a complete ecommerce catalog platform.
- Supporting unrestricted HTML/CSS or arbitrary code in page layouts.
- Guaranteeing press-ready CMYK, bleed, or printer-specific packaging in the MVP.
- Generating original product photography or copy with AI as a launch requirement.

## 4. Target users and jobs to be done

### Primary users

1. **Small business owner or retailer** — needs to create a seasonal lookbook or product guide without hiring a designer.
2. **Marketing or ecommerce manager** — needs to curate products into a campaign or collection and distribute it across channels.
3. **Brand or catalog editor** — needs to maintain product content and produce consistent publications across launches.

### Reader

The reader is a prospective customer opening a magazine link on a phone, tablet, or desktop. They want to browse quickly, understand the products, and reach the relevant product page or contact channel.

### Core jobs

- “When a new collection is ready, help me turn product information and images into a branded magazine quickly.”
- “When I need a different presentation, help me choose a page layout and make it my own.”
- “When my catalog changes, help me update the magazine without rebuilding every page.”
- “When I share the magazine, help my audience browse it on any device and reach the products.”
- “When someone needs an offline copy, let me download a readable PDF.”

## 5. Product principles

- **Content first:** product information should be easy to add, edit, and verify.
- **Templates as a starting point:** layouts should guide users while allowing meaningful customization.
- **Responsive by default:** the digital publication should remain usable on narrow screens.
- **One source, two outputs:** the reader and PDF should use the same publication content.
- **Safe editing:** autosave, undo, and clear publication status should prevent accidental loss or confusion.
- **Accessible publishing:** keyboard access, readable contrast, and image descriptions are part of the core experience.

## 6. Key concepts

- **Workspace:** the organization or personal account where publications and assets are managed.
- **Publication:** a named magazine with settings, pages, a cover, a reader URL, and export options.
- **Page:** one ordered canvas within a publication, created from a template or blank layout.
- **Block:** an editable content element on a page, such as text, image, product card, button, or divider.
- **Product:** reusable structured content such as name, description, image, price, SKU, and destination URL.
- **Template:** a reusable page layout with defined block positions and styling.
- **Draft:** the editable, unpublished state of a publication.
- **Published version:** a snapshot that readers can access at the publication’s share URL.

## 7. Core user journeys

### Journey A: Create and publish a magazine

1. User signs in and creates a publication.
2. User enters a title, chooses a theme, and uploads a cover image or selects a cover template.
3. User adds pages from the template gallery, duplicates a page, or starts with a blank page.
4. User adds products manually or imports product data from a supported file.
5. User edits page text and product details, arranges blocks, and previews the reader experience.
6. User reviews publication settings and publishes.
7. User copies a share link, downloads the PDF, or shares the publication through available channels.

### Journey B: Update an existing publication

1. User opens a draft or chooses to edit the current publication.
2. User changes text, images, product data, pages, or theme settings.
3. Changes autosave to the draft.
4. User previews changes and publishes an updated version.
5. The reader sees the latest published version; the editor retains the prior version for recovery or comparison.

### Journey C: Browse and act as a reader

1. Reader opens a share link without needing an account.
2. Reader browses pages with swipe, scroll, and page navigation controls.
3. Reader opens a product detail or follows a product call to action.
4. Reader can share the publication or download its PDF if those options are enabled.

## 8. Functional requirements

Priority labels: **P0** = required for MVP; **P1** = important follow-up; **P2** = later opportunity.

### 8.1 Account, workspace, and publication management

- **P0** Create an account and sign in using a supported authentication method.
- **P0** Create, rename, duplicate, archive, and delete a publication, with a confirmation step for deletion.
- **P0** Show a workspace library with publication title, thumbnail, status, last edited date, and owner.
- **P0** Distinguish Draft, Published, and Archived states.
- **P1** Invite collaborators with workspace roles such as Owner, Editor, and Viewer.
- **P1** Provide publication-level access controls: unlisted link, password protection, or private access.

### 8.2 Publication setup and theme

- **P0** Set publication title, subtitle, author/brand name, language, and cover.
- **P0** Select a theme with a small set of coordinated fonts, colors, and background styles.
- **P0** Preview the publication using the selected theme before publishing.
- **P1** Add a brand logo, brand colors, and custom fonts from supported formats or a managed font library.
- **P1** Set publication metadata such as description, social sharing image, and browser title.

### 8.3 Visual editor

- **P0** Provide an editor with a page canvas, page list or thumbnails, template picker, and contextual properties panel.
- **P0** Add, delete, duplicate, and reorder pages.
- **P0** Add pages from templates, including cover, product feature, product grid, editorial/story, category divider, and closing/contact page.
- **P0** Edit text blocks in place, including headings, body copy, captions, and button labels.
- **P0** Add, replace, crop, reposition, and remove images; preserve the original uploaded asset.
- **P0** Add and edit product blocks with structured product fields.
- **P0** Reposition and resize supported blocks within template constraints.
- **P0** Support undo and redo for common edits, and show clear save status.
- **P0** Autosave changes and recover the last saved draft after a reload or session interruption.
- **P0** Provide a preview mode that hides editing controls and approximates the reader experience.
- **P1** Allow users to save a customized page as a reusable workspace template.
- **P1** Add alignment guides, snapping, and block layering controls.
- **P2** Support comments, suggestions, and collaborative review directly on pages.

### 8.4 Product content and catalog input

- **P0** A product has a name, short description, optional long description, one or more images, and an optional destination URL.
- **P0** Support optional price, currency, SKU or product code, category, and badge/label.
- **P0** Let a user add a product directly from the editor and select it for a product block.
- **P0** Validate URLs and identify missing required fields before publishing.
- **P1** Import products from CSV using a column-mapping step and a preview before import.
- **P1** Let users update a product record and choose whether linked pages use the updated content.
- **P2** Integrate with ecommerce platforms or product feeds after validating demand and data requirements.

### 8.5 Media and asset library

- **P0** Upload images from a local device and reuse them across pages in the publication.
- **P0** Show image upload progress and useful errors for unsupported type, oversized file, or failed upload.
- **P0** Support common web image formats and generate reader-appropriate optimized renditions.
- **P0** Allow alt text to be entered for meaningful images; decorative images can be marked as decorative.
- **P1** Provide a reusable workspace asset library with search and folders or tags.
- **P1** Display basic image metadata such as dimensions and file size.

### 8.6 Reader and sharing

- **P0** Publish to a stable, shareable URL that does not require a reader account.
- **P0** Render a responsive reader for phone, tablet, and desktop.
- **P0** Open like a physical book: centered front/back covers, facing pages, a curved two-sided paper turn, moving shadows, visible edges and a stable spine. Dragging must scrub the turn continuously; a short/reversed/cancelled drag returns to the original spread. Rapid navigation preserves the latest requested destination without locking controls.
- **P0** Offer a subtle page-flip sound after reader interaction, with a persistent mute control. Initial page loading must remain silent.
- **P0** Offer page navigation, previous/next controls, page thumbnails or contents navigation, and a visible page position.
- **P0** Support touch gestures on touch devices and keyboard navigation on desktop.
- **P0** Make product links and calls to action tappable and clearly labeled.
- **P0** Provide a readable fallback layout when a page-turn animation is unavailable or reduced motion is preferred.
- **P0** Show publication title, publisher identity, and cover in the reader.
- **P0** Offer 3D, 2D, slide and scroll views; automatic/single/double-page layout; left-to-right or right-to-left navigation; hard/soft/spiral binding and warm/light/dark surrounds. Remember choices on the device.
- **P0** Provide first/last navigation, 1–3× zoom, zoomed panning, touch pinch, fit and browser fullscreen.
- **P0** Offer opt-in autoplay with pause on manual interaction, hidden tabs and the final page.
- **P0** Offer browser printing of every page while retaining PDF download. View settings and animation must not change exported content.
- **P1** Let the publisher enable or disable PDF download and social sharing.
- **P0** Support thumbnail and contents navigation plus local search across page text and product details, including SKU. Selecting a result navigates to the correct page.
- **P1** Support custom domain or branded reader URL, subject to platform and plan constraints.
- **P2** Offer embeddable reader code for external websites.

### 8.7 PDF generation and download

- **P0** Generate a downloadable PDF from the current published version.
- **P0** Include all publication pages in the selected order and preserve text, images, links where supported, and page styling.
- **P0** Provide clear progress and an error state if PDF generation fails, with a retry option.
- **P0** Ensure exported page content is not clipped and images retain acceptable resolution for on-screen reading.
- **P0** Make the PDF’s page size and orientation consistent within one export.
- **P1** Let the creator choose from supported page sizes, margins, and orientation presets.
- **P1** Include PDF metadata such as title and author.
- **P2** Add print-production options such as bleed, crop marks, and high-resolution print profiles after validation.

### 8.8 Publishing, versions, and lifecycle

- **P0** Provide a pre-publish checklist for missing titles, invalid links, missing product names, and inaccessible images.
- **P0** Confirm before publishing and clearly state which version readers will see.
- **P0** Keep draft edits separate from the currently published version until the user publishes again.
- **P0** Allow a publisher to unpublish a publication and show an appropriate unavailable state at its link.
- **P1** Keep a recoverable version history with timestamp and publisher identity.
- **P1** Restore a prior version or compare it with the current draft.
- **P1** Offer publication scheduling and expiration dates.

### 8.9 Analytics

- **P0** Record aggregate publication views and product-link clicks for published publications, subject to the product’s privacy policy and applicable consent requirements.
- **P0** Show a basic analytics view with views, unique readers where measurable, average engagement or page depth, and product clicks.
- **P0** Allow date-range selection for the analytics summary.
- **P1** Show page-level views and PDF downloads.
- **P1** Allow a creator to add UTM parameters to outbound product links or export analytics as CSV.
- **P2** Support integrations with external analytics tools after privacy and consent needs are established.

## 9. Information architecture

### Creator experience

1. **Workspace home** — publication library, create action, recent activity.
2. **Publication editor** — pages, canvas, templates, blocks, product data, theme, and preview.
3. **Publish settings** — access, reader options, metadata, checklist, and publish action.
4. **Analytics** — readership and product engagement.
5. **Assets** — reusable images and brand assets.

### Reader experience

1. **Cover / entry page** — title, brand, and start-browsing action.
2. **Magazine reader** — page view, navigation, product actions, share, and optional download.
3. **Product destination** — the publisher’s configured external product URL or contact action.

## 10. MVP scope and release plan

### MVP

- Account and single-user workspace.
- Publication library and publication setup.
- Visual editor with page add, delete, duplicate, reorder, and template selection.
- Core templates: cover, product feature, product grid, editorial/story, category divider, closing/contact.
- Text and image editing; structured product cards.
- Manual product entry and basic URL validation.
- Autosave, undo/redo for common actions, preview, and pre-publish checks.
- Stable public reader URL with responsive layout and page navigation.
- Publish, update, and unpublish lifecycle.
- PDF generation for on-screen use.
- Basic aggregate views and product-link click analytics.
- Alt text support and keyboard navigation for core experiences.

### Release 1.1

- CSV product import and mapping preview.
- Collaborator roles and publication access controls.
- Reusable asset library, version history, and restore.
- PDF page-size presets and publication metadata. Reader search/contents are now included in the local reader.
- Page-level analytics and CSV export.

### Later opportunities

- Ecommerce catalog integrations and product feed refresh.
- Custom domains, website embeds, scheduled publishing, and expiration.
- Comments and collaborative review.
- Print-production PDF controls.
- AI-assisted copy suggestions or layout recommendations, only after user research and quality/privacy review.

## 11. Success metrics

### North-star metric

**Monthly engaged publications:** number of published magazines that receive meaningful reader engagement, defined initially as at least one reader session with a product click or meaningful page depth.

### Activation

- Percentage of new creators who create a publication and reach preview.
- Percentage who publish within seven days of starting.
- Median time from publication creation to first publish.
- Template selection to first completed page conversion.

### Reader engagement

- Publication views and engaged reader sessions.
- Median pages viewed per session and completion rate.
- Product-link click-through rate.
- PDF generation and download success rate.

### Quality and retention

- Draft save success rate and lost-edit reports.
- PDF generation failure rate.
- Reader load time and error rate.
- Creator return rate and publication update rate.
- Support requests related to editing, publishing, and exports.

### Guardrails

- Accessibility issues found in core flows.
- Invalid or broken outbound links at publish time.
- Abuse reports or policy violations for public content.
- Privacy complaints and analytics opt-out handling.

Metric definitions, event retention, and any user-level analytics should be finalized with privacy and legal review before implementation.

## 12. Non-functional requirements

### Performance

- Creator editor should become interactive promptly on supported modern browsers; target a p75 initial interactive time of 3 seconds or less on a typical broadband connection.
- Reader’s first meaningful content should appear within 3 seconds at p75 on a typical mobile connection, using optimized image renditions and progressive loading.
- Page navigation should feel immediate after content is loaded; large images should not block the reader shell.
- PDF exports should complete within a target of 30 seconds for a typical 20-page publication; provide progress for longer jobs.

### Reliability and data integrity

- Autosave should indicate pending, saved, or failed state clearly.
- Retry transient save failures and retain unsaved changes locally where feasible.
- A published version must remain stable while the creator edits a new draft.
- PDF and publication generation failures must be observable and recoverable.

### Accessibility

- Target WCAG 2.2 AA for the creator experience and reader controls.
- Support keyboard access, visible focus, semantic headings, sufficient contrast, and screen-reader labels.
- Provide text alternatives for meaningful images and respect reduced-motion preferences.
- Do not rely on page-turn animation alone to communicate navigation or structure.

### Compatibility

- Support current and previous major versions of Chrome, Safari, Firefox, and Edge, subject to analytics-informed browser policy.
- Reader must adapt to common mobile screen sizes and portrait/landscape orientations.
- PDFs should open in common PDF readers and browsers.

### Security and privacy

- Use secure authentication and authorization checks for workspace, draft, and asset access.
- Use HTTPS for all application and reader traffic.
- Validate uploads and enforce configurable file-size and type limits.
- Protect private or password-protected publications from unintended public access.
- Minimize personal data collection; define event retention and deletion rules.
- Provide a process for reporting harmful or infringing public content.

## 13. Data model (conceptual)

- **User:** identity, authentication references, preferences.
- **Workspace:** name, owner, members, plan/settings.
- **Publication:** workspace, title, metadata, theme, status, reader slug, access settings, current published version.
- **PublicationVersion:** publication, version number, snapshot content, created by, created at, published at.
- **Page:** version or draft reference, order, template identifier, page-level properties.
- **Block:** page, type, order, content, styling and layout properties.
- **Product:** name, descriptions, price/currency, SKU, category, images, destination URL, source metadata.
- **Asset:** workspace, file reference, dimensions, type, alt text, upload metadata.
- **Event:** publication, event type, timestamp, privacy-safe session attribution, page/product reference where applicable.

This is a conceptual model, not a committed database schema.

## 14. Acceptance criteria for MVP

1. A signed-in creator can create a publication, select a template, add multiple pages, and reorder them.
2. The creator can edit text and image blocks and add a product with a name, description, image, and optional destination URL.
3. Editing changes persist through autosave and remain after a browser reload.
4. The creator can preview the publication in a reader-like view before publishing.
5. The pre-publish checklist identifies required missing content and invalid product links.
6. Publishing creates a reader URL that can be opened without signing in and works on mobile and desktop.
7. An unpublished draft edit does not change the live publication until the creator republishes.
8. Reader navigation works with touch and keyboard; product links are clearly actionable.
9. A creator can generate and download a PDF of the published version, and the exported pages preserve the content without clipping.
10. The creator can unpublish a publication; its reader URL no longer exposes the content.
11. Basic views and product-link clicks appear in analytics after activity is recorded.
12. The core editor, reader, and export flows communicate errors and offer a recoverable next action.
13. A held page drag visibly bends the paper; release completes or reverses it without losing content. GPU failure restores readable, interactive pages.
14. Thumbnails, contents and product search reach real pages; empty search and no matches are clear. Closing navigation restores keyboard focus.
15. View preferences persist through reload; RTL preserves logical page numbers, and single/slide/scroll views remain usable on phones.
16. Zoom/pan/pinch do not accidentally turn pages. Autoplay is opt-in and stops on manual navigation or at the end.
17. Print displays all publication pages, excludes reader controls, and restores the reading view afterwards.

## 15. Risks and mitigations

| Risk | Potential impact | Mitigation |
|---|---|---|
| Template editor feels too restrictive or too complex | Poor activation or high support load | Test template flexibility with target creators; start with constrained layouts and clear controls |
| PDF differs from the digital reader | Brand inconsistency and export dissatisfaction | Use shared publication content and automated visual comparison during development |
| Product data becomes stale | Wrong prices or broken product destinations | Show last-updated details; add import and integration paths based on validated use cases |
| Large image uploads slow the reader | High bounce rate | Optimize images, lazy-load below-the-fold content, and show upload limits early |
| Mobile page-turn interaction is awkward | Readers abandon the magazine | Provide scroll/list fallback and test touch navigation on common devices |
| Public content creates abuse or rights issues | Legal, trust, or hosting risk | Add reporting, publication controls, and a takedown process |
| Analytics create privacy concerns | Loss of trust or compliance exposure | Collect only necessary aggregate signals and define retention/consent policy before launch |
| PDF layout engine has fidelity limits | Clipped or inconsistent documents | Define supported templates and export limits; provide clear error reporting and test representative content |

## 16. Dependencies and implementation considerations

- Image storage, resizing, and delivery service.
- Publication rendering system shared by preview and public reader.
- PDF rendering or conversion service with suitable font and link support.
- Authentication, workspace permissions, and publication access model.
- Analytics event pipeline and privacy policy.
- Content moderation/reporting workflow for public URLs.
- Reliable version snapshotting so live content remains stable during editing.

Technical architecture and vendor choices are intentionally open at PRD stage.

## 17. Open questions

1. Is the primary customer an individual seller, a small business, or a larger marketing/catalog team?
2. Resolved: realistic 3D book by default, with 2D/slide/scroll choices and automatic fallback when WebGL is unavailable. Reduced motion skips turns.
3. Is the PDF primarily for screen sharing, home printing, or professional print production?
4. Which product source should be prioritized after manual entry: CSV, Shopify, another ecommerce platform, or a PIM/catalog feed?
5. Should a publication be public by default, unlisted by default, or configurable per publication?
6. Do creators need multiple users and approval workflows in the first release?
7. Are prices expected to vary by market, currency, or publication date?
8. What reader actions matter most: product-page click, add-to-cart, inquiry/contact, or appointment booking?
9. What subscription or usage model is intended (free tier, paid seats, publications, page limits, or exports)?
10. Which languages and right-to-left layouts must be supported at launch?

## 18. Glossary

- **Digital magazine / flipbook:** a page-based publication viewed in a browser.
- **Product block:** a structured presentation of a product, typically with image, name, description, optional price, and an action.
- **Reader:** the public-facing experience used to browse a published magazine.
- **Template:** a reusable starting layout for a page or publication.
- **Published version:** the fixed content snapshot that readers see until a newer version is published.

---

**Next step:** Validate the target customer, PDF use case, and desired reader interaction, then convert the MVP requirements into design flows and implementation tickets.


## 19. DearFlip reference review and delivery scope

Reviewed the [DearFlip live demo](https://dearflip.com/) and [official JavaScript product documentation](https://js.dearflip.com/) on 27 October 2026. The reference sets interaction expectations; Flipbook uses its own code, templates and assets. This is a functional comparison, not a claim of identical rendering or complete platform parity.

| Reference capability | Flipbook delivery |
|---|---|
| Curved 3D paper, double-sided textures, spine/shadows, hard/soft covers | Implemented with a custom WebGL bend model; interactive drag and rollback |
| 2D fallback, single/double page, scroll and slide views | Implemented; reduced-motion path remains instant |
| Thumbnail panel, page selector, first/last, contents and search | Implemented for authored pages and product text |
| Zoom, pan, pinch, fullscreen, page links, sharing, sound | Implemented; device/browser restrictions may apply |
| Spiral binding, reading direction, background choices | Implemented as per-device reader settings |
| Autoplay, print and PDF download | Implemented; print uses browser settings, PDF remains a separate worker export |
| Lightbox experience | Editor preview opens in a modal; the public reader is a standalone page with fullscreen |
| PDF-to-flipbook import | Next delivery: validate bounded PDFs, convert pages safely, preserve text/link metadata where possible, and distinguish imported pages from editable authored blocks |
| Bulk image-to-book import | Next delivery: ordered image selection and cover assignment; individual image uploads and authored image pages work today |
| Embeddable inline/lightbox widgets | Next delivery: explicit public embed route, allowed origins, scoped frame policy, responsive sizing and revocation checks; current reader intentionally blocks framing |
| WordPress, Shopify and other platform plugins | Integration roadmap; the local monolith is not a CMS plugin |
| Advanced PDF annotations, OCR, non-Latin typography and translation | Separate follow-up requiring fixtures, font coverage and export acceptance |

The present implementation focuses on the reader experience requested in the screenshot. The remaining import/embed/platform work is explicitly tracked above rather than being represented as already available. Product editing, images, immutable publishing, local Docker operation and PDF generation retain their existing requirements.

### Reader acceptance and performance targets

- Browser automation must require a real WebGL canvas for the 3D drag case, keep the mouse held for a mid-turn screenshot, and verify both commit and rollback. A fallback-only run does not prove 3D rendering.
- Unit tests must cover geometry endpoints, spine stability, finite coordinates, direction mirroring, cover rigidity, release thresholds, preparation cancellation, queued navigation and context loss.
- Desktop/phone browser cases cover panels, search, persisted options, RTL keys, zoom/pinch, autoplay, print, blocked WebGL and the existing editing/PDF journey.
- Aim for 60 fps on warmed modern desktop hardware and at least 30 fps on representative mobile devices. These are targets requiring device benchmarking, not current measured release guarantees. No idle render loop; lazy GPU code; bounded texture cache; original HTML stays visible during texture preparation.
- WCAG and broad cross-browser compatibility remain product targets. The current verification matrix and untested platforms are documented in the implementation verification record.


## 20. Advanced editor release

All nineteen capabilities below are in the requested implementation scope, including the items previously suggested for later delivery. This release implements the listed editor controls and persistence flows. Feature-level verification evidence is tracked in [EDITOR_DELIVERY.md](../flipbook/EDITOR_DELIVERY.md).

| ID | Capability | Acceptance requirement |
|---|---|---|
| E01 | Rich text | Inline bold/italic/underline/color/HTTPS links; paragraph lists, line height, letter spacing. |
| E02 | Layers | Ordered layer list, rename, reorder, lock and hide; intentional overlapping content. |
| E03 | Multi-select and groups | Shift selection, select all, group/ungroup, move/resize a selection as one bounded operation. |
| E04 | Alignment and guides | Align to selection/page margins and centers; distribute equal gaps; snap with visible guides. |
| E05 | Image editing | Visual crop/pan/zoom, rotation, flip, opacity, border and corner radius. |
| E06 | Cross-page clipboard | Copy/paste/duplicate selected elements or groups with fresh IDs and undoable placement; keyboard shortcuts. |
| E07 | Styles and brand kit | Named reusable text styles, bundled or uploaded fonts (TTF/OTF/WOFF that permit embedding), colors and logo; update linked styles across the magazine and reuse a kit. Uploaded fonts load in the reader and embed in the PDF. |
| E08 | Page backgrounds | Solid, gradient or full-page image, crop and adjustable color overlay. |
| E09 | Master pages | Reusable header/footer/logo/page-number elements and page margins; apply/remove per page, propagate master edits. Margins are non-printing guides that drive snapping, page alignment and an out-of-margin warning. |
| E10 | Shapes and decorations | Rectangle, ellipse, line, arrow, star/badge/heart with fill and border, plus a searchable built-in icon library with color, line weight and an optional accessible description. |
| E11 | Product presentation | Toggle visible fields, style price/badge/card, apply the presentation to all product blocks. |
| E12 | Bulk catalog | CSV parsing, column mapping, row validation and preview, atomic import, template-driven page generation. |
| E13 | Image frames and galleries | Rectangular/circular/ellipse/diamond frames; ordered multi-image collages and reader galleries; product cards can show a single image, a main image with thumbnails, or an image grid on the page and in the PDF. |
| E14 | Hotspots | Named transparent/visible regions that open an HTTPS URL, jump to a page, or open a product detail dialog. |
| E15 | Live layout checks | Debounced missing-content, bounds, low-resolution image and rendered-text-overflow warnings; focus affected elements. |
| E16 | Version history | Server-backed draft revisions, preview and restore; restoration creates a new revision and retains the current draft. |
| E17 | Custom templates | Save/reuse a complete page or selection group, with fresh IDs and retained asset ownership. |
| E18 | Comments and review | Page/element-pinned notes, resolve/reopen, revision-specific approval and optional approval-required publish. |
| E19 | Video and audio | HTTPS media URLs with native controls, local poster and accessible text; static poster/link in PDF; no autoplay. |

### Shared acceptance rules

- Every draft-document edit is undoable, participates in autosave/revision-conflict recovery, survives reload, and is reflected in thumbnails and draft book preview. Catalog imports, reusable-library writes, review notes and approvals are separate persistent actions; history restore creates a new saved draft revision.
- Published editions remain immutable. New editor work cannot change a live edition until publishing succeeds.
- Layer visibility, master elements, rich text, colors, crop, shapes and product presentation must have matching HTML/PDF semantics. Browser/PDF font wrapping may differ; overflow must be reported.
- Links and media are validated HTTPS URLs. Product/page hotspots have explicit destinations and accessible labels. Video/audio become a poster plus clickable destination in PDF, without pretending that playback can be embedded in the generated PDF.
- Controls are labeled, usable by keyboard, and avoid interfering with text input shortcuts. Locks prevent accidental canvas editing; hidden content is omitted from reader/PDF output and remains editable through Layers.
- Review is scoped to the existing personal workspace. Comments are authoring records, never included in public publications. Approval applies to one saved revision; any subsequent edit invalidates it. No new team membership system is implied.
- Large inputs are bounded: existing 100-page/50-block and 2 MiB document limits remain; imports report invalid rows before writing. Reusable resources and revisions are owner-scoped.
- Existing schema-1 drafts and published editions remain readable. Editing upgrades a draft to schema 2 without rewriting historical publications.

### Delivery and validation

The implementation shares document contracts across HTML/PDF adapters and editing controls, with persistent resources/history/review/import workflows. For each ID, require model/validation units, appropriate real API checks, and a browser journey that verifies persistence and user-visible behavior. Final acceptance includes the complete edit → save → reload → preview → approve/publish → reader → PDF flow and Docker startup against retained local data.
