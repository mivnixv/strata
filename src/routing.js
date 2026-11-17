import { ConnectionEndLabels } from './connections/endpoints/labels.js';
import { TilePacker } from './tiling/packing.js';
/** Deterministic dependency layers and orthogonal, obstacle-aware edge routing. */
export class DependencyGrid {
  constructor(resources, relations) {
    this.resources = resources; this.relations = relations;
  }
  arrange(children, sizes, gap = 160, options={sizes:'auto',compactness:.6}) {
    gap=Math.round(gap*(1.3-.5*options.compactness));
    const rowGap=Math.round(96*(1.3-.5*options.compactness));
    const ids = new Set(children.map(r => r.id));
    const owner = new Map();
    for (const r of this.resources.values()) {
      let current = r;
      for (let depth = 0; current && depth <= 12; depth++, current = this.resources.get(current.parent)) {

        if (ids.has(current.id)) { owner.set(r.id,current.id); break; }

      }
    }
    const referenceOrder=new Map();
    for (const edge of this.relations) {
      for (const endpoint of [edge.from,edge.to]) {
        const id=owner.get(endpoint);
        if (id && !referenceOrder.has(id)) { referenceOrder.set(id,referenceOrder.size); }
      }
    }
    children=[...children].sort((a,b)=>(referenceOrder.get(a.id) ?? Infinity)-(referenceOrder.get(b.id) ?? Infinity));
    const outgoing = new Map(children.map(r => [r.id,new Set()]));
    const incoming = new Map(children.map(r => [r.id,new Set()]));
    for (const edge of this.relations) {
      const from = owner.get(edge.from), to = owner.get(edge.to);

      if (from && to && from !== to) { outgoing.get(from).add(to); incoming.get(to).add(from); }

    }
    if ([...outgoing.values()].every(targets => targets.size === 0)) { return new TilePacker().arrange(children,sizes,Math.round(48*(1.3-.5*options.compactness))); }

    const remaining = new Set(ids), ranks = new Map(children.map(r => [r.id,0]));
    // Kahn ordering. Break cycles deterministically without losing any node or edge.
    for (let step = 0; step < children.length; step++) {
      const candidates = children.filter(r => remaining.has(r.id));
      const next = candidates.find(r => [...incoming.get(r.id)].every(id => !remaining.has(id))) ?? candidates[0];
      remaining.delete(next.id);
      for (const target of outgoing.get(next.id)) {

        if (remaining.has(target)) { ranks.set(target,Math.max(ranks.get(target),ranks.get(next.id)+1)); }

      }
    }
    const columns = [];
    for (const r of children) {
      const rank = ranks.get(r.id);
      columns[rank] ??= []; columns[rank].push(r);
    }
    const positions = new Map(), order = new Map();
    let x = 0, height = 0;
    for (const column of columns) {
      let y = 0, width = 0;
      for (const r of column) {
        const size = sizes.get(r.id);
        positions.set(r.id,{x,y}); order.set(r.id,y+size.h/2);
        y += size.h+rowGap; width = Math.max(width,size.w);
      }
      height = Math.max(height,y-rowGap); x += width+gap;
    }
    return {positions,w:Math.max(0,x-gap),h:Math.max(0,height)};
  }
}
const routePadding = 20;
const diagonalClearance = 12;
function overlaps(a,b) { return Math.min(a[1],b[1])-Math.max(a[0],b[0]) > .01; }
export function segmentIntersectsRect(a,b,r) {

  let low=0,high=1;
  for (const [axis,min,max] of [['x',r.x,r.x+r.w],['y',r.y,r.y+r.h]]) {
    const delta=b[axis]-a[axis];

    if (delta===0) {
      if (a[axis]<=min || a[axis]>=max) { return false; }
      continue;
    }

    const first=(min-a[axis])/delta,last=(max-a[axis])/delta;
    low=Math.max(low,Math.min(first,last));
    high=Math.min(high,Math.max(first,last));
  }
  return high-low>1e-9;
}
/** Integrates occupied intervals so shared-channel costs are logarithmic per query. */
class RouteOccupancy {
  constructor() { this.axes = new Map(); }
  add(axis,a,b) {
    const data = this.axes.get(axis) ?? {events:new Map(),table:null};
    const lo = Math.min(a,b),hi = Math.max(a,b);
    data.events.set(lo,(data.events.get(lo) ?? 0)+1);
    data.events.set(hi,(data.events.get(hi) ?? 0)-1);
    data.table = null; this.axes.set(axis,data);
  }
  measure(axis,a,b) {
    const data = this.axes.get(axis);

    if (!data) { return 0; }
    if (!data.table) {
      let area = 0, rate = 0, previous = 0;
      data.table = [...data.events].sort((a,b) => a[0]-b[0]).map(([position,delta]) => {
        area += (position-previous)*rate; rate += delta; previous = position;
        return {position,area,rate};
      });
    }

    const integral = value => {
      const table = data.table; let lo = 0,hi = table.length;
      while (lo < hi) {
        const mid = (lo+hi) >> 1;

        if (table[mid].position <= value) { lo = mid+1; } else { hi = mid; }

      }
      const entry = table[lo-1];
      return entry ? entry.area+(value-entry.position)*entry.rate : 0;
    };
    return integral(Math.max(a,b))-integral(Math.min(a,b));
  }
}
/** Binary heap keeps routing work bounded by the finite visibility grid. */
class RouteQueue {
  constructor() { this.items = []; }
  push(item) {
    const a = this.items; a.push(item); let i = a.length-1;
    while (i > 0) {
      const parent = (i-1) >> 1;

      if (a[parent].score <= item.score) { break; }

      a[i] = a[parent]; i = parent;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();

    if (!a.length) { return first; }

    let i = 0;
    while (2*i+1 < a.length) {
      let child = 2*i+1;

      if (child+1 < a.length && a[child+1].score < a[child].score) { child++; }
      if (last.score <= a[child].score) { break; }

      a[i] = a[child]; i = child;
    }
    a[i] = last; return first;
  }
}
export class OrthogonalRouter {
  constructor(nodes) {
    // Group interiors are navigable; their headers and resource cards are obstacles.
    this.obstacles = nodes.map(n => ({id:n.resource.id,x:n.x,y:n.y,w:n.w,h:n.container && !n.collapsed ? 44 : n.h}));
    this.horizontalSegments = new RouteOccupancy(); this.verticalSegments = new RouteOccupancy();
    this.horizontalObstacles = new Map(); this.verticalObstacles = new Map();
    this.xs = new Set([24]); this.ys = new Set([24]);
    for (const r of this.obstacles) {
      for (const distance of (nodes.some(node => node.collapsed) ? [routePadding,routePadding+12] : [routePadding,routePadding+6,routePadding+12,routePadding+18,routePadding+24])) {
        this.xs.add(r.x-distance); this.xs.add(r.x+r.w+distance);
        this.ys.add(r.y-distance); this.ys.add(r.y+r.h+distance);
      }
    }
  }
  route(edges) {
    const ports = new Map();
    const assignments = edges.map(edge => {
      const rightward = edge.to.x > edge.from.x;
      const sameColumn = edge.to.x === edge.from.x;
      const fromSide = rightward || sameColumn ? 'right' : 'left';
      const toSide = rightward ? 'left' : 'right';
      const pair = {edge,fromSide,toSide};
      for (const [node,side,kind] of [[edge.from,fromSide,'start'],[edge.to,toSide,'end']]) {
        const key = node.resource.id+'\0'+side, list = ports.get(key) ?? [];
        list.push({pair,kind,other:kind === 'start' ? edge.to : edge.from}); ports.set(key,list);
      }
      return pair;
    });
    for (const list of ports.values()) {
      list.sort((a,b) => a.other.y-b.other.y || a.other.x-b.other.x);
      list.forEach(({pair,kind},i) => {
        const node = kind === 'start' ? pair.edge.from : pair.edge.to;
        const side = kind === 'start' ? pair.fromSide : pair.toSide;
        const h = node.container && !node.collapsed ? 44 : node.h;
        const bundled = node.container && node.collapsed;
        const upper = (side === 'right') === (kind === 'start');
        pair[kind] = {x:side === 'right' ? node.x+node.w : node.x,y:bundled ? node.y+(upper ? 32 : 64) : node.y+12+(h-24)*(i+1)/(list.length+1)};
        pair[kind+'Lane'] = bundled ? (kind === 'end' ? 1 : 2) : i+1;
      });
    }
    this.alignPorts(assignments);
    // Reserve every endpoint stub before routing so earlier edges cannot occupy later ports.
    for (const pair of assignments) {
      pair.a = this.portStub(pair.start,pair.fromSide,pair.startLane);
      pair.b = this.portStub(pair.end,pair.toSide,pair.endLane);
      for (const [port,stub] of [[pair.start,pair.a],[pair.end,pair.b]]) {
        for (const offset of [-3,0,3]) { this.xs.add(stub.x+offset); this.ys.add(stub.y+offset); }
        this.horizontalSegments.add(port.y,port.x,stub.x);
      }
    }
    const routed = assignments.map(pair => this.routeEdge(pair));
    for (const edge of routed) { edge.points=this.slantRoute(edge.points); }
    this.placeLabels(routed);
    return routed;
  }
  slantRoute(points) {
    const result=points.map(point=>({...point}));
    const paddedObstacles=this.obstacles.map(rect=>({
      x:rect.x-diagonalClearance,y:rect.y-diagonalClearance,
      w:rect.w+2*diagonalClearance,h:rect.h+2*diagonalClearance
    }));
    // Move both ends of each vertical run: keep one full diagonal, not bevels.
    for (let i=1;i<points.length-2;i++) {
      const before=result[i-1],a=result[i],b=result[i+1],after=result[i+2];

      if (a.x!==b.x || before.y!==a.y || after.y!==b.y) { continue; }

      for (let attempt=0;attempt<16;attempt++) {
        const fraction=.45/2**attempt;
        const start={x:a.x+(before.x-a.x)*fraction,y:a.y};
        const end={x:b.x+(after.x-b.x)*fraction,y:b.y};

        // Equal return runs need asymmetric shifts to avoid another vertical.
        if (Math.abs(start.x-end.x)<1e-9) { end.x=b.x+(end.x-b.x)*.5; }
        if (paddedObstacles.some(rect=>segmentIntersectsRect(start,end,rect))) { continue; }

        result[i]=start;result[i+1]=end;
        break;
      }
    }
    return result;
  }
  alignPorts(assignments) {
    for (const pair of assignments) {
      const {edge,fromSide,toSide}=pair;

      if (fromSide===toSide || edge.from.collapsed || edge.to.collapsed) { continue; }

      const low=Math.max(edge.from.y,edge.to.y)+12;
      const high=Math.min(edge.from.y+(edge.from.container ? 44 : edge.from.h),edge.to.y+(edge.to.container ? 44 : edge.to.h))-12;

      if (low>high) { continue; }

      const y=Math.max(low,Math.min(high,(pair.start.y+pair.end.y)/2));
      const start={x:pair.start.x,y},end={x:pair.end.x,y};
      const occupied=assignments.some(other=>other!==pair && ['start','end'].some(kind=>{
        const node=kind==='start' ? other.edge.from : other.edge.to;
        return ((node===edge.from && other[kind].x===start.x) || (node===edge.to && other[kind].x===end.x)) && Math.abs(other[kind].y-y)<8;
      }));

      if (occupied || this.obstacles.some(rect=>segmentIntersectsRect(start,end,rect))) { continue; }

      pair.start=start;pair.end=end;
    }
  }
  simplePath(a,b) {
    const middle=(a.x+b.x)/2;
    const candidates=[
      [a,{x:b.x,y:a.y},b],
      [a,{x:a.x,y:b.y},b],
      [a,{x:middle,y:a.y},{x:middle,y:b.y},b]
    ];
    return candidates.find(points=>points.slice(1).every((end,i)=>{
      const start=points[i],horizontal=start.y===end.y;
      const occupancy=horizontal ? this.horizontalSegments : this.verticalSegments;
      return !this.obstacles.some(rect=>segmentIntersectsRect(start,end,rect)) && occupancy.measure(horizontal ? start.y : start.x,horizontal ? start.x : start.y,horizontal ? end.x : end.y)<.001;
    }));
  }
  portStub(point,side,lane) {
    const right = side === 'right';
    const distances = this.obstacles.filter(r => point.y > r.y && point.y < r.y+r.h).map(r => right ? r.x-point.x : point.x-r.x-r.w).filter(d => d > 0);
    const clearance = distances.reduce((min,d) => Math.min(min,d-2),Infinity);
    const offset = Math.min(routePadding+lane*3,clearance/2);
    return {x:point.x+(right ? offset : -offset),y:point.y};
  }
  routeEdge({edge,start,end,a,b}) {
    const points = this.simplePath(a,b) ?? this.findPath(a,b,false) ?? this.findPath(a,b,true);

    if (!points) { throw new Error('No clear connection route exists between resource ports.'); }

    const route = [start,...points,end];
    const compact = route.filter((point,i) => {
      const before = route[i-1], after = route[i+1];
      return !before || !after || !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
    });
    for (let i = 1; i < compact.length; i++) {
      const a = compact[i-1],b = compact[i];
      const map = a.y === b.y ? this.horizontalSegments : this.verticalSegments;
      const key = a.y === b.y ? a.y : a.x;
      map.add(key,a.y === b.y ? a.x : a.y,a.y === b.y ? b.x : b.y);
    }
    return {...edge,points:compact,label:edge.label,labelPosition:null};
  }
  placeLabels(edges) {
    const occupied = [];
    new ConnectionEndLabels().place(edges,this.obstacles,occupied,segmentIntersectsRect);
    occupied.push(...this.obstacles);
    for (const edge of edges) {

      if (!edge.label) { continue; }

      const width = Math.min(40,edge.label.length)*12+10;
      const segments = edge.points.slice(1).map((b,i) => ({a:edge.points[i],b})).filter(s => s.a.y === s.b.y && Math.abs(s.a.x-s.b.x) >= width+8);
      segments.sort((a,b) => Math.abs(b.b.x-b.a.x)-Math.abs(a.b.x-a.a.x));
      const candidates = segments.flatMap(({a,b}) => [-10,22].map(offset => ({x:(a.x+b.x)/2,y:a.y+offset})));
      for (const p of candidates) {
        const box = {x:p.x-width/2,y:p.y-20,w:width,h:28};

        if (box.x < 16 || box.y < 16) { continue; }
        if (edges.some(other => other !== edge && other.points.slice(1).some((b,i) => segmentIntersectsRect(other.points[i],b,box)))) { continue; }
        if (occupied.some(r => box.x < r.x+r.w+4 && box.x+box.w > r.x-4 && box.y < r.y+r.h+4 && box.y+box.h > r.y-4)) { continue; }

        edge.labelPosition = {...p,width:width-10}; occupied.push(box); break;
      }
    }
  }
  findPath(start,end,allowShared) {
    const xs = [...new Set([...this.xs,start.x,end.x])].sort((a,b)=>a-b);
    const ys = [...new Set([...this.ys,start.y,end.y])].sort((a,b)=>a-b);
    const width = xs.length, startX = xs.indexOf(start.x), startY = ys.indexOf(start.y);
    const endX = xs.indexOf(end.x), endY = ys.indexOf(end.y);
    const encode = (x,y,dir) => (y*width+x)*3+dir;
    const queue = new RouteQueue(), distances = new Map(), parents = new Map();
    const initial = encode(startX,startY,0); distances.set(initial,0);
    queue.push({x:startX,y:startY,dir:0,key:initial,cost:0,score:0});
    let terminal = null;
    // Every state is a grid coordinate plus its arrival orientation, visited at most once.
    const visited = new Set();
    while (queue.items.length) {
      const current = queue.pop();

      if (visited.has(current.key)) { continue; }

      visited.add(current.key);

      if (current.x === endX && current.y === endY) { terminal = current.key; break; }

      for (const [dx,dy,dir] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]) {
        const x = current.x+dx,y = current.y+dy;

        if (x < 0 || x >= xs.length || y < 0 || y >= ys.length) { continue; }

        const key = encode(x,y,dir);

        if (visited.has(key)) { continue; }

        const a = {x:xs[current.x],y:ys[current.y]}, b = {x:xs[x],y:ys[y]};

        const horizontal = dir === 1;
        const obstacleMap = horizontal ? this.horizontalObstacles : this.verticalObstacles;
        const axis = horizontal ? a.y : a.x;

        if (!obstacleMap.has(axis)) {
          obstacleMap.set(axis,this.obstacles.filter(r => horizontal ? axis > r.y && axis < r.y+r.h : axis > r.x && axis < r.x+r.w));
        }
        if (obstacleMap.get(axis).some(r => segmentIntersectsRect(a,b,r))) { continue; }

        const distance = Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
        const occupancy = horizontal ? this.horizontalSegments : this.verticalSegments;
        const shared = occupancy.measure(axis,horizontal ? a.x : a.y,horizontal ? b.x : b.y);
        if (!allowShared && shared > .001) { continue; }

        const cost = current.cost+distance+shared*64+(current.dir && current.dir !== dir ? 1 : 0);

        if (cost >= (distances.get(key) ?? Infinity)) { continue; }

        distances.set(key,cost); parents.set(key,current.key);
        queue.push({x,y,dir,key,cost,score:cost+Math.abs(b.x-end.x)+Math.abs(b.y-end.y)});
      }
    }

    if (terminal === null) { return null; }

    const path = [];
    for (let step = 0; terminal !== undefined && step <= visited.size; step++) {
      const cell = Math.floor(terminal/3);
      path.push({x:xs[cell%width],y:ys[Math.floor(cell/width)]}); terminal = parents.get(terminal);
    }
    return path.reverse();
  }
}
