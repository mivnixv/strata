/** Note focus deliberately excludes an item's neighbors and other notes. */
export function noteSelectionFocus(entry,resources,maxDepth) {
  const nodes=new Set(), edges=new Set(), context=new Set();
  let primary=null;

  if (entry.target.kind==='item') {
    primary=entry.target.nodeId; nodes.add(primary);
  }
  if (entry.target.kind==='connection') {
    const edge=entry.target.edge;
    edges.add(edge); nodes.add(edge.from.resource.id); nodes.add(edge.to.resource.id);
  }

  const byId=new Map(resources.map(resource=>[resource.id,resource]));
  for (const id of nodes) {
    let parent=byId.get(byId.get(id)?.parent);
    for (let depth=0;parent && depth<=maxDepth;depth++,parent=byId.get(parent.parent)) {

      if (!nodes.has(parent.id)) { context.add(parent.id); }

    }
  }
  return {primary,nodes,edges,context};
}

export class NoteInteraction {
  constructor(onSelect) { this.onSelect=onSelect; }

  bind(element,number,selected) {
    element.setAttribute('role','button'); element.setAttribute('tabindex','0');
    element.setAttribute('aria-pressed',String(selected)); element.setAttribute('style','cursor:pointer');
    element.addEventListener('click',event=>{ event.stopPropagation(); this.onSelect(number); });
    element.addEventListener('dblclick',event=>event.stopPropagation());
    element.addEventListener('keydown',event=>{

      if (event.key==='Enter' || event.key===' ') {
        event.preventDefault(); event.stopPropagation(); this.onSelect(number);
      }

    });
  }
}
