import { coveredConnections, DIMMED_CONNECTION_OPACITY } from './overlap.js';
/** Reorder existing SVG groups without rebuilding tiles or disturbing selection. */
export class ConnectionHover {
  constructor(layer,entries,{selectionActive=entries.some(entry=>entry.selected)}={}) {
    this.layer=layer;this.entries=entries;this.selectionActive=selectionActive;this.animations=new Map();
  }
  show(id) {
    const snapshots=new Map();
    for (const entry of this.entries) {
      for (const element of [entry.body,entry.endpoints]) {
        snapshots.set(element,typeof getComputedStyle==='function' ? getComputedStyle(element).opacity : element.getAttribute('opacity'));
      }
    }
    for (const animation of this.animations.values()) { animation.cancel(); }
    this.animations.clear();
    const active=entry=>!this.selectionActive && id!==null && (entry.edge.from.resource.id===id || entry.edge.to.resource.id===id);
    const ordered=[...this.entries.filter(entry=>!entry.selected && !active(entry)),...this.entries.filter(entry=>!entry.selected && active(entry)),...this.entries.filter(entry=>entry.selected)];
    const emphasized=new Set(this.entries.filter(entry=>entry.selected || active(entry)).map(entry=>entry.edge));
    const covered=coveredConnections(ordered.map(entry=>entry.edge),edge=>emphasized.has(edge));
    for (let index=0;index<ordered.length;index++) {
      const entry=ordered[index],hovered=active(entry);
      const underneath=covered.has(entry.edge);
      this.layer.append(entry.group);
      const opacity=underneath ? DIMMED_CONNECTION_OPACITY : hovered ? '1' : entry.opacity;
      this.fade(entry.body,snapshots.get(entry.body),opacity);
      this.fade(entry.endpoints,snapshots.get(entry.endpoints),opacity==='1' ? '0' : hovered ? '1' : entry.opacity);
      entry.group.setAttribute('data-covered',String(underneath));
      entry.group.setAttribute('data-hover',hovered ? 'connected' : 'none');
    }
  }
  fade(element,from,to) {
    element.setAttribute('opacity',to);

    if (Number(from)===Number(to) || !element.animate || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { return; }

    const animation=element.animate([{opacity:from},{opacity:to}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
    this.animations.set(element,animation);
    animation.onfinish=()=>this.animations.delete(element);
  }
}
