# Pixel fonts

| File | Font | Version / source | License |
|---|---|---|---|
| `fusion-pixel-12-zh_hans.subset.woff2` | Fusion Pixel Font 12px proportional (zh_hans) | v2026.09.25, https://github.com/TakWolf/fusion-pixel-font | SIL OFL 1.1 — `FusionPixel-OFL.txt` |
| `silkscreen-regular.woff2`, `silkscreen-bold.woff2` | Silkscreen by Jason Kottke | https://github.com/google/fonts/tree/main/ofl/silkscreen | SIL OFL 1.1 — `Silkscreen-OFL.txt` |

Both files are subsets (WOFF2) made with `pyftsubset`: Fusion Pixel keeps ASCII, GB2312
(all 6,763 hanzi + symbols) and every character used in `src/`; Silkscreen keeps ASCII.
Subsetting is a permitted modification under the OFL; neither font declares Reserved Font Names.
To regenerate after adding new copy, re-run the subset with the extra characters.
