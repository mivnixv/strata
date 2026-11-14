import { resolveTheme } from './themes/themes.js';
import { TextFit } from './typography/fit.js';
import { IconTint } from './icons/tint.js';
import { iconId } from './icons/library.js';
import { ConnectionHover } from './connections/hover.js';
import { coveredConnections, endpointStroke, endpointFade } from './connections/overlap.js';
import { tileIconPlacement } from './icons/tile-icon.js';
import { tileOptions, detailValue } from './tiling/options.js';
import { SemanticDetail } from './tiling/semantic.js';
import { HierarchicalTiles } from './tiling/engine.js';
import { DiagramMotion } from './motion.js';
import { OrthogonalRouter } from './routing.js';
/** Strata: dependency-free, model-first architecture diagrams. */
export const LIMITS = Object.freeze({ resources: 300, relations: 1000, perspectives: 30, depth: 12, bytes: 1_000_000 });
const palette = { app: '#b39aff', service: '#7cb8fa', database: '#ecc070', infrastructure: '#83cdb2', external: '#b7acc8' };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, label) => {

  if (typeof value !== 'string' || !value.trim() || value.length > 500) {
    throw new Error(`${label} must be a nonempty string of at most 500 characters.`);
  }

  return value;
};
export function validateModel(input) {

  if (!object(input)) { throw new Error('The diagram must be an object.'); }

  const title = string(input.title, 'Title');

  if (!Array.isArray(input.resources) || input.resources.length > LIMITS.resources) {
    throw new Error(`Resources must be an array of at most ${LIMITS.resources} items.`);
  }

  const ids = new Set();
  const resources = input.resources.map(resource => {

    if (!object(resource)) { throw new Error('Each resource must be an object.'); }

    const id = string(resource.id, 'Resource ID');

    if (ids.has(id)) { throw new Error(`Duplicate resource ID: ${id}`); }

    ids.add(id);
    const type = resource.type ?? 'service';

    if (!Object.hasOwn(palette, type)) { throw new Error(`Unknown resource type: ${type}`); }

    const parent = resource.parent == null ? null : string(resource.parent, 'Parent ID');
    const description = resource.description ?? '';

    if (typeof description !== 'string' || description.length > 5000) { throw new Error('Descriptions must be strings of at most 5000 characters.'); }

    tileOptions(resource);
    return { id, icon:iconId(resource.icon), name: string(resource.name, 'Resource name'), type, parent, description, sizes:resource.sizes ?? null, compactness:resource.compactness ?? null };
  });
  const byId = new Map(resources.map(r => [r.id, r]));
  for (const resource of resources) {
    let current = resource;
    const seen = new Set([resource.id]);
    for (let depth = 0; current.parent !== null; depth++) {

      if (depth >= LIMITS.depth) { throw new Error(`Nesting exceeds ${LIMITS.depth} levels.`); }
      if (!byId.has(current.parent)) { throw new Error(`Unknown parent: ${current.parent}`); }
      if (seen.has(current.parent)) { throw new Error('Resource hierarchy contains a cycle.'); }

      seen.add(current.parent);
      current = byId.get(current.parent);
    }
  }

  if (!Array.isArray(input.relations) || input.relations.length > LIMITS.relations) { throw new Error(`Relations must be an array of at most ${LIMITS.relations} items.`); }

  const validateRelations = values => values.map(relation => {

    if (!object(relation) || !ids.has(relation.from) || !ids.has(relation.to)) { throw new Error('Every relation must reference existing resource IDs.'); }

    const label = relation.label ?? '';

    if (typeof label !== 'string' || label.length > 500) { throw new Error('Relation labels must be strings of at most 500 characters.'); }

    return { from: relation.from, to: relation.to, label };
  });

  const relations = validateRelations(input.relations);
  let relationCount = relations.length;

  if (!Array.isArray(input.perspectives) || !input.perspectives.length || input.perspectives.length > LIMITS.perspectives) { throw new Error(`Define 1–${LIMITS.perspectives} perspectives.`); }

  const viewIds = new Set();
  const perspectives = input.perspectives.map(view => {

    if (!object(view)) { throw new Error('Each perspective must be an object.'); }

    const id = string(view.id, 'Perspective ID');

    if (viewIds.has(id)) { throw new Error(`Duplicate perspective ID: ${id}`); }
    if (view.resources != null && (!Array.isArray(view.resources) || view.resources.some(id => !ids.has(id)))) { throw new Error('Perspectives must reference existing resource IDs.'); }
    if (view.relations !== undefined && !Array.isArray(view.relations)) { throw new Error('Perspective relationships must be an array.'); }

    const localRelations = view.relations ?? [];
    relationCount += localRelations.length;

    if (relationCount > LIMITS.relations) { throw new Error(`Define at most ${LIMITS.relations} total global and perspective relationships.`); }

    const inheritGlobalRelations = view.inheritGlobalRelations === undefined ? true : view.inheritGlobalRelations;

    if (typeof inheritGlobalRelations !== 'boolean') { throw new Error('inheritGlobalRelations must be a boolean.'); }

    const description = view.description ?? '';

    if (typeof description !== 'string' || description.length > 5000) { throw new Error('Perspective descriptions must be strings of at most 5000 characters.'); }

    viewIds.add(id);
    return { ...tileOptions(view), detail:detailValue(view.detail ?? 1), id, name: string(view.name, 'Perspective name'), description, resources: view.resources == null ? null : [...new Set(view.resources)], relations: validateRelations(localRelations), inheritGlobalRelations };
  });
  return { title, resources, relations, perspectives };
}
export function parseModel(source) {

  if (typeof source !== 'string' || new TextEncoder().encode(source).length > LIMITS.bytes) { throw new Error('Diagram source must be under 1 MB.'); }

  return validateModel(JSON.parse(source));
}
/** Global relationships are inherited by default; local relationships never leak to other views. */
export function relationsForPerspective(model,view) {
  const unique = new Map();
  for (const edge of [...(view.inheritGlobalRelations ? model.relations : []),...view.relations]) {
    const key = JSON.stringify([edge.from,edge.to,edge.label]);
    unique.set(key,edge);
  }
  return [...unique.values()];
}
export class DiagramLayout {
  constructor(model) { this.model = validateModel(model); }
  create(viewId, collapsed = new Set()) {
    const model = this.model;
    const view = model.perspectives.find(p => p.id === viewId) ?? model.perspectives[0];
    const resources = new Map(model.resources.map(r => [r.id, r]));
    const relations = relationsForPerspective(model,view);
    const contextResources = view.resources ?? [];
    const inferred = view.relations.length ? view.relations : relations;
    const visible = new Set(view.resources ?? inferred.flatMap(e => [e.from,e.to]));
    for (const edge of view.relations) { visible.add(edge.from); visible.add(edge.to); }
    // Include context ancestors; listing a container includes its complete subtree.
    for (const resource of model.resources) {
      let current = resource;
      for (let depth = 0; current && depth <= LIMITS.depth; depth++, current = resources.get(current.parent)) {

        if (contextResources.includes(current.id)) { visible.add(resource.id); break; }

      }
    }
    for (const id of [...visible]) {
      let current = resources.get(id);
      for (let depth = 0; current && depth <= LIMITS.depth; depth++, current = resources.get(current.parent)) { visible.add(current.id); }
    }
    const children = new Map();
    for (const r of model.resources.filter(r => visible.has(r.id))) {
      const list = children.get(r.parent) ?? [];
      list.push(r); children.set(r.parent, list);
    }
    const {nodes,rootGrid}=new HierarchicalTiles({maxDepth:LIMITS.depth}).create(resources,children,relations,visible,view,collapsed);
    const nodeMap = new Map(nodes.map(n => [n.resource.id, n]));
    const representative = id => {
      let r = resources.get(id);
      for (let depth = 0; r && depth <= LIMITS.depth; depth++, r = resources.get(r.parent)) {

        if (nodeMap.has(r.id)) { return nodeMap.get(r.id); }

      }
      return null;
    };
    const edges = [];
    const edgeGroups = new Map();
    for (const relation of relations) {

      if (!visible.has(relation.from) || !visible.has(relation.to)) { continue; }

      const from = representative(relation.from), to = representative(relation.to);

      if (!from || !to || from === to) { continue; }

      const bundled = (from.container && from.collapsed) || (to.container && to.collapsed);
      const key = JSON.stringify([from.resource.id,to.resource.id,bundled ? null : relation.label]);
      const existing = edgeGroups.get(key);

      if (existing) {
        existing.relationships.push(relation);
        existing.label = `${existing.relationships.length} relationships`;
      } else {
        const edge = {...relation,from,to,relationships:[relation]};
        edges.push(edge); edgeGroups.set(key,edge);
      }

    }
    const routed = new OrthogonalRouter(nodes).route(edges);
    const points = routed.flatMap(edge => edge.points);
    const minX = points.reduce((min,p) => Math.min(min,p.x-24),0);
    const minY = points.reduce((min,p) => Math.min(min,p.y-24),0);
    // Shift the complete scene when back edges need channels above or left of groups.
    for (const node of nodes) { node.x -= minX; node.y -= minY; }
    for (const edge of routed) {
      for (const point of edge.points) { point.x -= minX; point.y -= minY; }
      if (edge.labelPosition) { edge.labelPosition.x -= minX; edge.labelPosition.y -= minY; }
    }
    return {nodes,edges:routed,width:points.reduce((max,p) => Math.max(max,p.x+40),Math.max(700,rootGrid.w+144-minX)),height:points.reduce((max,p) => Math.max(max,p.y+40),Math.max(420,rootGrid.h+144-minY))};
  }
}
/** Selection follows rendered edges, including relationships rolled up by collapsed groups. */
export function selectionFocus(layout,selected,resources) {
  const visible = new Map(layout.nodes.map(n => [n.resource.id,n]));
  const byId = new Map(resources.map(r => [r.id,r]));
  let primary = null, current = byId.get(selected);
  for (let depth = 0; current && depth <= LIMITS.depth; depth++,current = byId.get(current.parent)) {

    if (visible.has(current.id) && (current.id === selected || visible.get(current.id).collapsed)) { primary = current.id; break; }

  }
  const nodes = new Set(), edges = new Set(), context = new Set();

  if (primary === null) { return {primary,nodes,edges,context}; }

  nodes.add(primary);
  // Keep the selected subtree readable without focusing neighbors' children.
  for (const node of layout.nodes) {
    let ancestor = byId.get(node.resource.parent);
    for (let depth = 0; ancestor && depth <= LIMITS.depth; depth++,ancestor = byId.get(ancestor.parent)) {

      if (ancestor.id === primary) { nodes.add(node.resource.id); break; }

    }
  }
  for (const edge of layout.edges) {

    if (edge.from.resource.id === primary || edge.to.resource.id === primary) {
      edges.add(edge); nodes.add(edge.from.resource.id); nodes.add(edge.to.resource.id);
    }

  }
  for (const id of nodes) {
    let ancestor = byId.get(byId.get(id)?.parent);
    for (let depth = 0; ancestor && depth <= LIMITS.depth; depth++,ancestor = byId.get(ancestor.parent)) {

      if (visible.has(ancestor.id) && !nodes.has(ancestor.id)) { context.add(ancestor.id); }

    }
  }
  return {primary,nodes,edges,context};
}
const NS = 'http://www.w3.org/2000/svg';
let diagramSequence = 0;
export function svgElement(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) { el.setAttribute(key, String(value)); }

  if (text !== undefined) { el.textContent = text; }

  return el;
}
export class StrataDiagram {
  constructor(element, { onSelect = () => {}, onCollapse = () => {}, animate = true, resolveIcon = id => "/assets/icons/"+id, motion = new DiagramMotion() } = {}) {
    const textContext=document.createElement('canvas').getContext('2d');
    this.textFit=new TextFit((text,size,weight)=>{textContext.font=`${weight} ${size}px Arial`;return textContext.measureText(text).width;});
    this.iconTint=new IconTint(); this.motion = motion; this.animate = animate; this.resolveIcon=resolveIcon;
    this.element = element; this.onSelect = onSelect; this.onCollapse = onCollapse; this.clickTimer = null; this.markerId = `strata-arrow-${++diagramSequence}`;
  }
  render(model, { perspective, collapsed = new Set(), selected = null, theme = 'midnight', showLabels = true, detail=1, viewportWidth=1000, zoom=1 } = {}) {
    const colors=resolveTheme(theme),typeColors=colors.palette;
    clearTimeout(this.clickTimer);
    const cacheKey = JSON.stringify([model,perspective,[...collapsed].sort()]);

    if (this.layoutCache?.key !== cacheKey) { this.layoutCache = {key:cacheKey,layout:new DiagramLayout(model).create(perspective,collapsed)}; }

    const base=this.layoutCache.layout;
    const effective=new SemanticDetail().collapse(base,{detail,width:viewportWidth,zoom,manual:collapsed});
    const effectiveKey=JSON.stringify([...effective].sort());
    if (this.detailCache?.base!==base || this.detailCache.key!==effectiveKey) {
      this.detailCache={base,key:effectiveKey,layout:effective.size===collapsed.size ? base : new DiagramLayout(model).create(perspective,effective)};
    }
    const layout = this.detailCache.layout;
    const focus = selectionFocus(layout,selected,model.resources);
    const focusing = focus.primary !== null;
    const svg = svgElement('svg', { xmlns: NS, viewBox: `0 0 ${layout.width} ${layout.height}`, role: 'img', 'aria-label': model.title });
    const defs = svgElement('defs');
    for (const [type,color] of Object.entries(typeColors)) {
      const filter=svgElement('filter',{id:this.markerId+'-tint-'+type,'color-interpolation-filters':'sRGB'});
      filter.append(svgElement('feFlood',{'flood-color':color}),svgElement('feComposite',{in2:'SourceAlpha',operator:'in'}));
      defs.append(filter);
    }
    const marker = svgElement('marker', { id: this.markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
    marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: colors.muted }));
    defs.append(marker); svg.append(defs,svgElement('rect',{width:layout.width,height:layout.height,fill:colors.canvas}));
    const backgrounds = svgElement('g',{'data-layer':'containers'}), arrows = svgElement('g',{'data-layer':'arrows'}), foreground = svgElement('g',{'data-layer':'resources'});
    let hoverConnections;
    for (const node of layout.nodes) {
      const r = node.resource, color = typeColors[r.type];
      const group = svgElement('g', { tabindex: 0, role: 'button', 'aria-label': `${r.name}, ${r.type}`, 'data-resource': r.id, 'data-parent':r.parent ?? '', 'data-depth':node.depth, style: 'cursor:pointer;outline:none' });
      const active = focus.primary === r.id;
      const connected = focusing && focus.nodes.has(r.id);
      const contextual = focus.context.has(r.id);
      group.setAttribute('opacity',!focusing || connected ? '1' : contextual ? '0.55' : '0.16');
      group.setAttribute('data-focus',!focusing ? 'normal' : active ? 'selected' : connected ? 'connected' : contextual ? 'context' : 'dimmed');
      group.setAttribute('aria-pressed',String(active));
      group.append(svgElement('rect', { x: node.x, y: node.y, width: node.w, height: node.h, rx: node.container && !node.collapsed ? 12 : 9, fill: node.container && !node.collapsed ? colors.container+'e8' : colors.tile, stroke: active ? color : connected ? color + '99' : colors.border, 'stroke-width': active ? 2.5 : connected ? 1.8 : 1.2 }));
      group.append(svgElement('rect', { x: node.x + 16, y: node.y + 16, width: 27, height: 27, rx: 7, fill: color + '18' }));
      const iconHref=r.icon ? this.resolveIcon(r.icon) : null;

      if (iconHref) {
        group.append(svgElement('image',{href:iconHref,x:node.x+19,y:node.y+19,width:21,height:21,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'}));
      } else {
      group.append(svgElement('text', { x: node.x + 29.5, y: node.y + 35, fill: color, 'text-anchor': 'middle', 'font-size': 18, 'font-family': 'Arial,sans-serif' }, r.type === 'database' ? '▤' : r.type === 'app' ? '▣' : r.type === 'infrastructure' ? '◇' : '⬡'));
      }

      const titleFit=this.textFit.fit(r.name,node.w-71-(node.container && !node.collapsed ? 45 : 0),{weight:600});
      group.append(svgElement('text', { x: node.x + 53, y: node.y + 33, fill: colors.text, 'font-size':titleFit.size, 'font-weight': 600, 'font-family': 'Arial,sans-serif' }, titleFit.text));

      if (!node.container || node.collapsed) {
        const metadata=node.collapsed ? `${model.resources.filter(c => c.parent === r.id).length} components · collapsed` : r.type;
        const metadataFit=this.textFit.fit(metadata,node.w-34,{max:16,spacing:.2});
        group.append(svgElement('text', { x: node.x + 17, y: node.y + 72, fill: colors.muted, 'font-size':metadataFit.size, 'font-family': 'Arial,sans-serif', 'letter-spacing': .2 }, metadataFit.text));
      } else {
        group.append(svgElement('text', { x: node.x + node.w - 18, y: node.y + 32, fill: colors.muted, 'font-size':20, 'text-anchor': 'end' }, String(model.resources.filter(c => c.parent === r.id).length)));
      }

      const icon=tileIconPlacement(node,viewportWidth*zoom/layout.width);

      if (icon) {
        if (iconHref) {
          group.append(svgElement('image',{'data-tile-icon':'',href:iconHref,x:icon.x-icon.size/2,y:icon.y-icon.size/2,width:icon.size,height:icon.size,opacity:active || connected ? 1 : .3,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'}));
        } else {
        group.append(svgElement('text',{'data-tile-icon':'',x:icon.x,y:icon.y,fill:color,opacity:active || connected ? 1 : .3,'font-size':icon.size,'text-anchor':'middle','dominant-baseline':'central','font-family':'Arial,sans-serif','aria-hidden':'true','pointer-events':'none'},r.type === 'database' ? '▤' : r.type === 'app' ? '▣' : r.type === 'infrastructure' ? '◇' : '⬡'));
        }

      }

      for (const image of group.querySelectorAll('image')) {
        this.iconTint.apply(image,this.markerId+'-tint-'+r.type);
      }

      group.addEventListener('pointerenter',e=>{ if (!e.buttons) { hoverConnections.show(r.id); } });
      group.addEventListener('pointerleave',()=>hoverConnections.show(null));
      group.addEventListener('focus',()=>hoverConnections.show(r.id));
      group.addEventListener('blur',()=>hoverConnections.show(null));
      group.addEventListener('click', e => {
        e.stopPropagation(); clearTimeout(this.clickTimer);
        this.clickTimer = setTimeout(() => this.onSelect(r.id), 240);
      });
      group.addEventListener('dblclick', e => { e.stopPropagation(); clearTimeout(this.clickTimer); this.onCollapse(r.id,node.collapsed); });
      group.addEventListener('keydown', e => {

        if (e.key === 'Enter') { e.preventDefault(); this.onSelect(r.id); }
        if (e.key === ' ') { e.preventDefault(); this.onCollapse(r.id,node.collapsed); }

      });
      (node.container && !node.collapsed ? backgrounds : foreground).append(group);
    }
    const edgeOrder = focusing ? [...layout.edges.filter(e => !focus.edges.has(e)),...layout.edges.filter(e => focus.edges.has(e))] : layout.edges;
    const covered=coveredConnections(edgeOrder,edge=>focus.edges.has(edge));
    const hoverEntries=[];
    for (let edgeIndex=0;edgeIndex<edgeOrder.length;edgeIndex++) {
      const edge=edgeOrder[edgeIndex];
      const underneath=covered.has(edge);
      const connected = focus.edges.has(edge);
      const sourceColor=typeColors[edge.from.resource.type],targetColor=typeColors[edge.to.resource.type];
      const connectionGradientId=`${this.markerId}-connection-${edgeIndex}`;
      const connectionMarkerId=connected ? `${connectionGradientId}-arrow` : this.markerId;

      if (connected) {
        const start=edge.points[0],end=edge.points.at(-1);
        const gradient=svgElement('linearGradient',{id:connectionGradientId,gradientUnits:'userSpaceOnUse',x1:start.x,y1:start.y,x2:end.x,y2:end.y});
        gradient.append(svgElement('stop',{offset:'0%','stop-color':sourceColor}),svgElement('stop',{offset:'100%','stop-color':targetColor}));
        const arrow=svgElement('marker',{id:connectionMarkerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});
        arrow.append(svgElement('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:targetColor}));
        defs.append(gradient,arrow);
      }

      const d = edge.points.map((p,i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
      const edgeGroup = svgElement('g',{'data-from':edge.from.resource.id,'data-to':edge.to.resource.id,'data-edge-key':JSON.stringify([edge.from.resource.id,edge.to.resource.id,edge.label]),'data-focus':!focusing ? 'normal' : connected ? 'connected' : 'dimmed',opacity:!focusing || connected ? 1 : .1});
      edgeGroup.append(svgElement('title',{},edge.relationships.map(relation => `${relation.from} → ${relation.to}${relation.label ? ' · '+relation.label : ''}`).join('\n')));
      // A canvas-colored underlay separates unavoidable perpendicular crossings.
      edgeGroup.append(svgElement('path',{d,fill:'none',stroke:colors.canvas,opacity:underneath ? .1 : 1,'stroke-width':6,'stroke-linejoin':'round'}));
      edgeGroup.append(svgElement('path',{d,fill:'none',stroke:connected ? `url(#${connectionGradientId})` : colors.muted,opacity:underneath ? .1 : 1,'stroke-width':1.5,'stroke-linejoin':'round','marker-end':`url(#${connectionMarkerId})`}));
      {
        for (const end of [false,true]) {
          const {tip,inner}=endpointFade(edge.points,end);
          const gradientId=`${this.markerId}-fade-${edgeIndex}-${end ? 'end' : 'start'}`;
          const gradient=svgElement('linearGradient',{id:gradientId,gradientUnits:'userSpaceOnUse',x1:tip.x,y1:tip.y,x2:inner.x,y2:inner.y});
          const fadeColor=connected ? (end ? targetColor : sourceColor) : colors.muted;
          gradient.append(svgElement('stop',{offset:'0%','stop-color':fadeColor,'stop-opacity':1}),svgElement('stop',{offset:'100%','stop-color':fadeColor,'stop-opacity':0}));
          defs.append(gradient);
          edgeGroup.append(svgElement('path',{'data-endpoint':'',opacity:underneath ? 1 : 0,d:endpointStroke(edge.points,end),fill:'none',stroke:`url(#${gradientId})`,'stroke-width':1.5,...(end ? {'marker-end':`url(#${connectionMarkerId})`} : {})}));
        }
      }
      arrows.append(edgeGroup);
      hoverEntries.push({edge,selected:connected,group:edgeGroup,opacity:edgeGroup.getAttribute('opacity')});

      if (showLabels && edge.label && edge.labelPosition) {
        const labelFit=this.textFit.fit(edge.label,edge.labelPosition.width,{max:20});
        const label=labelFit.text;
        const {x,y} = edge.labelPosition;
        edgeGroup.append(svgElement('text',{x,y,'text-anchor':'middle',fill:connected ? colors.text : colors.muted,'font-size':labelFit.size,'font-family':'Arial,sans-serif',stroke:colors.canvas,'stroke-width':5,'stroke-linejoin':'round','paint-order':'stroke'},label));
      }

    }
    hoverConnections=new ConnectionHover(arrows,hoverEntries);
    svg.append(backgrounds, arrows, foreground);
    svg.addEventListener('click', () => { clearTimeout(this.clickTimer); this.onSelect(null); });
    this.motion.transition(this.svg,svg,{enabled:this.animate,duration:this.previousLayout === layout ? 180 : 420});
    this.element.replaceChildren(svg);
    this.svg = svg; this.previousLayout = layout;
    return layout;
  }
  finishAnimations() { this.motion.finish(); }
  exportSvg() { this.finishAnimations(); return new XMLSerializer().serializeToString(this.svg); }
}
