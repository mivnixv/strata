import { noteMarkPosition, itemNoteAnchor, noteMarkLayout } from './position.js';
export const NOTE_LIMIT = 1000;
export const NOTE_COLUMNS = 8;

/** A single validator owns numbering across all attachment scopes. */
export class NoteValidator {
  constructor() { this.numbers=new Set(); }

  parse(values=[],attachment='general',resourceIds=new Set()) {

    if (!Array.isArray(values)) { throw new Error('Notes must be an array.'); }

    return values.map(note=>{

      if (!note || !Number.isSafeInteger(note.number) || note.number<1) { throw new Error('Note number must be a positive safe integer.'); }
      if (typeof note.text!=='string' || !note.text.trim() || note.text.length>5000) { throw new Error('Note text must contain 1–5000 characters.'); }
      if (this.numbers.has(note.number)) { throw new Error(`Duplicate note number: ${note.number}`); }
      if (this.numbers.size>=NOTE_LIMIT) { throw new Error(`Define at most ${NOTE_LIMIT} notes.`); }

      const fontSize=note.fontSize===undefined ? 14 : note.fontSize;

      if (typeof fontSize!=='number' || !Number.isFinite(fontSize) || fontSize<=0) { throw new Error('Note fontSize must be a positive finite number.'); }

      const resource=note.resource ?? null;

      if (resource!==null && (attachment!=='general' || !resourceIds.has(resource))) { throw new Error('A note on an item must be declared at model/view level and reference an existing resource ID.'); }

      const target=resource===null ? attachment : 'item';
      this.numbers.add(note.number);
      return {number:note.number,text:note.text,fontSize,resource,position:noteMarkPosition(note.position,target),connector:this.connector(note.connector,target!=='general')};
    });
  }

  connector(value,attached) {

    if (value===undefined || value===null) { return null; }
    if (!attached) { throw new Error('A note connector requires an attached item or connection mark.'); }
    if (typeof value!=='object' || Array.isArray(value)) { throw new Error('Note connector must be an object.'); }

    const label=value.label===undefined ? '' : value.label, dashed=value.dashed===undefined ? false : value.dashed;

    if (typeof label!=='string' || label.length>500) { throw new Error('Note connector label must be a string of at most 500 characters.'); }
    if (typeof dashed!=='boolean') { throw new Error('Note connector dashed must be a boolean.'); }

    return {label,dashed};
  }

}

/** Hidden descendants roll their annotations onto the visible collapsed item. */
export function notesForLayout(model,view,nodes,edges,maxDepth,membership) {
  const entries=[], byId=new Map(model.resources.map(resource=>[resource.id,resource]));
  const visible=new Map(nodes.map(node=>[node.resource.id,node]));
  const attachments=new Map();
  for (const note of [...model.notes,...view.notes]) {

    if (note.resource===null) { entries.push({note,anchor:null,target:{kind:'general'}}); continue; }

    const list=attachments.get(note.resource) ?? [];
    list.push(note); attachments.set(note.resource,list);
  }
  for (const resource of model.resources) {

    if (!membership.has(resource.id)) { continue; }

    let current=resource, node=null;
    for (let depth=0;current && depth<=maxDepth;depth++,current=byId.get(current.parent)) {
      const candidate=visible.get(current.id);

      if (candidate && (current===resource || candidate.collapsed)) { node=candidate; break; }

    }

    if (!node) { continue; }

    for (const note of [...resource.notes,...(attachments.get(resource.id) ?? [])]) { entries.push({note,anchor:itemNoteAnchor(node,note.position),target:{kind:'item',resourceId:resource.id,nodeId:node.resource.id}}); }
  }
  for (const edge of edges) {
    const point=noteConnectionAnchor(edge.points);
    for (const relation of edge.relationships) {
      for (const note of relation.notes) { entries.push({note,anchor:{x:point.x,y:point.y},target:{kind:'connection',edge}}); }
    }
  }
  return entries.sort((a,b)=>a.note.number-b.note.number);
}

/** Place the marker halfway along the routed polyline, clear of endpoints. */
export function noteConnectionAnchor(points) {
  const lengths=points.slice(1).map((point,index)=>Math.hypot(point.x-points[index].x,point.y-points[index].y));
  let remaining=lengths.reduce((sum,length)=>sum+length,0)/2;
  for (let index=0;index<lengths.length;index++) {
    const length=lengths[index];

    if (remaining<=length && length>0) {
      const start=points[index], end=points[index+1], ratio=remaining/length;
      return {x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio+20};
    }

    remaining-=length;
  }
  return points[0];
}

/** Resource notes follow the selected item/subtree; edge notes follow direct connections. */
export function noteIsRelated({target},focus,byId) {

  if (focus.primary===null || target.kind==='general') { return false; }
  if (target.kind==='connection') { return focus.edges.has(target.edge); }
  if (target.nodeId===focus.primary) { return true; }

  let resource=byId.get(target.resourceId);
  for (let depth=0;resource && depth<byId.size;depth++,resource=byId.get(resource.parent)) {

    if (resource.id===focus.primary) { return true; }

  }
  return false;
}

export class NoteRenderer {
  constructor(element,measure) { this.element=element; this.measure=measure; }

  wrap(text,width,fontSize=14) {
    const lines=[];
    for (const paragraph of text.split('\n')) {
      let line='';
      for (const character of paragraph) {

        if (line && this.measure(line+character,fontSize,400)>width) {
          const split=line.lastIndexOf(' ')+1;
          const boundary=split>0 ? split : line.length;
          lines.push(line.slice(0,boundary)); line=line.slice(boundary);
        }

        line+=character;
      }
      lines.push(line);
    }
    return lines;
  }

  badge(note,anchor,colors,highlighted,attachment={}) {
    const el=this.element, label=String(note.number), color=colors.muted;
    const badge=el('g',{...attachment,'data-note':note.number,'data-highlighted':String(highlighted),opacity:highlighted ? 1 : .25,'aria-label':`Note ${note.number}: ${note.text}`});
    const size=Math.min(14,14*22/Math.max(1,this.measure(label,14,400)));
    badge.append(el('circle',{cx:anchor.x,cy:anchor.y,r:14,fill:colors.tile,stroke:color,'stroke-width':1.5,'stroke-dasharray':'3 3'}));
    badge.append(el('text',{x:anchor.x,y:anchor.y,'dominant-baseline':'central','text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,fill:color},label));
    badge.append(el('title',{},`${note.number}. ${note.text}`));
    return badge;
  }

  block(note,box,colors,highlighted,dimmed,attachment={}) {
    const el=this.element, color=colors.muted;
    const group=el('g',{...attachment,'aria-label':`Note ${note.number}: ${note.text}`,'data-note-text':note.number,'data-highlighted':String(highlighted),opacity:dimmed ? .25 : 1});
    group.append(el('rect',{x:box.x,y:box.y,width:box.width,height:box.height,rx:3,fill:colors.tile,stroke:color,'stroke-width':1}));
    group.append(el('path',{d:`M ${box.x+32} ${box.y} V ${box.y+box.height}`,stroke:colors.muted,opacity:.35}));
    group.append(el('text',{x:box.x+12,y:box.y+8+Math.max(14,box.fontSize),fill:color,'font-family':'Arial,sans-serif','font-size':14,'font-weight':600},String(note.number)));
    for (let index=0;index<box.lines.length;index++) {
      const y=box.y+8+Math.max(14,box.fontSize)+index*box.lineHeight;
      group.append(el('path',{d:`M ${box.x+38} ${y+box.fontSize*.375} H ${box.x+box.width-12}`,stroke:colors.muted,opacity:.2}));
      group.append(el('text',{x:box.x+42,y,fill:colors.text,'font-family':'Arial,sans-serif','font-size':box.fontSize,'xml:space':'preserve'},box.lines[index]));
    }
    return group;
  }

  connector(note,box,mark,colors,highlighted,attachment={}) {
    const el=this.element, color=colors.muted;
    const x=box.x+box.width/2, y=box.y, endY=mark.y+14;
    const group=el('g',{...attachment,'data-note-connector':note.number,'data-highlighted':String(highlighted),opacity:highlighted ? .5 : .25,'pointer-events':'none'});
    const d=`M ${x} ${y} C ${x} ${y-48}, ${mark.x} ${endY+48}, ${mark.x} ${endY}`;
    group.append(el('path',{d,fill:'none',stroke:color,'stroke-width':1.5,...(note.connector.dashed ? {'stroke-dasharray':'8 6'} : {})}));

    if (note.connector.label) {
      group.append(el('text',{x:x+8,y:y-12,fill:color,'font-family':'Arial,sans-serif','font-size':14,stroke:colors.canvas,'stroke-width':4,'paint-order':'stroke'},note.connector.label));
    }

    return group;
  }

  blocks(entries,width,top) {
    const columns=NOTE_COLUMNS, gap=16, inset=24;

    if (!entries.length) { return {boxes:[],width,height:top}; }

    let glyphWidth=0;
    for (const {note} of entries) {
      for (const character of note.text) { glyphWidth=Math.max(glyphWidth,this.measure(character,note.fontSize ?? 14,400)); }
    }
    const blockWidth=Math.max(210,glyphWidth+56,(width-inset*2-gap*(columns-1))/Math.max(1,columns));
    const boxes=[];
    let y=top;
    for (let offset=0;offset<entries.length;offset+=columns) {
      const row=entries.slice(offset,offset+columns).map(({note},index)=>{
        const fontSize=note.fontSize ?? 14, lineHeight=fontSize*1.5;
        const lines=this.wrap(note.text,blockWidth-56,fontSize);
        return {x:inset+index*(blockWidth+gap),y,width:blockWidth,height:Math.max(36,lines.length*lineHeight+16+Math.max(0,14-fontSize)),lines,fontSize,lineHeight};
      });
      const rowHeight=Math.max(...row.map(box=>box.height));
      for (const box of row) { boxes.push({...box,height:rowHeight}); }
      y+=rowHeight+gap;
    }
    return {boxes,width:Math.max(width,inset*2+columns*blockWidth+Math.max(0,columns-1)*gap),height:entries.length ? y+8 : top};
  }

  render(entries,{width,height,nodes},colors,{showNotes=true,focus={primary:null,edges:new Set()},selectedNote=null,resources=[]}={}) {
    const el=this.element, group=el('g',{'data-layer':'notes'}), connectors=el('g',{'data-layer':'note-connectors'});

    if (!showNotes) { return {group,connectors,minX:0,minY:0,width,height}; }

    const marks=noteMarkLayout(entries);
    const blocks=this.blocks(entries,Math.max(width,marks.maxX),nodes.length ? Math.max(height,marks.maxY)+48 : 24);
    const byId=new Map(resources.map(resource=>[resource.id,resource]));
    const visible=new Map(nodes.map(node=>[node.resource.id,node.resource]));
    for (let index=0;index<entries.length;index++) {
      const entry=entries[index], {note}=entry;
      const highlighted=(selectedNote===null ? noteIsRelated(entry,focus,byId) : note.number===selectedNote), dimmed=!highlighted;
      const position=marks.positions.get(note.number);
      const owners=entry.target.kind==='item' ? [entry.target.nodeId] : entry.target.kind==='connection' ? [entry.target.edge.from.resource.id,entry.target.edge.to.resource.id] : [];
      const attachment={'data-note-owners':JSON.stringify(owners)};

      if (position) { group.append(this.badge(note,position,colors,highlighted,attachment)); }

      const box=blocks.boxes[index];
      group.append(this.block(note,box,colors,highlighted,dimmed,attachment));

      if (position && note.connector) {
        const owner=entry.target.kind==='connection'
          ? (focus.primary===entry.target.edge.to.resource.id ? entry.target.edge.to.resource : entry.target.edge.from.resource)
          : visible.get(entry.target.nodeId);
        const color=highlighted ? owner?.color ?? colors.palette?.[owner?.type] ?? colors.muted : colors.muted;
        connectors.append(this.connector(note,box,position,{...colors,muted:color},highlighted,attachment));
      }

    }
    return {group,connectors,minX:marks.minX,minY:marks.minY,width:blocks.width,height:Math.max(height,marks.maxY,entries.length ? blocks.height : height)};
  }
}
