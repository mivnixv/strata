/** All symbols touch the attachment at x=0 and extend back into the route. */
export class ConnectionMarkers {
  constructor(element) { this.element=element; }
  create(defs,id,type,color,background) {

    if (type==='none') { return undefined; }

    const marker=this.element('marker',{id,viewBox:'-12 -6 12 12',refX:0,refY:0,markerWidth:12,markerHeight:12,markerUnits:'userSpaceOnUse',orient:'auto-start-reverse'});
    const attrs={stroke:color,'stroke-width':1.5,fill:color};
    let shape;

    if (type==='dot' || type==='circle') { shape=this.element('circle',{...attrs,cx:-4.75,cy:0,r:4,fill:type==='dot' ? color : background}); }
    else if (type==='square') { shape=this.element('rect',{...attrs,x:-8.75,y:-4,width:8,height:8}); }
    else if (type==='arrow') { shape=this.element('path',{d:'M -10 -5 L 0 0 L -10 5 z',fill:color}); }
    else if (type==='asterisk') { shape=this.element('path',{...attrs,d:'M -9 0 L -1 0 M -7 -3.5 L -3 3.5 M -7 3.5 L -3 -3.5',fill:'none','stroke-linecap':'round'}); }
    else { throw new Error(`Unknown endpoint type: ${type}`); }

    marker.append(shape); defs.append(marker);
    return `url(#${id})`;
  }
  attributes(defs,id,relation,startColor,endColor,background) {
    const attrs={};
    for (const end of ['start','end']) {
      const marker=this.create(defs,id+'-'+end,relation[end+'Type'],end==='start' ? startColor : endColor,background);

      if (marker) { attrs['marker-'+end]=marker; }

    }
    return attrs;
  }
}
