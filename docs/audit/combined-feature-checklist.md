# Combined-feature fixture validation checklist

Prepared for the integrated PR4 renderer; not an execution report. V5 evidence remains unchanged. Run only on a new, explicitly labeled fixture preview after deployment.

## Executable preview self-test additions

The expanded self-test retains all 22 earlier scene/pet, collection, focus, backup and audio assertions and adds:

1. Turntable ArrowRight visibly moves the deck; normalized position fractions are written to room preferences
2. Home clears the stored position and restores default placement
3. A deliberately failed fixture preference write leaves the selected scene unchanged and exposes the global/local error; restoring writes allows recovery
4. A generated solid-color PNG is held behind a fixture-only fetch gate; change opacity and save before sampling finishes; release the image and verify automatic sampled color plus edited opacity survive
5. Repeat with an explicit manual base color; verify late sampling never overwrites manual color and opacity
6. Restore default vinyl and verify the original sampled cover color returns
7. Simulated wallpaper startup error is visible and dismissible
8. Cancel simulated startup before its timer completes and verify no late activation
9. Retry simulated startup, observe active state, then stop

Original illustrated SVG albums remain untouched. The two deterministic color samples are temporary, fictional PNGs created in the browser and removed through the normal album UI. The fetch gate and failed-storage wrapper exist only during the self-test and are restored in `finally`, including when assertions fail. Wallpaper commands emit synthetic state events in the preview; they never create a real desktop background.

## Manual follow-up on the same preview

- Move the turntable with the visible keyboard handle, record its rectangle, reload and verify the position survives at the same viewport
- Use Home, reload again and verify the default position persists
- At 960×600, ensure the moved handle remains reachable, picker/footer remains usable, and reset does not interfere with shelf navigation
- Observe automatic vinyl color on the deterministic sample, manual override and reset using the editor
- Recheck one non-pixel scene and a different pet after movement/color edits; full five-scene/five-pet assertions remain in the scripted run
- Verify native wallpaper remains explicitly labeled as simulated; use real OS acceptance tests for cancellation/teardown, not this preview

The standalone Playwright suite remains available but cannot launch Chromium in the current restricted execution environment. Electron delayed-cover tests additionally cover opacity, splatter, manual base, reset and early-save cases but require a supported native runner.

## Executed result

Executed on V6, 2026-10-08: 31/31 self-test checks passed with no captured runtime errors at960×600. Actual pointer drag, reload preserving forest+bunny+position, and Home/reset reload also passed. See `browser-validation.md`, `browser-self-test-v6-result.json` and `browser-turntable-v6-result.json` for exact timing and measurements. This completes the prepared renderer checklist; native wallpaper acceptance remains separate.
