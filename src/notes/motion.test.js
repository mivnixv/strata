import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagramMotion, FrameAnimation } from '../motion.js';

/** Only the SVG operations exercised by note opacity transitions. */
class NoteMotionElement {
  constructor(attributes={},content='',tag='g') { this.values=new Map(Object.entries(attributes)); this.innerHTML=content; this.children=[]; this.tagName=tag; }
  get attributes() { return [...this.values].map(([name,value])=>({name,value:String(value)})); }
  get childElementCount() { return this.children.length; }
  hasAttribute(name) { return this.values.has(name); }
  getAttribute(name) { return this.values.has(name) ? String(this.values.get(name)) : null; }
  setAttribute(name,value) { this.values.set(name,String(value)); }
  removeAttribute(name) { this.values.delete(name); }
  append(child) { this.children.push(child); child.parent=this; }
  remove() { this.parent?.children.splice(this.parent.children.indexOf(this),1); }
  cloneNode() { return new NoteMotionElement(Object.fromEntries(this.values),this.innerHTML); }
  querySelector() { return null; }
  querySelectorAll(selector) {
    const names=[...selector.matchAll(/\[([\w-]+)\]/g)].map(match=>match[1]);
    const matches=[], queue=[...this.children];
    for (let index=0;index<queue.length;index++) {
      const child=queue[index];

      if (names.some(name=>child.hasAttribute(name)) || selector.split(',').includes(child.tagName)) { matches.push(child); }

      queue.push(...child.children);
    }
    return matches;
  }
}

function animationFixture(t,{reduced=false}={}) {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElementNS:()=>new NoteMotionElement()}});
  t.after(()=>{

    if (previous) { Object.defineProperty(globalThis,'document',previous); }
    else { delete globalThis.document; }

  });
  let time=0, sequence=0;
  const frames=new Map();
  const timeline=new FrameAnimation({now:()=>time,reducedMotion:()=>reduced,requestFrame:callback=>{frames.set(++sequence,callback);return sequence;},cancelFrame:id=>frames.delete(id)});
  const motion=new DiagramMotion({timeline});
  const scene=(content='original',opacities=[.25,1,.25])=>{
    const svg=new NoteMotionElement({viewBox:'0 0 700 420'});
    for (const [index,kind] of ['data-note','data-note-text','data-note-connector'].entries()) {
      svg.append(new NoteMotionElement({[kind]:'1',opacity:opacities[index]},content));
    }
    return svg;
  };
  const item=(svg,id,{x=100,depth=0,parent=null}={})=>{
    const node=new NoteMotionElement({'data-resource':id,'data-depth':depth,'data-parent':parent,opacity:1});
    node.append(new NoteMotionElement({x,y:100,width:200,height:120},'','rect')); svg.append(node);
    return node;
  };
  const owners=(svg,ids)=>{
    for (const child of svg.children.filter(child=>child.hasAttribute('data-note') || child.hasAttribute('data-note-text') || child.hasAttribute('data-note-connector'))) {
      child.setAttribute('data-note-owners',JSON.stringify(ids));
    }
  };
  return {motion,scene,item,owners,frames,tick:at=>{
    time=at; const callbacks=[...frames.values()]; frames.clear();
    for (const callback of callbacks) { callback(at); }
  }};
}

test('note marks, blocks and connectors fade in together on initial load',t=>{
  const f=animationFixture(t), next=f.scene(), elements=[...next.children];
  f.motion.transition(null,next,{duration:400});
  assert.ok(elements.every(element=>element.getAttribute('opacity')==='0'));
  f.tick(200);
  elements.forEach((element,index)=>{
    const opacity=Number(element.getAttribute('opacity')), final=[.25,1,.25][index];
    assert.ok(opacity>0 && opacity<final);
  });
  f.tick(400);
  assert.deepEqual(elements.map(element=>Number(element.getAttribute('opacity'))),[.25,1,.25]);
  assert.equal(next.hasAttribute('data-animating'),false);
  assert.equal(f.frames.size,0);
});

test('removed notes fade out as ghosts and changed geometry crossfades',t=>{
  const f=animationFixture(t), before=f.scene(), after=f.scene('moved');
  f.motion.transition(before,after,{duration:400});
  const ghosts=f.motion.ghosts;
  assert.equal(ghosts.children.length,3);
  assert.ok(ghosts.children.every(element=>!['data-note','data-note-text','data-note-connector'].some(name=>element.hasAttribute(name))));
  f.tick(200);
  assert.ok(Number(ghosts.children[0].getAttribute('opacity'))<.25);
  assert.ok(Number(after.children[0].getAttribute('opacity'))>0);
  f.motion.finish();
  assert.equal(f.motion.ghosts,null);
  assert.equal(after.children.length,3);
  const empty=new NoteMotionElement({viewBox:'0 0 700 420'});
  f.motion.transition(after,empty,{duration:400});
  assert.equal(f.motion.ghosts.children.length,3);
  f.tick(600);
  assert.equal(empty.children.length,0);
});

test('selection fades to target opacity without duplicating note groups',t=>{
  const f=animationFixture(t), before=f.scene(), after=f.scene('original',[1,1,.5]);
  f.motion.transition(before,after,{duration:400});
  assert.equal(f.motion.ghosts.children.length,0);
  assert.equal(after.children[0].getAttribute('opacity'),'0.25');
  f.tick(200);
  assert.ok(Number(after.children[0].getAttribute('opacity'))>.25);
  assert.ok(Number(after.children[2].getAttribute('opacity'))<.5);
  f.motion.finish();
  assert.equal(after.children[0].getAttribute('opacity'),'1');
  assert.equal(after.children[2].getAttribute('opacity'),'0.5');
});

test('reduced motion and disabled animation preserve final note visibility',t=>{
  const f=animationFixture(t,{reduced:true}), next=f.scene();
  f.motion.transition(null,next);
  assert.deepEqual(next.children.map(element=>Number(element.getAttribute('opacity'))),[.25,1,.25]);
  assert.equal(f.frames.size,0);
  f.motion.transition(next,f.scene('different'),{enabled:false});
  assert.equal(f.frames.size,0);
});

test('rapid note transitions resume current opacity and exports settle all notes',t=>{
  const f=animationFixture(t), first=f.scene();
  f.motion.transition(null,first,{duration:400}); f.tick(100);
  const opacity=first.children[0].getAttribute('opacity'), next=f.scene();
  f.motion.transition(first,next,{duration:400});
  assert.equal(next.children[0].getAttribute('opacity'),opacity);
  assert.equal(f.frames.size,1);
  f.motion.finish();
  assert.deepEqual(next.children.map(element=>Number(element.getAttribute('opacity'))),[.25,1,.25]);
  assert.equal(f.frames.size,0);
  assert.equal(next.hasAttribute('data-animating'),false);
});

test('moved notes fade in with persistent items instead of waiting for the final phase',t=>{
  const f=animationFixture(t), before=f.scene(), after=f.scene('moved');
  f.item(before,'api'); f.item(after,'api',{x:200});
  f.owners(before,['api']); f.owners(after,['api']);
  const notes=after.children.slice(0,3);
  f.motion.transition(before,after,{duration:400});
  f.tick(80);
  assert.ok(notes.every(note=>Number(note.getAttribute('opacity'))>0));
  f.motion.finish();
  assert.deepEqual(notes.map(note=>Number(note.getAttribute('opacity'))),[.25,1,.25]);
});

test('initial marks, blocks, and connectors share their nested item entry delay',t=>{
  const f=animationFixture(t), next=f.scene(), notes=[...next.children];
  const item=f.item(next,'api',{depth:2}); f.owners(next,['api']);
  f.motion.transition(null,next,{duration:400});
  f.tick(18);
  assert.equal(item.getAttribute('opacity'),'0');
  assert.ok(notes.every(note=>note.getAttribute('opacity')==='0'));
  f.tick(100);
  const progress=Number(item.getAttribute('opacity'));
  assert.ok(progress>0);
  notes.forEach((note,index)=>assert.equal(Number(note.getAttribute('opacity'))/[.25,1,.25][index],progress));
  f.motion.finish();
});

test('expanding a new item reveals its notes on the same animation frame',t=>{
  const f=animationFixture(t), before=f.scene(), after=f.scene('expanded');
  before.children=[]; f.item(before,'parent'); f.item(after,'parent',{x:200});
  const notes=after.children.slice(0,3), item=f.item(after,'api',{depth:1,parent:'parent'});
  f.owners(after,['api']);
  f.motion.transition(before,after,{duration:400});
  f.tick(400);
  assert.equal(item.getAttribute('opacity'),'0');
  assert.ok(notes.every(note=>note.getAttribute('opacity')==='0'));
  f.tick(720);
  const progress=Number(item.getAttribute('opacity'));
  assert.ok(progress>0 && progress<1);
  notes.forEach((note,index)=>assert.equal(Number(note.getAttribute('opacity'))/[.25,1,.25][index],progress));
  f.motion.finish();
});
