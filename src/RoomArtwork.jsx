import React, { useEffect, useRef, useState } from 'react';
import { Disc3 } from './icons';

export function ShowroomArtwork({ item, className = '', pixel = false }) {
  const [failed, setFailed] = useState(false), [painted, setPainted] = useState(false);
  const canvas = useRef(null);
  useEffect(() => {
    setFailed(false); setPainted(false);
    if (!pixel || !item.cover) return;
    const image = new Image(); let disposed = false;
    image.onload = () => {
      if (disposed || !canvas.current) return;
      const context = canvas.current.getContext('2d'), side = Math.min(image.naturalWidth, image.naturalHeight);
      // Average while shrinking (box-filter look) so the 64×64 cover reads as
      // clean pixel art; nearest-neighbour sampling here produced speckled noise.
      // The canvas itself is upscaled with image-rendering: pixelated.
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      // Display only; no readback of cross-origin pixels.
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 64, 64);
      setPainted(true);
    };
    image.onerror = () => { if (!disposed) setFailed(true); }; image.src = item.cover;
    return () => { disposed = true; image.onload = image.onerror = null; };
  }, [item.cover, pixel]);
  return <span className={`showroom-artwork ${className} ${pixel ? 'pixel-artwork' : ''}`}>
    {item.cover && !failed ? <><img src={item.cover} alt={`${item.title} 封面`} width="800" height="800" decoding="async" draggable="false" style={painted ? { visibility: 'hidden' } : undefined} onError={() => setFailed(true)}/>{pixel && <canvas ref={canvas} width="64" height="64" className={painted ? 'is-painted' : ''} aria-hidden="true"/>}</> : <span className="showroom-art-placeholder"><Disc3/><strong>{item.title}</strong></span>}
  </span>;
}
