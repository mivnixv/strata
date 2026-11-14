/** Stable shelf packing: evaluate bounded row widths without reordering tiles. */
export class TilePacker {
  arrange(children,sizes,gap=48) {
    if (!children.length) { return {positions:new Map(),w:0,h:0}; }
    const widest = Math.max(...children.map(r => sizes.get(r.id).w));
    const total = children.reduce((sum,r) => sum+sizes.get(r.id).w+gap,0)-gap;
    let best = null;
    for (let step=0;step<children.length;step++) {
      const limit = widest+(total-widest)*step/Math.max(1,children.length-1);
      const positions = new Map(); let x=0,y=0,rowHeight=0,w=0;
      for (const resource of children) {
        const size=sizes.get(resource.id);

        if (x && x+size.w>limit) { y+=rowHeight+gap;x=0;rowHeight=0; }

        positions.set(resource.id,{x,y});w=Math.max(w,x+size.w);
        x+=size.w+gap;rowHeight=Math.max(rowHeight,size.h);
      }
      const h=y+rowHeight;
      const score=w*h*(1+Math.abs(Math.log((w/h)/1.6))*.35);

      if (!best || score<best.score) { best={positions,w,h,score}; }

    }
    return {positions:best.positions,w:best.w,h:best.h};
  }
}
