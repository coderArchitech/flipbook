# Flipbook verification record

Verified on **27 October 2026** against the local implementation described in technical design v3.0.

## Final results

| Check | Result |
|---|---|
| Frontend unit tests | **40 passed** — paper geometry, drag/rollback, async cancellation, snapshot/context failure, queued navigation, local search/preferences, autoplay, sound, API client, React preview/gallery/nested dialogs |
| Backend unit tests | **12 passed** — password hashing, malformed hashes, session cookies, CSRF, origin policy, rate limiting, HTML/JSON escaping, versioned asset links, accessible reader controls, geometry |
| Shared document unit tests | **8 passed** — templates, validation, overlap/bounds/IDs, URLs, duplication, spread pagination |
| Real API integration | **9 scenarios passed**; Node reports 10 passing test records including their parent test |
| Playwright | **22 passed**, 0 failures, 0 flaky cases, 0 skips, no retries needed in the final run; **1.4 minutes** |
| Frontend production build | Passed |
| Production dependency audit | `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities reported** |
| Docker application | Rebuilt, started, and healthy at `http://localhost:3000`; health endpoint returned SQLite readiness |
| Persistence and backup | Previously verified restart/backup fixture; this update rebuilt the app with its existing named volume intact |
| Existing native studio | Port 3030 restarted against its existing data directory; latest reader/settings inspected in the in-app browser |

The final Docker run executed all **60 unit tests**, API scenarios, and browser cases in one command. Frontend units use Vitest/jsdom and React Testing Library; backend units mock the database boundary. Integration and Playwright fixtures run against real Express servers, temporary SQLite databases, local files, and real PDF workers.

## Browser cases

1. Rapid next/previous input settles on the intended page, keeps controls enabled, and removes transient animation layers.
2. Sound creates no audio context on load; muted turns stay silent; enabled turns start the audio graph; mute survives reload.
3. Cover and facing-page navigation, side arrows, bounds, zoom, page links, and keyboard navigation.
4. Reader product dialog, gallery, Escape/focus restoration, reflow, and reduced motion.
5. Odd-page and single-page books never display phantom pages.
6. Fullscreen entry/exit and copying the selected page URL.
7. Edit text/product → autosave → reload → preview → publish → public reader → PDF download.
8. Page templates, ordering, duplication, undo/redo, and saved reload.
9. Preview product details/gallery, nested dialog dismissal, focus restoration, and switching book/reflow views.
10. Concurrent tabs detect a revision conflict without overwriting the saved draft.
11. Real PNG upload and reuse in a persisted catalog product.
12. Incomplete publication produces actionable validation.
13. Register, sign out, reject a wrong password, and sign back in.
14. Pixel 7 emulation: page fit, Chromium-generated touch swipe, reflow, and resize to a desktop spread.
15. Requires a real WebGL renderer; holds a page mid-drag for a screenshot, commits, then reverses an abandoned drag to the original spread.
16. Thumbnail/contents navigation, current-page state, product search, no-result text, and restored focus.
17. Persisted 2D/slide/scroll choices, single/double page layout, RTL keys, spiral binding and dark surround.
18. Bounded zoom, panning without a page turn, fit, and first/last boundaries.
19. Opt-in autoplay advances, pauses on manual navigation and stops at the end.
20. Browser print is intercepted; all six pages are visible with print CSS and scroll mode is restored.
21. Blocked WebGL falls back to a working 2D reader with product interactions and a clear status.
22. Phone navigation selection closes the panel; Chromium-generated two-finger pinch zoom preserves the page.

Every browser case also fails on an uncaught page error. The WebGL test does not accept CSS fallback as proof of 3D rendering.

API scenarios additionally check cross-account isolation, CSRF, stale revisions, idempotency, corrupt image rejection, immutable published snapshots, analytics deduplication, unpublish fencing, revoked reader/assets/PDF access, archived editing restrictions, PDF overflow findings, and session invalidation.

## Evidence and rerun

- [Final test transcript](verification/test-run.log)
- [Machine-readable result summary](verification/results.json)
- Playwright HTML report: generated locally at `test-results/docker/html/index.html` by `./scripts/test.sh` (not committed)
- [Curved paper held mid-turn](../docs/images/flipbook-page-curl.png)
- [Desktop reader screenshot](../docs/images/flipbook-reader.png)
- [Phone reader screenshot](../docs/images/flipbook-mobile.png)

Run from the `flipbook/` directory:

```bash
./scripts/test.sh
```

This builds the separate development-only browser image and runs unit, API, and Playwright suites. The app container stays browser-free. Tests publish no host ports and do not mount your application data volume. Reports are replaced under `test-results/docker/` on each run.

With Node.js 24 installed:

```bash
npm test
npm run test:frontend
npm run test:backend
npm run test:e2e
npx playwright show-report test-results/docker/html
```

Install Chromium first for native browser runs as explained in the [run guide](README.md). Generated HTML reports are local build artifacts and are excluded from the source archive; rerunning tests regenerates them. The retained transcript and summary are included.

## Fixes exposed by verification

This reader upgrade:

- Rooted esbuild chunks at `/reader/` so dynamic 3D imports work from the `/reader.js` entry URL.
- Made canvas hidden-state CSS override Three.js's inline display style, preventing the last GPU frame from remaining over the live pages.
- Added explicit accessible labels to view selectors and used distinct searchbox/button locators.
- Protected active textures, cancelled stale asynchronous preparations, restored HTML on context/snapshot failure, and avoided replaying sound during fallback.
- Removed self-shadowing from the two coincident faces, reserved room for the lifted corner, and retained the cast shadow on stationary pages.
- Printed canonical page geometry even when the reader began in scroll mode, restoring the prior view afterwards.

Earlier MVP verification also fixed:

- Kept the old stationary page beneath the animated leaf until landing, shortened transitions to 420 ms (interior) and 280 ms (cover/phone), removed the animated drop-shadow filter, decoded nearby images, and queued rapid input.
- Preserved side-arrow positioning during pressed-state feedback so the control keeps its hit area.
- Stopped nested React dialog cancel events from also dismissing the parent preview; added both unit and real-browser regression checks.
- Switched PDF font embedding to the packaged WOFF variant after a multi-page fixture exposed a WOFF2 subsetting failure. Inspected all four rendered PDF pages and confirmed selectable text and link annotations.
- Updated Sharp to 0.35.5 and replaced an invalid image fixture with a real generated PNG.
- Malformed stored password hashes now fail closed instead of throwing a buffer-length error.

## Scope and limits

Final browser automation ran in the pinned Playwright 1.64.1 Docker image on Linux ARM64 with desktop Chromium and Pixel 7 Chromium emulation. Native unit/API/build checks also passed on macOS with Node 24.16.0. An earlier native Chromium launch was blocked by the desktop sandbox; successful browser evidence comes from Docker.

The latest reader and settings were also inspected in the in-app browser. The curved-paper screenshot is from the real Chromium WebGL drag case, not a mock renderer. Unit tests inject a renderer only to deterministically exercise asynchronous cancellation and failures. Audio tests verify the real browser audio graph and mute behavior, not perceived volume through a physical speaker. The animation checks verify state, continuity, and responsiveness; they are not a guarantee of 60 fps on all hardware. Real iOS/Android devices, Firefox, Safari, assistive-technology audits, load testing, and CI execution were not part of this run. The GitHub Actions workflow is supplied but has not run on a remote repository.

Docker was already installed, so first-time host package installation and administrator prompts were not exercised. This update rechecked image build, startup and health. Restart persistence, backup, and production account/publish/PDF smoke checks passed in the earlier MVP verification and were not repeated unnecessarily. PDF layout was inspected using the synthetic starter publication; browser/PDF line wrapping can still differ as described in the technical design.

The optional 3D bundle is approximately 138 kB gzip and still triggers Vite's standard 500 kB minified-chunk warning; the editor entry is independently loaded. PDF import, bulk image-to-book import, iframe embeds and CMS plugins remain roadmap items, as listed in the PRD.
