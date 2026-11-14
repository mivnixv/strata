/** Coalesce wheel input into one pointer-anchored zoom update per frame. */
export class WheelZoom {
  constructor(canvas,{getZoom,setZoom,settle,pan,requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}) {
    this.pan=pan;this.canvas=canvas;this.getZoom=getZoom;this.setZoom=setZoom;this.settle=settle;
    this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;this.frame=null;this.delta=0;
    this.listener=event=>this.onWheel(event);
    canvas.addEventListener('wheel',this.listener,{passive:false});
  }
  onWheel(event) {

    if (!event.deltaY) { return; }

    event.preventDefault();
    const unit=event.deltaMode===1 ? 16 : event.deltaMode===2 ? this.canvas.clientHeight : 1;
    this.delta+=event.deltaY*unit;this.pointer={x:event.clientX,y:event.clientY};

    if (this.frame===null) { this.frame=this.requestFrame(()=>this.update()); }

  }
  update() {
    this.frame=null;
    const next=Math.max(.4,Math.min(3,this.getZoom()*Math.exp(-this.delta*.002)));
    this.delta=0;

    if (next===this.getZoom()) { return; }

    this.settle();
    const svg=this.canvas.querySelector('svg');

    if (!svg) { return; }

    const before=svg.getBoundingClientRect();
    const x=(this.pointer.x-before.left)/before.width,y=(this.pointer.y-before.top)/before.height;
    this.canvas.classList.add('wheel-zooming');
    this.setZoom(next);this.settle();
    const after=this.canvas.querySelector('svg').getBoundingClientRect();
    this.pan.moveBy(this.pointer.x-after.left-x*after.width,this.pointer.y-after.top-y*after.height);
    this.canvas.classList.remove('wheel-zooming');
  }
  destroy() {
    this.canvas.removeEventListener('wheel',this.listener);

    if (this.frame!==null) { this.cancelFrame(this.frame); }

  }
}
