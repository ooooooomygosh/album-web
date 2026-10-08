import React from 'react';

// 3×5 bitmap glyphs drawn as SVG rectangles for a crisp pixel clock.
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  ':': '000010000010000', '-': '000000111000000'
};
export default function PixelClock({ text, className = '', label }) {
  const chars = [...text].filter((char) => GLYPHS[char]);
  const widths = chars.map((char) => char === ':' ? 2 : 4), width = widths.reduce((a, b) => a + b, 0) - 1;
  const viewWidth = Math.max(17, width);
  let x = (viewWidth - width) / 2;
  return <><svg className={`pixel-clock ${className}`} viewBox={`0 0 ${viewWidth} 5`} role="img" aria-label={label || text} shapeRendering="crispEdges">
    {chars.map((char, index) => {
      const left = x; x += widths[index];
      return [...GLYPHS[char]].map((bit, cell) => bit === '1' ? <rect key={`${index}-${cell}`} x={left + (cell % 3) - (char === ':' ? 1 : 0)} y={Math.floor(cell / 3)} width="1" height="1"/> : null);
    })}
  </svg>{text.endsWith(' 分钟') && <small className="focus-clock-unit">剩余分钟</small>}</>;
}
