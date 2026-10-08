# Cabin atmosphere previews and integration

- [8-second real-time Electron capture](warm-preview.mp4): 24 fps X11 window capture, resized to 960 px; no playback acceleration. The test wallpaper uses a normal window to inspect its isolated renderer, so its menu bar is visible. This is not native desktop attachment.
- [Warm first frame](warm-a.png) / [later frame](warm-b.png)
- [Pixel first frame](pixel-a.png) / [later frame](pixel-b.png)
- [Wallpaper scene](wallpaper-warm.png)
- [Reduced-motion still](reduced-motion.png)
- [Machine-readable atmosphere report](report.json)
- [Design, source research, masks and asset provenance](../../cabin-atmosphere-validation.md)
- [Integrated cat/focus report](../cat-focus/integrated-report.json)

Integrated from cat/focus source commit `aa8f668de4fe1976fd7334bb151e11fe4ccdd86c` (local cherry-pick `62af18a`). Added standard blur/focus handling to the cat motion hook so real main-window hide also stops cat drawing while business timers keep running. The revised cat test hides/shows the actual native host; it no longer substitutes a synthetic `document.hidden` value. Companion wallpaper and pet windows do not stop merely because they are unfocusable.

Linux / Node 24.19 / Electron 44.6.0 / Xorg dummy. Full build and 69 model/unit tests pass. Real Electron checks: atmosphere 8, cat/focus 9, improvements 9, shelf 9, focus 9, pet 6, delayed cover editor 4. No page errors in the new atmosphere/cat suites. The improvements editor assertion now waits for its independent asynchronous cover sampling instead of reading the transient fallback immediately after mount.

Windows/macOS native wallpaper attachment, desktop-layer placement, click-through, Spaces/multiple monitors and the original ERR_FAILED machine remain unverified. The source images and original focus timing semantics are preserved. No new API or preload/IPC method, dependency, deployment or release.
