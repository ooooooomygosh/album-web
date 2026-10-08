import { useEffect, useState } from 'react';
import { loadWallCover } from './album-wall-canvas.mjs';
import { dominantColour } from './cover-colour.mjs';
import { DEFAULT_RECORD_STYLE } from './record-library.mjs';

const colours = new Map();
function coverColour(cover) {
  if (!colours.has(cover)) {
    colours.set(cover, (async () => {
      try {
        // Reuse the existing local cover transport; no new endpoint or service.
        const image = await loadWallCover(cover);
        if (!image) return DEFAULT_RECORD_STYLE.base;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 48, 48);
        return dominantColour(context.getImageData(0, 0, 48, 48).data);
      } catch { return DEFAULT_RECORD_STYLE.base; }
    })());
    if (colours.size > 256) colours.delete(colours.keys().next().value);
  }
  return colours.get(cover);
}
export default function useCoverColour(cover) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let alive = true;
    if (cover) coverColour(cover).then((base) => { if (alive) setResult({ cover, base }); });
    return () => { alive = false; };
  }, [cover]);
  return cover && result?.cover === cover ? result.base : DEFAULT_RECORD_STYLE.base;
}
