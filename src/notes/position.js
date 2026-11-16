export const NOTE_MARK_POSITIONS = Object.freeze(['top-left','top','top-right','right','bottom-right','bottom','bottom-left','left']);

export function noteMarkPosition(value,attachment) {

  if (value===undefined || value===null) { return attachment==='item' ? 'top-left' : null; }
  if (attachment!=='item') { throw new Error('Note mark position applies only to item notes.'); }
  if (!NOTE_MARK_POSITIONS.includes(value)) { throw new Error(`Note position must be one of: ${NOTE_MARK_POSITIONS.join(', ')}.`); }

  return value;
}

/** Stack along the chosen edge, then outward when that edge is full. */
export function itemNoteAnchor(node,position) {
  const right=position==='top-right' || position==='bottom-right';
  const bottom=position.startsWith('bottom');

  if (position==='left' || position==='right') {
    const direction=position==='left' ? -1 : 1;
    return {x:node.x+(direction<0 ? -22 : node.w+22),y:node.y+node.h/2,slots:Math.max(1,Math.floor(node.h/68)),dx:0,dy:34,wrapX:direction*34,wrapY:0};
  }

  const centered=position==='top' || position==='bottom';
  return {x:node.x+(right ? node.w : centered ? node.w/2 : 0),y:node.y+(bottom ? node.h+22 : -22),slots:Math.max(1,Math.floor(node.w/(centered ? 68 : 34))),dx:right ? -34 : 34,dy:0,wrapX:0,wrapY:bottom ? 34 : -34};
}

export function noteMarkLayout(entries) {
  const positions=new Map(), counts=new Map();
  let minX=0, minY=0, maxX=0, maxY=0;
  for (const {note,anchor} of entries) {

    if (!anchor) { continue; }

    const key=JSON.stringify(anchor), index=counts.get(key) ?? 0;
    const slots=anchor.slots ?? 1, slot=index%slots, wrap=Math.floor(index/slots);
    const position={x:anchor.x+slot*(anchor.dx ?? -34)+wrap*(anchor.wrapX ?? -34),y:anchor.y+slot*(anchor.dy ?? 0)+wrap*(anchor.wrapY ?? 0)};
    counts.set(key,index+1); positions.set(note.number,position);
    minX=Math.min(minX,position.x-22); minY=Math.min(minY,position.y-22);
    maxX=Math.max(maxX,position.x+22); maxY=Math.max(maxY,position.y+22);
  }
  return {positions,minX,minY,maxX,maxY};
}
