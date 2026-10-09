import { useEffect, useState } from 'react';
import { readCoverPixels } from './album-wall-canvas.mjs';
import { dominantColour } from './cover-colour.mjs';
import { DEFAULT_RECORD_STYLE } from './record-library.mjs';

const colours = new Map();
function coverColour(cover) {
  if (!colours.has(cover)) {
    colours.set(cover, (async () => {
      try {
        const pixels = await readCoverPixels(cover);
        return pixels ? dominantColour(pixels) : DEFAULT_RECORD_STYLE.base;
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
