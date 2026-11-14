/** Allocate the full parent rectangle to weighted columns and their child tiles. */
export class TileAllocation {
  allocate(children,sizes,grid,width=grid.w,height=grid.h) {
    const columns = new Map();
    for (const resource of children) {
      const position=grid.positions.get(resource.id);
      const column=columns.get(position.x) ?? [];
      column.push(resource);columns.set(position.x,column);
    }
    const ordered=[...columns].sort((a,b)=>a[0]-b[0]);
    const result=new Map();
    const overlaps=ordered.some(([left,column],i)=>i+1<ordered.length && left+Math.max(...column.map(r=>sizes.get(r.id).w))>ordered[i+1][0]);

    if (overlaps) {
      for (const resource of children) {
        const position=grid.positions.get(resource.id),size=sizes.get(resource.id);
        result.set(resource.id,{x:position.x*width/grid.w,y:position.y*height/grid.h,w:size.w*width/grid.w,h:size.h*height/grid.h});
      }
      return result;
    }

    for (let index=0;index<ordered.length;index++) {
      const [left,column]=ordered[index];
      column.sort((a,b)=>grid.positions.get(a.id).y-grid.positions.get(b.id).y);
      const minWidth=Math.max(...column.map(r=>sizes.get(r.id).w));
      const right=index+1<ordered.length ? ordered[index+1][0] : grid.w;
      const gap=index+1<ordered.length ? right-left-minWidth : 0;
      const x=left*width/grid.w;
      const w=(right-left)*width/grid.w-gap;
      const gaps=column.slice(1).map((r,i)=>grid.positions.get(r.id).y-grid.positions.get(column[i].id).y-sizes.get(column[i].id).h);
      const minimum=column.reduce((sum,r)=>sum+sizes.get(r.id).h,0)+gaps.reduce((sum,n)=>sum+n,0);
      const extra=Math.max(0,height-minimum);
      const weight=column.reduce((sum,r)=>sum+sizes.get(r.id).weight,0);
      let y=0;
      for (let i=0;i<column.length;i++) {
        const resource=column[i],size=sizes.get(resource.id);
        const h=size.h+extra*size.weight/weight;
        result.set(resource.id,{x,y,w,h});
        y+=h+(gaps[i] ?? 0);
      }
    }
    return result;
  }
}
