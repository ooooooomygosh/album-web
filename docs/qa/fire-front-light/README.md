# Forward fireplace light, including the baked floor correction

The preceding conservative mask revision left the original diagonal bright band and left-side floor hotspot intact. Those fixed pixels continued to suggest side lighting, and the dynamic floor area was too small to convey light from the opening. This revision explicitly fixes both layers following the user's clarification. **The accepted flame implementation is unchanged.**

## Static floor patch

ImageGen edited the warm and pixel originals separately, at 1448×1086, to remove the sharp diagonal/left-entry floor hotspots while retaining the plank perspective and each visual style. Both outputs were actually inspected. They are stored as `warm-cabin-floor.png` and `pixel-cabin-floor.png`; only their exposed wooden-floor pixels are displayed through a clipped, lightly feathered SVG mask. Regenerated content outside that mask cannot replace furniture, window, hearth, rug, covers or fire. Original source files remain available unchanged; runtime floor illumination now deliberately differs from them. Generative edits preserve the overall wood appearance rather than guaranteeing identical individual grain pixels.

## Dynamic front pool

A wider projected elliptical pool now begins beyond the hearth foot and spreads toward the room (down-left in the camera view). Its near region is brighter, its edges and distance fall off softly, and it retains the existing slow irregular heat variation. The vertical hearth fascia remains excluded. A lower-reflectance rug pass continues the light onto the foreground fabric instead of ending it abruptly at the rug boundary. Furniture/front masonry stays occluded. The source, hearth-top contribution and firebox masking are preserved. This is still a hand-tuned fixed-camera approximation, not a 3D ray tracer.

## Preview and verification

- [Annotated actual before/after comparison](front-light-comparison.png)
- [Before](before.png) / [after](after.png) / [pixel after](pixel-after.png)
- [8-second actual-speed clip](after.mp4), 24 fps, not accelerated
- [Electron report](electron-report.json)

Inspected the scene screenshot and recorded frames at 2 and 6 seconds. The old diagonal band and left floor hotspot are absent; a soft near-hearth pool replaces them. Flame shapes were not modified (`src/cabin-fire.mjs` unchanged).

Build and desktop web build pass; 72 unit/model tests pass. Nine real Electron groups pass, including both edited assets loading at exact dimensions, rasterized floor-patch exclusion of furniture/rug/hearth/window, front light stronger than distant floor, lower rug response, no added light on blocked masonry, both styles/multiple frames/reduced motion/hide-show/responsive geometry/isolated wallpaper renderer. Native desktop attachment remains an OS acceptance item. No new API, dependency, release or deployment. New Lofi artwork is not integrated and still requires private preview approval.
