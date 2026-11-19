const HEADER_HEIGHT=44;
const PORT_INSET=12;
const TRUNK_OFFSET=16;

/** Attach connections to facing sides; expanded groups expose their header only. */
export class ConnectionPorts {
  bounds(node) { return {x:node.x,y:node.y,w:node.w,h:node.container && !node.collapsed ? HEADER_HEIGHT : node.h}; }
  vertical(side) { return side==='top' || side==='bottom'; }
  sides(edge) {
    const from=this.bounds(edge.from),to=this.bounds(edge.to);
    const overlap=Math.min(from.x+from.w,to.x+to.w)-Math.max(from.x,to.x);

    if (overlap>2*PORT_INSET && (from.y+from.h<to.y || to.y+to.h<from.y)) {
      return from.y<to.y ? ['bottom','top'] : ['top','bottom'];
    }

    const rightward=to.x>from.x;
    return [rightward || to.x===from.x ? 'right' : 'left',rightward ? 'left' : 'right'];
  }

  assign(edges) {
    const ports=new Map();
    const assignments=edges.map(edge=>{
      const [fromSide,toSide]=this.sides(edge),pair={edge,fromSide,toSide};
      for (const [node,side,kind] of [[edge.from,fromSide,'start'],[edge.to,toSide,'end']]) {
        const key=node.resource.id+'\0'+side,list=ports.get(key) ?? [];
        list.push({pair,kind,other:kind==='start' ? edge.to : edge.from}); ports.set(key,list);
      }
      return pair;
    });
    for (const list of ports.values()) {
      const side=list[0].kind==='start' ? list[0].pair.fromSide : list[0].pair.toSide;
      const axis=this.vertical(side) ? 'x' : 'y',otherAxis=this.vertical(side) ? 'y' : 'x';
      list.sort((a,b)=>a.other[axis]-b.other[axis] || a.other[otherAxis]-b.other[otherAxis]);
      list.forEach(({pair,kind},index)=>{
        const node=kind==='start' ? pair.edge.from : pair.edge.to;
        const side=kind==='start' ? pair.fromSide : pair.toSide;
        pair[kind]=this.position(node,side,kind,index,list.length);
        pair[kind+'Lane']=node.container && node.collapsed ? (kind==='end' ? 1 : 2) : index+1;
      });
    }
    return assignments;
  }

  position(node,side,kind,index,count) {
    const rect=this.bounds(node),vertical=this.vertical(side);
    const bundled=node.container && node.collapsed;
    const near=(side==='right' || side==='bottom')===(kind==='start');
    const length=vertical ? rect.w : rect.h;
    let offset=PORT_INSET+(length-2*PORT_INSET)*(index+1)/(count+1);

    if (bundled) { offset=vertical ? length/2+(near ? -TRUNK_OFFSET : TRUNK_OFFSET) : near ? 32 : 64; }

    return vertical ? {x:rect.x+offset,y:side==='top' ? rect.y : rect.y+rect.h} : {x:side==='left' ? rect.x : rect.x+rect.w,y:rect.y+offset};
  }

  align(assignments,obstacles,intersects) {
    for (const pair of assignments) {
      const {edge,fromSide,toSide}=pair;

      if (fromSide===toSide || edge.from.collapsed || edge.to.collapsed) { continue; }

      const vertical=this.vertical(fromSide),axis=vertical ? 'x' : 'y',normal=vertical ? 'y' : 'x';
      const size=vertical ? 'w' : 'h',from=this.bounds(edge.from),to=this.bounds(edge.to);
      const low=Math.max(from[axis],to[axis])+PORT_INSET,high=Math.min(from[axis]+from[size],to[axis]+to[size])-PORT_INSET;

      if (low>high) { continue; }

      const value=Math.max(low,Math.min(high,(pair.start[axis]+pair.end[axis])/2));
      const start={...pair.start,[axis]:value},end={...pair.end,[axis]:value};
      const occupied=assignments.some(other=>other!==pair && ['start','end'].some(kind=>{
        const node=kind==='start' ? other.edge.from : other.edge.to;
        return ((node===edge.from && other[kind][normal]===start[normal]) || (node===edge.to && other[kind][normal]===end[normal])) && Math.abs(other[kind][axis]-value)<8;
      }));

      if (occupied || obstacles.some(rect=>intersects(start,end,rect))) { continue; }

      pair.start=start; pair.end=end;
    }
  }
}
