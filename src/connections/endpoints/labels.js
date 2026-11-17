export const ENDPOINT_LABEL_PORT_GAP=64;

/** Endpoint labels sit beside their terminal segment, outside resource bounds. */
export class ConnectionEndLabels {
  place(edges,obstacles,occupied,intersects) {
    for (const edge of edges) {
      for (const end of ['start','end']) {
        const text=edge[end+'Label'];

        if (!text) { continue; }

        const points=end==='start' ? edge.points : [...edge.points].reverse();
        const tip=points[0], next=points.find(point=>point.x!==tip.x || point.y!==tip.y);

        if (!next) { continue; }

        const dx=next.x-tip.x, dy=next.y-tip.y, distance=Math.hypot(dx,dy);
        const ux=dx/distance, uy=dy/distance;
        const horizontal=Math.abs(ux)>=Math.abs(uy);
        const available=horizontal ? Math.abs(dx)/(edge.startLabel && edge.endLabel ? 2 : 1)-24 : 160;
        const width=Math.min(240,text.length*10+8,Math.max(32,available));
        const offset=horizontal ? width/2+14 : 24;
        for (const side of [-1,1]) {
          const x=tip.x+ux*offset+(horizontal ? 0 : side*(width/2+12));
          const y=tip.y+uy*offset+(horizontal ? (side<0 ? -10 : 22) : 0);
          const box={x:x-width/2-4,y:y-16,w:width+8,h:24};

          if (box.x<0 || box.y<0) { continue; }
          if ([...obstacles,...occupied].some(r=>box.x<r.x+r.w+4 && box.x+box.w>r.x-4 && box.y<r.y+r.h+4 && box.y+box.h>r.y-4)) { continue; }
          if (edges.some(other=>other!==edge && other.points.slice(1).some((b,i)=>intersects(other.points[i],b,box)))) { continue; }

          edge[end+'LabelPosition']={x,y,width}; occupied.push(box); break;
        }
      }
    }
  }
  render(edge,element,textFit,attrs) {
    const labels=[];
    for (const end of ['start','end']) {
      const position=edge[end+'LabelPosition'];

      if (!position) { continue; }

      const fitted=textFit.fit(edge[end+'Label'],position.width,{max:16});
      const label=element('text',{...attrs,'data-end-label':end,x:position.x,y:position.y,'font-size':fitted.size},fitted.text);
      label.append(element('title',{},edge[end+'Label']));
      labels.push(label);
    }
    return labels;
  }
}
