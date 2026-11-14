import { DependencyGrid } from '../routing.js';
import { TileAllocation } from './allocation.js';
import { tileOptions } from './options.js';

/** Bottom-up minimum/weight calculation followed by top-down rectangle allocation. */
export class HierarchicalTiles {
  constructor({maxDepth=12}={}) { this.maxDepth=maxDepth; }
  create(resources,children,relations,visible,view,collapsed) {
    const sizes = new Map(), grids = new Map();
    const ordered = [...resources.values()].filter(r => visible.has(r.id));
    const dependencyGrid = new DependencyGrid(resources,relations.filter(e => visible.has(e.from) && visible.has(e.to)));
    const degree = new Map([...resources.values()].map(r => [r.id,0]));
    for (const edge of relations.filter(e => visible.has(e.from) && visible.has(e.to))) {
      degree.set(edge.from,degree.get(edge.from)+1); degree.set(edge.to,degree.get(edge.to)+1);
    }
    for (let pass = 0; pass <= this.maxDepth; pass++) {
      for (const r of ordered) {

        if (sizes.has(r.id)) { continue; }

        const list = collapsed.has(r.id) ? [] : children.get(r.id) ?? [];

        if (!list.length) { sizes.set(r.id,{w:240+Math.min(120,degree.get(r.id)*8),h:Math.max(120+degree.get(r.id)*4,64+degree.get(r.id)*14),weight:1+degree.get(r.id)*.25}); continue; }
        if (list.every(c => sizes.has(c.id))) {
          const options=tileOptions(r,view);
          const degrees=list.map(c=>degree.get(c.id));
          const uniform=options.sizes==='uniform' || (options.sizes==='auto' && Math.max(...degrees)===Math.min(...degrees));
          if (uniform) {
            const w=Math.max(...list.map(c=>sizes.get(c.id).w)),h=Math.max(...list.map(c=>sizes.get(c.id).h));
            for (const child of list) { sizes.set(child.id,{...sizes.get(child.id),w,h,weight:1}); }
          }
          const grid = dependencyGrid.arrange(list,sizes,160,options);
          grids.set(r.id,grid);
          sizes.set(r.id,{w:Math.max(288,grid.w+96),h:grid.h+120,weight:list.reduce((sum,c)=>sum+sizes.get(c.id).weight,0)});
        }

      }
    }
    const nodes = [];
    const roots = children.get(null) ?? [];
    if (view.sizes==='uniform' && roots.length) {
      const w=Math.max(...roots.map(r=>sizes.get(r.id).w)),h=Math.max(...roots.map(r=>sizes.get(r.id).h));
      for (const resource of roots) { sizes.set(resource.id,{...sizes.get(resource.id),w,h,weight:1}); }
    }
    const rootGrid = dependencyGrid.arrange(roots,sizes,160,view);
    const allocator=new TileAllocation();
    const rootTiles=allocator.allocate(roots,sizes,rootGrid);
    const queue = roots.map(resource => ({resource,...rootTiles.get(resource.id),x:rootTiles.get(resource.id).x+72,y:rootTiles.get(resource.id).y+72,depth:0}));
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i], size = sizes.get(entry.resource.id);
      const list = children.get(entry.resource.id) ?? [];
      nodes.push({...size,...entry,container:list.length > 0,collapsed:list.length>0 && collapsed.has(entry.resource.id)});

      if (collapsed.has(entry.resource.id)) { continue; }

      const tiles=list.length ? allocator.allocate(list,sizes,grids.get(entry.resource.id),entry.w-96,entry.h-120) : new Map();
      for (const child of list) {
        const position = tiles.get(child.id);
        queue.push({resource:child,...position,x:entry.x+48+position.x,y:entry.y+72+position.y,depth:entry.depth+1});
      }
    }
    return {nodes,rootGrid};
  }
}
