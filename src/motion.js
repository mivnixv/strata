/** Finite, interruptible animation clock. Dependencies are injectable for deterministic tests. */
export class FrameAnimation {
  constructor({requestFrame = callback => requestAnimationFrame(callback),cancelFrame = id => cancelAnimationFrame(id),now = () => performance.now(),reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false} = {}) {
    this.requestFrame = requestFrame; this.cancelFrame = cancelFrame; this.now = now; this.reducedMotion = reducedMotion; this.job = null;
  }
  play(duration,update,complete = () => {}) {

    if (!Number.isFinite(duration) || duration < 0) { throw new Error('Animation duration must be a finite, nonnegative number.'); }

    this.cancel();

    if (duration <= 0 || this.reducedMotion()) { update(1); complete(); return; }

    const job = {started:this.now(),frame:null,update,complete}; this.job = job;
    const step = timestamp => {

      if (this.job !== job) { return; }
      if (this.reducedMotion()) { this.finish(); return; }

      const progress = Math.min(1,Math.max(0,(timestamp-job.started)/duration));
      update(progress);

      if (this.job !== job) { return; }
      if (progress === 1) { this.job = null; complete(); return; }

      job.frame = this.requestFrame(step);
    };
    update(0);

    if (this.job === job) { job.frame = this.requestFrame(step); }

  }
  cancel() {

    if (this.job && this.job.frame !== null) { this.cancelFrame(this.job.frame); }

    this.job = null;
  }
  finish() {
    const job = this.job; this.cancel();

    if (job) { job.update(1); job.complete(); }

  }
}
const clampProgress = value => Math.min(1,Math.max(0,value));
const easeMotion = value => 1-Math.pow(1-clampProgress(value),3);
const easeFade = value => { const t=clampProgress(value); return t*t*(3-2*t); };
/** Space changes happen between child disappearance and appearance. */
export function disclosureProgress(progress,{exiting=false,entering=false}={}) {
  const start=exiting ? .25 : 0,end=entering ? .8 : 1;
  return {
    layout:clampProgress((progress-start)/(end-start)),
    exit:clampProgress(progress/.25),
    enter:clampProgress((progress-.8)/(1-.8))
  };
}
const numericMotionAttributes = ['x','y','width','height','rx','font-size','stroke-width'];
const colorMotionAttributes = ['fill','stroke'];
function motionColor(value) {

  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(value ?? '')) { return null; }

  const hex = value.slice(1).padEnd(8,'f');
  return [0,2,4,6].map(offset => parseInt(hex.slice(offset,offset+2),16));
}
function colorBetween(from,to,t) {
  return '#'+from.map((channel,i) => Math.round(channel+(to[i]-channel)*t).toString(16).padStart(2,'0')).join('');
}
/** Equal-distance samples let routes with different bend counts interpolate continuously. */
export function samplePolyline(points,count = 32) {

  if (!points.length || !Number.isInteger(count) || count < 2 || count > 128) { throw new Error('Polyline sampling needs points and 2–128 samples.'); }

  const lengths = [0];
  for (let i = 1; i < points.length; i++) { lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)); }
  const total = lengths.at(-1), result = []; let segment = 1;
  for (let i = 0; i < count; i++) {
    const distance = total*i/(count-1);
    while (segment < points.length-1 && lengths[segment] < distance) { segment++; }
    const from = points[Math.max(0,segment-1)],to = points[Math.min(segment,points.length-1)];
    const span = lengths[segment]-lengths[segment-1];
    const ratio = span > 0 ? (distance-lengths[segment-1])/span : 0;
    result.push({x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio});
  }
  return result;
}
export function interpolatePolyline(from,to,t) {

  if (from.length !== to.length) { throw new Error('Polyline samples must have equal lengths.'); }

  const ratio = easeMotion(t);
  return from.map((p,i) => ({x:p.x+(to[i].x-p.x)*ratio,y:p.y+(to[i].y-p.y)*ratio}));
}
function routePoints(path) {
  const numbers = (path.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
  return Array.from({length:numbers.length/2},(_,i) => ({x:numbers[i*2],y:numbers[i*2+1]}));
}
function captureGroup(element) {
  const shapes = [...element.querySelectorAll('rect,text,path,image')].map(shape => ({element:shape,tag:shape.tagName,attributes:new Map([...shape.attributes].map(a => [a.name,a.value]))}));
  const rectangle = shapes.find(shape => shape.tag === 'rect');
  const box = rectangle ? Object.fromEntries(['x','y','width','height'].map(key => [key,Number(rectangle.attributes.get(key))])) : null;
  return {element,shapes,box,opacity:Number(element.getAttribute('opacity') ?? 1),parent:element.getAttribute('data-parent'),depth:Number(element.getAttribute('data-depth') ?? 0)};
}
function captureScene(svg) {
  return {
    nodes:new Map([...svg.querySelectorAll('[data-resource]')].map(element => [element.getAttribute('data-resource'),captureGroup(element)])),
    edges:new Map([...svg.querySelectorAll('[data-edge-key]')].map(element => [element.getAttribute('data-edge-key'),captureGroup(element)])),
    // Crossfade changed note geometry, including curved connectors, as complete groups.
    notes:new Map([...svg.querySelectorAll('[data-note],[data-note-text],[data-note-connector]')].map(element => {
      const kind=['data-note','data-note-text','data-note-connector'].find(name=>element.hasAttribute(name));
      return [JSON.stringify([kind,element.getAttribute(kind),element.innerHTML]),captureGroup(element)];
    }))
  };
}
function contextAnchor(group,other,own) {
  let parent = group.parent;
  // The validated model permits at most twelve ancestor levels.
  for (let depth = 0; parent && depth <= 12; depth++) {

    if (other.has(parent)) { return other.get(parent).box; }

    parent = own.get(parent)?.parent;
  }
  return null;
}
/** Applies motion only to rendered SVG; model data and final routed geometry stay unchanged. */
export class DiagramMotion {
  constructor({timeline = new FrameAnimation()} = {}) { this.timeline = timeline; this.ghosts = null; this.activeSVG = null; }
  cancel() {
    this.timeline.cancel(); this.ghosts?.remove(); this.activeSVG?.removeAttribute('data-animating');
    this.ghosts = null;
  }
  finish() { this.timeline.finish(); }
  transition(previous,next,{enabled = true,duration = 420} = {}) {
    this.cancel();
    this.activeSVG = next;

    if (!enabled || this.timeline.reducedMotion()) { return; }

    const before = previous ? captureScene(previous) : {nodes:new Map(),edges:new Map(),notes:new Map()};
    const after = captureScene(next), tweens = [], fades = [], finals = [];
    const disclosure={
      exiting:[...before.nodes.keys()].some(id=>!after.nodes.has(id)),
      entering:before.nodes.size>0 && [...after.nodes.keys()].some(id=>!before.nodes.has(id))
    };

    const transforming=before.nodes.size>0 && (disclosure.exiting || disclosure.entering || [...after.nodes].some(([id,group])=>{
      const old=before.nodes.get(id);
      return old && ['x','y','width','height'].some(key=>old.box[key]!==group.box[key]);
    }));
    const arrowLayer=next.querySelector('[data-layer="arrows"]');
    const phases=transforming ? {exiting:true,entering:true} : disclosure;

    if (transforming || disclosure.exiting || disclosure.entering) { duration=Math.max(duration,800); }

    if (transforming) { finals.push(()=>arrowLayer?.removeAttribute('opacity')); }
    const tileIcons=transforming ? [...next.querySelectorAll('[data-tile-icon]')].map(element=>({
      element,opacity:Number(element.getAttribute('opacity') ?? 1),
      existing:before.nodes.get(element.parentElement.getAttribute('data-resource'))?.element.querySelector('[data-tile-icon]') != null
    })) : [];
    for (const icon of tileIcons) { finals.push(()=>icon.element.style.removeProperty('opacity')); }


    this.activeSVG = next;
    const addOpacity = (group,from,to,delay = 0,phasedEntry = true) => {
      if (from === to) { return; }

      fades.push({element:group.element,from,to,delay,entering:from===0 && phasedEntry});
      finals.push(() => group.element.setAttribute('opacity',String(to)));
    };
    for (const [id,group] of after.nodes) {
      const old = before.nodes.get(id);
      this.shapeTweens(group,old ?? this.enteringGroup(group,contextAnchor(group,before.nodes,after.nodes)),tweens,finals);
      addOpacity(group,old?.opacity ?? 0,group.opacity,old ? 0 : Math.min(90,group.depth*18));
    }
    for (const [id,group] of after.edges) {
      const old = before.edges.get(id);

      if (old) { this.shapeTweens(group,old,tweens,finals); }

      addOpacity(group,old?.opacity ?? 0,group.opacity,old ? 0 : 35);
    }
    for (const [id,group] of after.notes) {
      const owners=JSON.parse(group.element.getAttribute('data-note-owners') ?? '[]');
      const entering=owners.filter(owner=>!before.nodes.has(owner)).map(owner=>after.nodes.get(owner)).filter(Boolean);
      const delay=entering.length ? Math.min(90,Math.max(...entering.map(owner=>owner.depth))*18) : 0;
      addOpacity(group,before.notes.get(id)?.opacity ?? 0,group.opacity,delay,entering.length>0);
    }
    this.addExits(before,after,next,fades,tweens,finals);
    const finalView = next.getAttribute('viewBox');
    const oldView = (previous?.getAttribute('viewBox') ?? finalView).split(/\s+/).map(Number);
    const newView = finalView.split(/\s+/).map(Number);
    const background = next.querySelector(':scope > rect');

    if (!tweens.length && !fades.length && !this.ghosts.childElementCount && oldView.every((v,i) => v === newView[i])) {
      this.ghosts.remove(); this.ghosts = null; return;
    }

    next.setAttribute('data-animating','true');
    this.timeline.play(duration,t => {
      const phase=disclosureProgress(t,phases);

      if (transforming) {
        arrowLayer?.setAttribute('opacity',String(t<.25 ? 1-easeFade(phase.exit) : easeFade(phase.enter)));
        for (const icon of tileIcons) {
          const opacity=t<.25 && icon.existing ? 1-easeFade(phase.exit) : easeFade(phase.enter);
          icon.element.style.setProperty('opacity',String(icon.opacity*opacity),'important');
        }

      }

      const eased = easeMotion(phase.layout);
      next.setAttribute('viewBox',newView.map((v,i) => oldView[i]+(v-oldView[i])*eased).join(' '));
      background?.setAttribute('x',String(oldView[0]+(newView[0]-oldView[0])*eased));
      background?.setAttribute('y',String(oldView[1]+(newView[1]-oldView[1])*eased));
      background?.setAttribute('width',String(oldView[2]+(newView[2]-oldView[2])*eased));
      background?.setAttribute('height',String(oldView[3]+(newView[3]-oldView[3])*eased));
      for (const tween of tweens) { tween.apply(eased,phase.layout); }
      for (const fade of fades) {
        const local = fade.exiting && phases.exiting ? easeFade(phase.exit)
          : fade.entering && phases.entering ? easeFade(phase.enter)
          : easeMotion((t*duration-fade.delay)/(duration-fade.delay));
        fade.element.setAttribute('opacity',String(fade.from+(fade.to-fade.from)*local));
      }
    },() => {
      for (const finish of finals) { finish(); }
      next.setAttribute('viewBox',finalView);
      background?.setAttribute('x',String(newView[0])); background?.setAttribute('y',String(newView[1]));
      background?.setAttribute('width',String(newView[2])); background?.setAttribute('height',String(newView[3]));
      this.ghosts?.remove(); this.ghosts = null; next.removeAttribute('data-animating');
    });
  }
  enteringGroup(group,anchor) {
    const box = group.box;
    const origin = anchor ? {x:anchor.x+anchor.width/2,y:anchor.y+Math.min(anchor.height/2,48)} : {x:box.x+box.width/2,y:box.y+box.height/2+10};
    const scale = anchor ? .86 : .98;
    return {...group,shapes:group.shapes.map(shape => {
      const attributes = new Map(shape.attributes);
      for (const key of ['x','y']) {

        if (attributes.has(key)) {
          const center = key === 'x' ? box.x+box.width/2 : box.y+box.height/2;
          attributes.set(key,String(origin[key]+(Number(attributes.get(key))-center)*scale));
        }

      }
      for (const key of ['width','height','rx','font-size']) {

        if (attributes.has(key)) { attributes.set(key,String(Number(attributes.get(key))*scale)); }

      }
      return {...shape,attributes};
    })};
  }
  shapeTweens(group,old,tweens,finals) {
    group.shapes.forEach((shape,index) => {
      const previous = old.shapes[index];

      if (!previous || previous.tag !== shape.tag) { return; }

      for (const name of [...numericMotionAttributes,...colorMotionAttributes]) {
        const from = previous.attributes.get(name),to = shape.attributes.get(name);

        if (from === undefined || to === undefined || from === to) { continue; }

        const a = colorMotionAttributes.includes(name) ? motionColor(from) : Number(from);
        const b = colorMotionAttributes.includes(name) ? motionColor(to) : Number(to);

        if (a === null || b === null || (typeof a === 'number' && (!Number.isFinite(a) || !Number.isFinite(b)))) { continue; }

        tweens.push({apply:t => shape.element.setAttribute(name,Array.isArray(a) ? colorBetween(a,b,t) : String(a+(b-a)*t))});
        finals.push(() => shape.element.setAttribute(name,to));
      }
      const from = previous.attributes.get('d'),to = shape.attributes.get('d');

      if (shape.tag === 'path' && from && to && from !== to) {
        const a = samplePolyline(routePoints(from)),b = samplePolyline(routePoints(to));
        tweens.push({apply:(_,t) => shape.element.setAttribute('d',interpolatePolyline(a,b,t).map((p,i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '))});
        finals.push(() => shape.element.setAttribute('d',to));
      }

    });
  }
  addExits(before,after,next,fades,tweens,finals) {
    const ghosts = document.createElementNS('http://www.w3.org/2000/svg','g');
    ghosts.setAttribute('aria-hidden','true'); ghosts.setAttribute('pointer-events','none');
    ghosts.setAttribute('data-motion-ghosts',''); this.ghosts = ghosts;
    for (const kind of ['nodes','edges','notes']) {
      for (const [id,old] of before[kind]) {

        if (after[kind].has(id)) { continue; }

        const clone = old.element.cloneNode(true);
        for (const name of ['data-resource','data-edge-key','data-from','data-to','data-note','data-note-text','data-note-connector','tabindex','role','aria-pressed']) { clone.removeAttribute(name); }
        ghosts.append(clone);
        const group = captureGroup(clone);
        fades.push({element:clone,from:old.opacity,to:0,delay:0,exiting:true});
        const anchor = kind === 'nodes' ? contextAnchor(old,after.nodes,before.nodes) : null;

        if (anchor) {
          const target = this.enteringGroup(group,anchor);
          const destinations = {...target,shapes:target.shapes.map((shape,i) => ({...shape,element:group.shapes[i].element}))};
          this.shapeTweens(destinations,group,tweens,finals);
        }

      }
    }
    // Departing children must remain above the collapsed parent's opaque tile.
    next.append(ghosts);
  }
}
