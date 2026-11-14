/** Center the icon horizontally beneath the title/type area. */
export function tileIconPlacement(node,scale=1) {

  if (node.container && !node.collapsed) { return null; }

  const size=Math.min(144,node.w-48,node.h-116);

  if (size<48 || size*scale<28) { return null; }

  return {x:node.x+node.w/2,y:node.y+92+size/2,size};
}
