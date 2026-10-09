# Renderer and cross-surface validation

## Reproducible offline suite

Run `npm ci && npm --prefix desktop ci`, install Chromium (`cd desktop && npx playwright install chromium`), then `npm run test:browser`.

Configuration:

- `BROWSER_EXECUTABLE`: explicit Chromium executable
- `BROWSER_PORT`: isolated Vite port (default 4179)
- `BROWSER_OUTPUT`: report/output directory (default `desktop/test-results/browser`)
- CI uses Playwright's installed Chromium; local Linux prefers `/usr/bin/chromium` when available

The suite creates a fresh browser context, starts and stops its own Vite process, blocks external requests, and uses in-memory collection and music responses. No real account, platform login, music folder, user profile, or collection is touched.

Coverage includes 1440×900 and 960×600 layouts; all five scenes and pets with persistence; manual collection creation, notes and deletion; catalog results; genuine generated WAV decoding and playback progression; exact local next-track selection; simulated system transport; music settings; tasks and timed focus completion; backup download, malformed import and merge; generated album-wall PNG; keyboard Zen mode; wallpaper rendering for all scenes; and each desktop-pet renderer with keyboard interaction.

The report records assertions, page exceptions, console errors, failed requests, unexpected network attempts, and screenshots. On failure it retains a screenshot, DOM HTML and stack trace. Screenshots are visual review artifacts, not an approved pixel-comparison baseline. Platform and font differences must be reviewed before baselines are established.

## Current execution limitation

On 2026-10-08 the managed execution environment refused Chromium's process-singleton Unix socket, including the escalated invocation. Chromium exited before the first page opened. The failure is retained in `desktop/test-results/browser/report.json`; this is not a passing browser run. The dedicated cloud browser was separately available but could not reach the execution environment's loopback Vite server. Native OS integration remains untested here.

## Disposable interaction preview

`scripts/preview-fixture.js` is exclusively a preview bootstrap. Copy it as a separate static script into a disposable preview bundle and load it before the application's module. Never inject it into a release build.

It shows a permanent simulation notice, generates fictional artwork and short test audio, mocks the collection and system player, and refuses platform accounts, Music Assistant connections and native desktop commands. Use a restrictive preview Content-Security-Policy so arbitrary image links cannot issue external requests:

`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' blob: data:; object-src 'none'; frame-src 'none'; form-action 'none'`

The bootstrap is separately verified by `node --test desktop/test/preview-fixture.test.cjs` (three passing tests). These tests establish isolated CRUD/reset behavior, fixture labeling, account/external-request rejection, and a valid generated RIFF/WAV body. They do not establish renderer behavior.

## Required native release checks

Before calling either platform release-ready, run packaged-app acceptance tests on macOS and Windows: install/launch/update, window controls, selected pet click-through and dragging, wallpaper attach/detach, actual local folder scan, OS media controls, permission denial/recovery, real account flows, and saved-state/backup recovery. Browser fixture success is not evidence for any of these native behaviors.

## Executed manual cloud-browser checks (2026-10-08)

Snapshot: [fixture-only preview](https://album-circle-c4ivpd3xw-homings-projects-d78a7226.vercel.app/) (`dpl_69smJcxeVR1jkWH3E2veeVkg2pBM`, built approximately 16:32 UTC). This is an isolated, labeled simulation, not the production application or native desktop client. Some subsequent audio and scanning fixes are absent from this snapshot.

Executed with the supported own-cloud Chromium interface:

- Initial 18 fictional albums rendered; permanent preview disclaimer visible
- Each of the five scene choices updated the rendered `data-room-look` to its matching ID
- Each of the five pet choices updated the room canvas `data-pet-id`; all five were visibly distinct in the picker
- Starry scene and fox choice survived a real page reload
- Native browser-window resizing produced an exact 960×600 CSS viewport; document scroll width was 960, with no horizontal page overflow
- All five scenes were captured at 960×600; picker content scrolled within the screen and its close action remained accessible
- Created a task and marked it completed
- Entered multiline quick notes and verified their text survived page reload
- Opened an album card, edited notes, and observed the saved confirmation
- Created a new manual album, verified its title/artist/two tracks in the card, then used the explicit confirmation to remove it; collection returned to 18 items
- Loaded the fictional local track: the browser decoded the generated WAV, duration was 15 seconds, `currentTime` advanced to 7.35 seconds, `paused` was false and the media error was null
- Switched to the simulated system source and observed its explicitly simulated title and playback status

Observed defect: at 1180×757 the legacy toolbar-group max-width and overflow rules clipped scene/music and desktop-background controls. At 960×600 some icon-only controls also lost their accessible names. These findings were reported to the root and corrected in the working source, but require verification on the next preview.

Artifacts: `desktop/test-results/browser/preview/` contains the five compact scene captures, picker-pets, album-card, quick-notes and manual-add screenshots. They are fixture renderings, not native desktop screenshots. Console sampling exposed cloud-browser extension metadata errors; no application-origin runtime error appeared in that sample. This sampling is not a substitute for complete automated error capture.

The standalone Playwright suite remains launch-blocked in this execution environment. The manual checks above do not change that status or certify Windows/macOS native behavior.

### Final-source preview recheck

[Second fixture preview](https://album-circle-ki20mw0cs-homings-projects-d78a7226.vercel.app/) was checked at 960×600 and 1180×757. The toolbar clipping fix is verified: at 1180px all three toolbar groups have `overflow: visible` and equal client/scroll widths (150/150, 321/321, 246/246). Full labels for scene, music and desktop-background controls are visible. At 960px icon-only toolbar/titlebar buttons retain explicit accessible names, and all controls remain visibly available.

Forest, seaside and starlight scenes render with the final calmer non-pixel palette. Final review captures are in `docs/images/preview-qa/`: `forest.png`, `seaside.png`, `starlight.png`, `five-pet-picker.png` (1180×757), plus `forest-960x600.png`. These are clearly labeled fixture previews with fictional album artwork; they may illustrate the interface but are not native integration evidence. The initial large pixel image was observed loading and subsequently verified complete at natural width 1448; it was not a broken asset.

A separate opt-in `scripts/preview-self-test.js` can be injected into disposable preview builds. Its visible run button drives fixture-only DOM interactions and writes a JSON result in the page, including actual generated-audio playback, backup/PNG assertions and a real one-minute focus cycle. It refuses to run without the fixture banner. It is not included in release builds and does not replace the standalone Playwright suite or native acceptance tests. Its execution status must be recorded separately.

### Executed preview self-test result

The visible test button was clicked on the fresh [third fixture preview](https://album-circle-4g7r9z66l-homings-projects-d78a7226.vercel.app/) (`dpl_77CsiL854EfQkxnYBWzXEXQunyp3`). It completed **22/22 assertions**, with `errors: []` and `passed: true`, from **2026-10-08 16:54:12 to 16:55:14 UTC**, at **1180×757**.

Executed assertions covered room mount; all five scene IDs; all five pet IDs; horizontal viewport fit; collection addition, note update and confirmed deletion; task creation/completion; quick-note entry; timer start/pause/resume; backup contents including notes and completed task; actual generated WAV decoding/progress; simulated system transport; real PNG generation; and a real, elapsed one-minute focus cycle recorded in statistics.

The complete result is preserved as [`browser-self-test-result.json`](browser-self-test-result.json). The screenshot is `desktop/test-results/browser/preview/self-test-v3-result.png`. This run used ordinary preview-page test code triggered through its visible button, not browser-console mutation. All collection/provider/native interfaces were explicitly fictional fixtures. It does not certify external music services, speaker output, Electron IPC, desktop-window behavior, installers, or macOS/Windows support; standalone Playwright remains launch-blocked here.

### Final renderer V4 regression

The fresh [V4 preview](https://album-circle-bnq5m9bcg-homings-projects-d78a7226.vercel.app/) (`dpl_72aUPeAewKXG8ywtsTN1o2wUB7K9`) includes the final pet animation scheduler, snapshot propagation, metadata warning/cancellation guards and return-button styling. Its visible self-test again passed **22/22**, with no captured runtime errors, from **17:07:13 to 17:08:16 UTC** on 2026-10-08. The exact report is [`browser-self-test-v4-result.json`](browser-self-test-v4-result.json). The run started at 1180×757; the browser was resized to 960×600 during the real-minute timer wait, which also completed successfully.

At 960×600 the picker scrolls to a fully visible, styled “回到小屋” button (90×37 CSS pixels; tan background and dark text). Evidence: `desktop/test-results/browser/preview/picker-return-v4-960x600.png`. The return control is no longer rendered as the browser's unstyled gray button.

### Final V5 acceptance and reduced-motion observation

The [final V5 fixture preview](https://album-circle-199q12u6x-homings-projects-d78a7226.vercel.app/) (`dpl_4cgrj6aySzP3PXzcQHegTTp62sEE`) uses the same final renderer as V4 and adds only an explicitly labeled fixture motion checkbox. At an exact **960×600** viewport, the visible self-test passed **22/22**, `errors: []`, from **17:10:50 to 17:11:52 UTC** on 2026-10-08. Exact result: [`browser-self-test-v5-result.json`](browser-self-test-v5-result.json).

Motion was tested through the visible “模拟减少动态效果” checkbox, without changing the OS preference or mutating browser state through developer evaluation. The actual system media query was `prefers-reduced-motion: false`.

- Reduced motion off: ten clipped screenshots of the selected fox canvas across approximately 0.60 seconds produced four distinct frame hashes
- Reduced motion on: ten equivalent screenshots across approximately 0.61 seconds produced one identical frame hash
- The compact picker return button remained visibly styled and usable

Timestamps and all frame hashes are preserved in [`browser-pet-motion-v5-result.json`](browser-pet-motion-v5-result.json). This verifies visible animation versus static reduced-motion rendering; it does not measure CPU utilization, certify every pose's exact frame rate, or validate native desktop-window behavior. No new application defect was found in this final pass.

### Combined PR4 renderer V6

The [V6 combined-feature fixture preview](https://album-circle-69p2yqms2-homings-projects-d78a7226.vercel.app/) (`dpl_APU84f81mXxrNhXyLVeN4pcuzbnm`) includes the integrated movable turntable, cover-derived vinyl color and wallpaper lifecycle UI, plus the automatic-color early-save fix, 48px color sampling and preference-write rollback/error reporting.

At **960×600**, the expanded visible self-test passed **31/31 assertions**, with `errors: []`, from **2026-10-08 17:36:42 to 17:37:49 UTC**. Exact result: [`browser-self-test-v6-result.json`](browser-self-test-v6-result.json). The previous 22 checks remain intact. Nine new assertions verified keyboard movement/storage, Home reset, failed preference-write rollback/error, automatic and manual late-cover early-save behavior with opacity retention, restoring automatic cover color, and simulated wallpaper error dismissal/cancellation/retry/stop. Deterministic cover tests used temporary generated PNGs; original illustrated SVG fixture albums were unchanged.

Manual pointer-drag and reload evidence is in [`browser-turntable-v6-result.json`](browser-turntable-v6-result.json):

- Pointer drag moved the deck from `(14.39, 150.98)` to `(174.39, 129)`
- A real reload preserved `(174.39, 129)` along with `forest` scene and `bunny` pet
- The deck's height changed after reload because it had no loaded record; normalized placement remained valid
- Home reset to `(14.39, 207.48)` and a second reload preserved that default exactly

Screenshots: `desktop/test-results/browser/preview/self-test-v6-result.png` and `turntable-drag-v6.png`. No new renderer defect was found. Wallpaper state transitions remain simulated and do not certify OS window attachment, cancellation or cleanup. The standalone Playwright launch restriction and native acceptance gaps still apply.
