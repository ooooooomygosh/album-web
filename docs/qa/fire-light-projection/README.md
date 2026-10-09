# Correct the dynamic firelight projection

Reviewed the prior real-time clip, original warm-cabin artwork and the light code together. The old masks illuminated the whole mantel/front pillar, hearth fascia and portions of shelf wood that the stone jamb blocks. Each gradient used its own object bounding box, so the apparent bright centre varied by shape rather than sharing the hearth origin. The wide floor polygon also crossed areas where the raised hearth and rug should constrain the spill.

## Changes

- Warm source anchored at original-image (1409,661), pixel at (1409,674), behind the opening plane. Small low-frequency source movement remains inside the firebox.
- Near-surface gradients now use scene coordinates (`userSpaceOnUse`) with a shared hearth origin. Normals face into the opening or upward on the horizontal hearth top; attenuation length decreases from 520 to 240 image units.
- Separate inward stone reveal and horizontal hearth-top masks. The front pillar, mantel, vertical hearth fascia and shelf wood receive no new direct light. Removed the unsupported glass highlight.
- Floor spill is a weak, projected ellipse confined to the floor beyond the raised-hearth shadow and outside the rug; the broad bright floor rectangle is gone. This is a conservative hand-authored 2.5D occlusion approximation, not ray-traced scene reconstruction.

## Evidence and boundary

- [Annotated before/after mask comparison](mask-comparison.png): pink old coverage, cyan new receiving surfaces, yellow source/rays. Annotation uses the unchanged source artwork; rays illustrate direction, not a calculated 3D optical path.
- [Before screenshot](before.png) / [after screenshot](after.png).
- [8-second actual-speed clip](after.mp4), recorded at 24 fps without acceleration.
- [Electron regression report](electron-report.json).

The original artwork already contains a pronounced diagonal bright strip across the floor, plus highlights on the masonry. Those pixels are baked into the image; removing dynamic light cannot remove them. The comparison explicitly marks that strip in white. This revision changes only the added dynamic contribution and does not repaint the source or claim that all source-image lighting is physically correct. Both original scene assets remain unchanged. The new Lofi background remains preview-only pending user approval.

Validation: root and desktop web builds pass; 72 model/unit tests pass. The 8-group real Electron atmosphere suite passes, including rasterized zero-alpha checks at the mantel, pillar front, shelf wood, hearth front/shadow, rug, window, wall, couch and albums, while the inner reveal and hearth top receive light. Both looks, multi-frame animation, reduced motion, hide/show and isolated wallpaper renderer pass. Windows/macOS native desktop attachment remains unverified.
