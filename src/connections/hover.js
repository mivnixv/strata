import { coveredConnections } from './overlap.js';
/** Reorder existing SVG groups without rebuilding tiles or disturbing selection. */
export class ConnectionHover {
  constructor(layer,entries) { this.layer=layer;this.entries=entries;this.animations=new Map(); }
  show(id) {
    const snapshots=new Map();
    for (const entry of this.entries) {
      for (const element of [entry.group,...entry.group.querySelectorAll(':scope > path')]) {
        snapshots.set(element,typeof getComputedStyle==='function' ? getComputedStyle(element).opacity : '1');
      }
    }
    for (const animation of this.animations.values()) { animation.cancel(); }
    this.animations.clear();
    const active=entry=>id!==null && (entry.edge.from.resource.id===id || entry.edge.to.resource.id===id);
    const ordered=[...this.entries.filter(entry=>!active(entry)),...this.entries.filter(active)];
    const protectedEdges=new Set(ordered.filter(entry=>active(entry) || entry.selected).map(entry=>entry.edge));
    const covered=coveredConnections(ordered.map(entry=>entry.edge),edge=>protectedEdges.has(edge));
    for (let index=0;index<ordered.length;index++) {
      const entry=ordered[index],hovered=active(entry);
      const underneath=covered.has(entry.edge);
      this.layer.append(entry.group);
      this.fade(entry.group,snapshots.get(entry.group),hovered ? '1' : entry.opacity);
      entry.group.setAttribute('data-hover',hovered ? 'connected' : 'none');
      for (const path of entry.group.querySelectorAll(':scope > path')) {
        const endpoint=path.hasAttribute('data-endpoint');
        this.fade(path,snapshots.get(path),endpoint ? (underneath ? '1' : '0') : (underneath ? '.1' : '1'));
      }
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
