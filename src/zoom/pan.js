/** Camera translation only: dragging never changes model coordinates. */
export class ViewportPan {
  constructor(canvas,diagram) {
    this.canvas=canvas;this.diagram=diagram;this.x=0;this.y=0;this.drag=null;this.moved=false;
    canvas.addEventListener('pointerdown',event=>this.start(event));
    canvas.addEventListener('pointermove',event=>this.move(event));
    for (const name of ['pointerup','pointercancel','lostpointercapture']) { canvas.addEventListener(name,event=>this.end(event)); }
    canvas.addEventListener('click',event=>{

      if (this.moved) { event.preventDefault();event.stopImmediatePropagation();this.moved=false; }

    },true);
    canvas.addEventListener('dragstart',event=>event.preventDefault());
  }
  start(event) {

    if (event.button!==0 && event.button!==1) { return; }
    if (this.drag) { return; }

    this.moved=false;
    this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,originX:this.x,originY:this.y};
  }
  move(event) {
    const drag=this.drag;

    if (!drag || drag.id!==event.pointerId) { return; }

    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;

    if (!this.moved && Math.hypot(dx,dy)<4) { return; }

    event.preventDefault();this.moved=true;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.classList.add('panning');
    this.x=drag.originX+dx;this.y=drag.originY+dy;this.apply();
  }
  end(event) {

    if (!this.drag || this.drag.id!==event.pointerId) { return; }

    this.drag=null;this.canvas.classList.remove('panning');

    if (this.canvas.hasPointerCapture(event.pointerId)) { this.canvas.releasePointerCapture(event.pointerId); }

  }
  moveBy(x,y) { this.x+=x;this.y+=y;this.apply(); }
  reset() { this.x=0;this.y=0;this.apply(); }
  apply() { this.diagram.style.transform=`translate(${this.x}px,${this.y}px)`; }
}
