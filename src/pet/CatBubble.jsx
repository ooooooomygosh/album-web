import React, { forwardRef } from 'react';

// Plain bubble; RoomCat's placement effect positions it (useCatPlacement).
const CatBubble = forwardRef(function CatBubble({ text }, ref) {
  return <span ref={ref} className="room-cat-bubble" role="status">{text}</span>;
});
export default CatBubble;
