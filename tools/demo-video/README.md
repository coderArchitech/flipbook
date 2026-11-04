# Flipbook demo video

Builds a narrated MP4 walkthrough of the app (for example `out/flipbook-demo.mp4`) from a live, freshly seeded server.

Requires Node 24, the built app (`cd ../../flipbook && npm ci && npm run build`) and macOS (`say` for narration).

```bash
npm install                 # ffmpeg-static, pdfjs-dist, Fraunces font
node narration.mjs          # synthesize narration lines (macOS "Samantha" voice)
node assets.mjs             # generate illustrations, logo, poster, film, CSVs
node record.mjs             # run a fresh demo server, seed it, record all 14 scenes
node assemble.mjs out/flipbook-demo.mp4
```

| File | Role |
|---|---|
| `script.mjs` | Narration, one sentence per beat, per scene |
| `build.mjs` | Seeds the demo account and builds the pre-built 9-page draft through the API |
| `record.mjs` | Drives each scene in Chromium with a visible cursor; writes `out/timeline.json` and screencast frames |
| `assemble.mjs` | Cuts scene clips, adds title/end cards, narration, page-turn sounds and burned-in subtitles |
| `preview.mjs` | Design QA: applies the final state via the API and screenshots reader and PDF pages |

The demo server uses its own temporary data folder (`out/data`) and never touches a real studio. `node record.mjs --until=s05` stops after a given scene when iterating.

Recording notes: browser capture has no audio, so the page-flip sound is recreated at the logged turn times. The phone scene is a separate Pixel 7 browser placed in a phone frame. The PDF scene shows the real exported file rendered with pdf.js, because the headless browser has no PDF viewer. The film in the video block is generated locally and served at an HTTPS address intercepted by the browser.
