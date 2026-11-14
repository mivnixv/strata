import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionHover } from '../src/connections/hover.js';
function entry(from,to,points) {
 const paths=Array.from({length:4},(_,i)=>({opacity:null,hasAttribute:()=>i>=2,setAttribute(_,value){this.opacity=value;}}));
 return {edge:{from:{resource:{id:from}},to:{resource:{id:to}},points},opacity:'1',group:{attributes:{},setAttribute(key,value){this.attributes[key]=value;},querySelectorAll(){return paths;}},paths};
}
test('hover reveals direct connections, puts crossings underneath, and restores original order',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 const order=[];const controller=new ConnectionHover({append:group=>order.push(group)},[first,second]);
 controller.show('a');
 assert.equal(order.at(-1),first.group);
 assert.equal(first.paths[1].opacity,'1');
 assert.equal(second.paths[1].opacity,'.1');
 assert.equal(second.paths[3].opacity,'1');
 controller.show(null);
 assert.equal(order.at(-1),second.group);
 assert.equal(first.paths[1].opacity,'.1');
 assert.equal(second.paths[1].opacity,'1');
});
test('hover starts explicit fades after reordering and cancels them on the next hover',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 const animations=[];
 for(const item of [first,second]) for(const element of [item.group,...item.paths]) {
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
 assert.equal(item.paths[1].opacity,'1');
});

test('selected connections remain fully visible when another connection crosses above them',()=>{
 const first=entry('a','b',[{x:0,y:20},{x:100,y:20}]);
 const second=entry('c','d',[{x:50,y:0},{x:50,y:40}]);
 first.selected=true;
 const controller=new ConnectionHover({append(){}},[first,second]);
 controller.show('c');
 assert.equal(first.paths[1].opacity,'1');
 controller.show(null);
 assert.equal(first.paths[1].opacity,'1');
});
