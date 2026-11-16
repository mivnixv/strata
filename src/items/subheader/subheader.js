export function parseSubheader(value='') {

  if (typeof value!=='string' || value.length>500) { throw new Error('Item subheader must be a string of at most 500 characters.'); }

  return value;
}

export class ItemSubheader {
  constructor(element,textFit) { this.element=element; this.textFit=textFit; }

  render(node,childCount,colors) {
    const text=node.resource.subheader || (node.collapsed ? `${childCount} components · collapsed` : '');

    if (!text) { return null; }

    const fitted=this.textFit.fit(text,node.w-34,{max:16,spacing:.2});
    return this.element('text',{'data-subheader':'',x:node.x+17,y:node.y+(node.container && !node.collapsed ? 55 : 72),fill:colors.muted,'font-size':fitted.size,'font-family':'Arial,sans-serif','letter-spacing':.2},fitted.text);
  }
}
