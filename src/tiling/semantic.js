import { detailValue } from './options.js';
/** Evaluate a stable full-detail scene, preventing collapse/reflow feedback loops. */
export class SemanticDetail {
  collapse(layout,{detail=1,width=1000,zoom=1,manual=new Set()}={}) {
    detailValue(detail);

    if (!Number.isFinite(width) || width<=0 || !Number.isFinite(zoom) || zoom<=0) { throw new Error('Viewport width and zoom must be positive.'); }

    const result=new Set(manual);
    const scale=width*zoom/layout.width;
    const children=new Map();
    for (const node of layout.nodes) {
      const list=children.get(node.resource.parent) ?? [];
      list.push(node);children.set(node.resource.parent,list);
    }
    for (const node of [...layout.nodes].sort((a,b)=>b.depth-a.depth)) {
      const list=children.get(node.resource.id) ?? [];

      if (!list.length || detail===1) { continue; }
      if (detail===0 || list.some(child=>child.w*scale<160*(1-detail) || child.h*scale<80*(1-detail))) { result.add(node.resource.id); }

    }
    return result;
  }
}
