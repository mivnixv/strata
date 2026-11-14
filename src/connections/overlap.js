/** Find interior crossings or shared segments; touching endpoints are not crossings. */
export function routesOverlap(first,second) {
  for (let i=1;i<first.length;i++) {
    const a=first[i-1],b=first[i];
    for (let j=1;j<second.length;j++) {
      const c=second[j-1],d=second[j];
      const cross=(x,y)=>x.x*y.y-x.y*y.x;
      const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y};
      const offset={x:c.x-a.x,y:c.y-a.y},denominator=cross(r,s);

      if (Math.abs(denominator)>1e-9) {
        const t=cross(offset,s)/denominator,u=cross(offset,r)/denominator;

        if (t>1e-9 && t<1-1e-9 && u>1e-9 && u<1-1e-9) { return true; }

      } else if (Math.abs(cross(offset,r))<1e-9) {
        const axis=Math.abs(r.x)>Math.abs(r.y) ? 'x' : 'y';

        if (Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))>.01) { return true; }

      }
    }
  }
  return false;
}
export function sharedTrunk(first,second) {
  return (first.from===second.from && first.from.container && first.from.collapsed) || (first.to===second.to && first.to.container && first.to.collapsed);
}
export function endpointFade(points,end=false) {
  const tip=end ? points.at(-1) : points[0],next=end ? points.at(-2) : points[1];
  const distance=Math.hypot(next.x-tip.x,next.y-tip.y),ratio=distance ? Math.min(1,24/distance) : 0;
  const inner={x:tip.x+(next.x-tip.x)*ratio,y:tip.y+(next.y-tip.y)*ratio};
  return {tip,inner};
}
export function endpointStroke(points,end=false) {
  const {tip,inner}=endpointFade(points,end);
  return end ? `M ${inner.x} ${inner.y} L ${tip.x} ${tip.y}` : `M ${tip.x} ${tip.y} L ${inner.x} ${inner.y}`;
}

/** Only visible upper routes can obscure lower routes. */
export function coveredConnections(edges,protectedEdge=()=>false) {
  const visible=[],covered=new Set();
  for (let index=edges.length-1;index>=0;index--) {
    const edge=edges[index];
    const underneath=!protectedEdge(edge) && visible.some(other=>!sharedTrunk(edge,other) && routesOverlap(edge.points,other.points));

    if (underneath) { covered.add(edge); }
    else { visible.push(edge); }

  }
  return covered;
}
