import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionHover } from '../src/connections/hover.js';
function element(opacity='1') {
 return {attributes:{opacity},setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return this.attributes[key];}};
}
function entry(from,to,points) {
 return {edge:{from:{resource:{id:from}},to:{resource:{id:to}},points},opacity:'1',group:element(),body:element(),endpoints:element('0')};
}
test('hover reveals direct connections, puts crossings underneath, and restores original order',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 const order=[];const controller=new ConnectionHover({append:group=>order.push(group)},[first,second]);
 controller.show('a');
 assert.equal(order.at(-1),first.group);
 assert.equal(first.body.attributes.opacity,'1');
 assert.equal(second.body.attributes.opacity,'0.1');
 assert.equal(second.group.attributes['data-covered'],'true');
 assert.equal(second.endpoints.attributes.opacity,'1');
 assert.equal(first.endpoints.attributes.opacity,'0');
 controller.show(null);
 assert.equal(order.at(-1),second.group);
 assert.equal(first.body.attributes.opacity,'0.1');
 assert.equal(second.body.attributes.opacity,'1');
 assert.equal(first.endpoints.attributes.opacity,'1');
 assert.equal(second.endpoints.attributes.opacity,'0');
 assert.equal(second.group.attributes['data-covered'],'false');
});
test('hover starts explicit fades after reordering and cancels them on the next hover',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 const animations=[];
 first.body.setAttribute('opacity','0');
 for(const item of [first,second]) for(const element of [item.body,item.endpoints]) {
  element.animate=(frames,options)=>{
   const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};
   animations.push(animation);return animation;
  };
 }
 const controller=new ConnectionHover({append(){}},[first,second]);
 controller.show('a');
 assert.ok(animations.length>0);
 assert.ok(animations.every(a=>a.options.duration===320));
 const previous=[...animations];controller.show('c');
 assert.ok(previous.every(a=>a.cancelled));
});

test('hover does not finish an active layout transition',()=>{
 const item=entry('a','b',[{x:0,y:0},{x:100,y:0}]);
 let finished=false;
 const controller=new ConnectionHover({append(){}},[item],()=>{finished=true;});
 controller.show('a');
 controller.show(null);
 assert.equal(finished,false);
 assert.equal(item.body.attributes.opacity,'1');
});

test('hover alone never recolors connection bodies or endpoint symbols',()=>{
 const item=entry('a','b',[{x:0,y:0},{x:100,y:0}]);
 item.body.setAttribute('stroke','#aaaaaa');
 item.endpoints.setAttribute('stroke','#aaaaaa');
 const controller=new ConnectionHover({append(){}},[item]);
 for (const hovered of ['a','b',null]) {
  controller.show(hovered);
  assert.equal(item.body.getAttribute('stroke'),'#aaaaaa');
  assert.equal(item.endpoints.getAttribute('stroke'),'#aaaaaa');
 }
});

test('hover does not reveal unrelated connections while an item is selected',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 first.selected=true;
 const controller=new ConnectionHover({append(){}},[first,second]);
 controller.show('c');
 assert.equal(first.body.attributes.opacity,'1');
 assert.equal(second.body.attributes.opacity,'0.1');
 assert.equal(second.group.attributes['data-hover'],'none');
 controller.show(null);
 assert.equal(first.body.attributes.opacity,'1');
 controller.show('a');
 assert.equal(first.body.attributes.opacity,'1');
 assert.equal(second.body.attributes.opacity,'0.1');
});

test('all selected connections remain visible even when they overlap one another',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','a',[{x:50,y:0},{x:50,y:40}]);
 const unrelated=entry('d','e',[{x:0,y:10},{x:100,y:30}]);
 first.selected=true;second.selected=true;
 const controller=new ConnectionHover({append(){}},[first,second,unrelated]);
 for (const hovered of [null,'a','d']) {
  controller.show(hovered);
  assert.equal(first.body.attributes.opacity,'1');
  assert.equal(second.body.attributes.opacity,'1');
  assert.equal(first.group.attributes['data-covered'],'false');
  assert.equal(second.group.attributes['data-covered'],'false');
  assert.equal(first.endpoints.attributes.opacity,'0');
  assert.equal(second.endpoints.attributes.opacity,'0');
  assert.equal(unrelated.body.attributes.opacity,'0.1');
 }
 first.selected=false;second.selected=false;
 controller.show(null);
 assert.equal(first.body.attributes.opacity,'0.1');
 assert.equal(second.body.attributes.opacity,'0.1');
 assert.equal(unrelated.body.attributes.opacity,'1');
});

test('hover reveals all overlapping incoming and outgoing connections and restores idle on leave',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','a',[{x:50,y:0},{x:50,y:40}]);
 const controller=new ConnectionHover({append(){}},[first,second]);
 controller.show('a');
 assert.equal(first.body.attributes.opacity,'1');
 assert.equal(second.body.attributes.opacity,'1');
 assert.equal(first.endpoints.attributes.opacity,'0');
 assert.equal(second.endpoints.attributes.opacity,'0');
 controller.show(null);
 assert.equal(first.body.attributes.opacity,'0.1');
 assert.equal(first.endpoints.attributes.opacity,'1');
});

test('covered connections remain dimmed rather than becoming invisible',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 new ConnectionHover({append(){}},[first,second]).show('c');
 assert.equal(first.body.attributes.opacity,'0.1');
 assert.equal(first.group.attributes['data-covered'],'true');
 assert.equal(first.endpoints.attributes.opacity,'1');
 assert.equal(first.group.attributes.opacity,'1');
});

test('unrelated connections retain selection dimming on both their body and endpoints',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 first.selected=true;
 second.opacity='0.1';
 new ConnectionHover({append(){}},[first,second]).show(null);
 assert.equal(first.body.attributes.opacity,'1');
 assert.equal(second.body.attributes.opacity,'0.1');
 assert.equal(second.endpoints.attributes.opacity,'0.1');
});

test('selecting an isolated item disables hover even without selected connections',()=>{
 const item=entry('a','b',[{x:0,y:0},{x:100,y:0}]);
 item.opacity='0.1';
 const controller=new ConnectionHover({append(){}},[item],{selectionActive:true});
 controller.show('a');
 assert.equal(item.body.attributes.opacity,'0.1');
 assert.equal(item.group.attributes['data-hover'],'none');
 const idle=new ConnectionHover({append(){}},[item],{selectionActive:false});
 idle.show('a');
 assert.equal(item.body.attributes.opacity,'1');
 assert.equal(item.group.attributes['data-hover'],'connected');
});
