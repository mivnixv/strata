export const CONNECTION_ENDPOINT_LENGTH = 25.6;

/** Clip a short endpoint segment by route distance, including bends. */
export function connectionEndpoint(points,end=false) {
  const oriented=end ? [...points].reverse() : points;
  const total=points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-points[index].x,point.y-points[index].y),0);
  const length=Math.min(CONNECTION_ENDPOINT_LENGTH,total/2);
  const clipped=[oriented[0]];
  let remaining=length;
  for (let index=1; index<oriented.length && remaining>0; index++) {
    const first=oriented[index-1],second=oriented[index];
    const distance=Math.hypot(second.x-first.x,second.y-first.y);

    if (distance===0) { continue; }

    const ratio=Math.min(1,remaining/distance);
    clipped.push({x:first.x+(second.x-first.x)*ratio,y:first.y+(second.y-first.y)*ratio});
    remaining-=Math.min(remaining,distance);
  }
  const tip=clipped[0],inner=clipped.at(-1);
  const route=end ? [...clipped].reverse() : clipped;
  return {tip,inner,d:route.map((point,index)=>`${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),offset:end ? total-length : 0};
}
