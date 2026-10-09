# Cabin atmosphere validation

The warm and pixel cabins retain their original source artwork; an explicitly approved floor-only patch removes baked directional hotspots, as documented in the [forward-light revision](qa/fire-front-light/README.md). Four window panes and the firebox are independently clipped canvas patches: cleaned stationary backgrounds underneath actual moving snow particles and changing flame silhouettes. Window bars, hearth edges, albums and controls stay above/outside the effect. Clear/rain/starry weather does not emit snow.

## Rendering and limits

64 depth-weighted snow particles and an advected, domain-warped fire texture share one RAF scheduler with at most 24 paints/second. Flame texture uses layered flowing noise with height-dependent breakup; light energy independently uses continuous low-frequency value noise. See the [fire revision and actual before/after frames](qa/fire-naturalism/README.md). Warm canvas DPR is capped at 2; pixel canvas is quarter resolution with nearest-neighbour rendering. The two canvas backing stores total under 330,000 pixels at the cap. No frame-by-frame React updates, network requests or new dependencies.

The current light pass separates the inward stone reveal, upward-facing hearth top, a narrow metal edge and conservative floor spill beyond the raised-hearth shadow. Shared scene-coordinate gradients are anchored inside the visible opening. Wood, the unsupported glass glint, mantel/front masonry, rug and hearth fascia receive no added direct light. Hand-authored 2.5D normals, visibility and distance attenuation remain an approximation, not inferred geometry or ray tracing. The later [forward-light revision](qa/fire-front-light/README.md) removes contradictory baked floor bands, expands the front pool and adds a weaker rug response. Other baked highlights remain unchanged. The earlier [projection correction](qa/fire-light-projection/README.md) records the superseded narrow-mask state.

Hidden/blurred main views stop their animation loop. Electron intentionally keeps the business view unthrottled for audio/timers; native hide/minimize/show/restore forwards standard DOM blur/focus events to that view (no new bridge method or IPC channel). Unfocusable wallpaper is exempt from focus-based pausing and uses Page Visibility. Both app reduced-motion and OS preference produce one steady frame with no RAF. Unmount removes listeners, observer and pending RAF; a missing cleaned image safely keeps original static art.

## Asset provenance

ImageGen edited each original on 2026-10-08, instructed only to remove airborne snow from the four panes while retaining snowy trees and remove flames/sparks from the hearth while retaining logs/embers, with alignment/style preserved. Both resulting images were inspected at 1448×1086. Runtime uses only the clipped regions; generated changes outside those masks cannot alter the room. Originals are unchanged.

| File | SHA-256 |
| --- | --- |
| warm-cabin.png | 110339ec95383546a97c82b494ca80499a2e014adc38465967b73d091fd5e7fc |
| pixel-cabin.png | 92ce87995ca85c3c2b5631a42677ac9b91ba753da79c80ae82e649cd24dc4dbe |
| warm-cabin-clean.png | 073d35fafb07fbd024358429bea8e3be825e3b8f5fd9bb81280c9d2ffc8fd3e3 |
| pixel-cabin-clean.png | d2886cd9463d1d0f39bc27e0a48f2be412738c5ea4f24dd95659e264455ee9fc |

Masks in `src/cabin-atmosphere.mjs` use original-image coordinates: window rectangle (188,170,218,286) split into four panes; warm hearth (1354,538,94,180), pixel hearth (1354,538,94,192), with inset polygon openings. Resizing shares the original image's transform.

## Research before implementation

Inspected MIT-licensed GitHub implementations for general approaches; no source code or packages were copied:

- [snowfall-canvas](https://github.com/ux-ui-pro/snowfall-canvas): delta-time particles, DPR caps and lifecycle disposal.
- [react-fireplace](https://github.com/mcckyle/react-fireplace): separately animated flame geometry and local warm light; did not adopt fast flicker/frame-dependent springs.
- [pixi-lights](https://github.com/pixijs-userland/lights): separate diffuse, normal and light layers. Its Pixi dependency was unnecessary for this fixed scene.
- [Godot canvas shader](https://github.com/godotengine/godot/blob/master/drivers/gles3/shaders/canvas.glsl): normal/light incidence and half-vector response.
- [Phaser LightPipeline](https://github.com/phaserjs/phaser/blob/v3.90.0/src/renderer/webgl/pipelines/LightPipeline.js): coordinate alignment of surface and light data.

## Reproduction and evidence

`npm run build`, `npm run desktop:test`, `npm --prefix desktop run build:web`, then `DISPLAY=:99 npm --prefix desktop run test:atmosphere` on Linux/Xorg with Electron 44.6.0. The existing Windows-named test executable uses an ignored local `electron.exe -> electron` symlink. No packaged/native Windows result is implied.

Model tests cover deterministic bounded particles, continuous flame/light changes, different material distance/incidence, RAF cap, hide/resume, reduced motion and disposal. Electron tests compare different snow/fire hashes over two frames in both looks, inspect transparent clipping pixels, rasterize material masks to verify untouched surfaces, verify reduced-motion stability, actual host hide/show, repeated style changes, four aspect ratios and an isolated wallpaper renderer.

Final results and preview captures are recorded in the accompanying `docs/qa/atmosphere/` directory. Native Windows desktop attachment and macOS behaviour remain acceptance checks on those operating systems. No release, deployment, tag or merge is performed.
