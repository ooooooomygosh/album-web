# Fire shape revision

The first preview used eight evenly spaced Bezier tongues. Reviewing its 3 s and 6 s frames showed repeated triangular tips anchored to the same bases, and overlapping translucent fills looked like stiff cutouts. Changing only opacity or speed could not address that structure.

The revision replaces the tongue geometry with a 112×208 combustion texture: layered advected noise, nested domain warping, uneven fuel distribution and stronger breakup with height. It produces rising folds, separated wisps and dark gaps; a bright continuous fuel bed, two charred foreground logs and small ember seams establish the origin of the flame. The firebox mask and clean background remain unchanged. Low-frequency surface lighting remains separate from the faster flame detail. No dependency, API or new scene asset was introduced.

Pixel uses a separate 26×48 texture, eight stepped heat colours and hard alpha edges. It is not a blurred downsample of the warm canvas. Both share time-based motion and the existing 24-paint/s scheduler, reduced-motion and lifecycle handling.

## Actual visual evidence

- [Before, original triangle fire](before.png)
- [After at 1 s](after-1s.png), [4 s](after-4s.png), [7 s](after-7s.png)
- [8-second real-time recording](warm-after.mp4), 24 fps X11 capture, no acceleration
- [Pixel view](pixel-after.png)
- [Electron report](electron-report.json)

These frames were actually inspected. The old evenly repeated pointed row is gone. The after frames show a broad rising plume, smaller separated tongues and curling edges at different times, with persistent darker log/ember detail below. The small hearth and captured screen resolution limit fine texture visibility. This remains procedural stylized fire, not captured real fire or a fluid simulation; visual acceptance belongs to the user.

## Validation

Build and 71 model/unit tests pass. Six atmosphere/fire tests cover bounded particles, smooth light, scheduler cleanup, directional/material response, hot roots with empty gaps and dissipated tops, deterministic moving texture without whole-frame flashes, and separate pixel palette/alpha. The full real Electron atmosphere suite passes all 8 groups: different frames in both looks, actual clipping/material masks, reduced motion, native host hide/show, responsive alignment and isolated wallpaper renderer. Native desktop attachment is still not tested by this smoke.

The new writing-room background is deliberately not integrated: its preview must receive user approval first.
