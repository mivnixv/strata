import test from 'node:test';
import assert from 'node:assert/strict';
import { TilePacker } from '../src/tiling/packing.js';
test('unconnected tiles pack into multiple rows and columns without overlap',()=>{
 const children=Array.from({length:12},(_,i)=>({id:String(i)}));
 const sizes=new Map(children.map(r=>[r.id,{w:240,h:96}]));
 const layout=new TilePacker().arrange(children,sizes);
 assert.ok(new Set([...layout.positions.values()].map(p=>p.x)).size>1);
 assert.ok(new Set([...layout.positions.values()].map(p=>p.y)).size>1);
 const positions=[...layout.positions.values()];
 for(let i=0;i<positions.length;i++) for(let j=i+1;j<positions.length;j++) {
  const a=positions[i],b=positions[j];assert.ok(a.x+240<=b.x || b.x+240<=a.x || a.y+96<=b.y || b.y+96<=a.y);
 }
 assert.deepEqual(new TilePacker().arrange(children,sizes),layout);
});

import { TileAllocation } from '../src/tiling/allocation.js';
test('weighted allocation fills columns and gives connected tiles more space',()=>{
 const children=[{id:'a'},{id:'b'},{id:'c'}];
 const sizes=new Map([['a',{w:240,h:120,weight:1}],['b',{w:240,h:120,weight:3}],['c',{w:240,h:288,weight:4}]]);
 const grid={w:640,h:288,positions:new Map([['a',{x:0,y:0}],['b',{x:0,y:168}],['c',{x:400,y:0}]])};
 const tiles=new TileAllocation().allocate(children,sizes,grid,640,600);
 assert.equal(tiles.get('c').h,600);
 assert.equal(tiles.get('b').y+tiles.get('b').h,600);
 assert.equal(tiles.get('b').h-120,3*(tiles.get('a').h-120));
 assert.equal(tiles.get('b').y-tiles.get('a').h,48);
});

import { parseStrata,formatStrata } from '../src/language.js';
import { DiagramLayout } from '../src/framework.js';
import { SemanticDetail } from '../src/tiling/semantic.js';
const tileSource=`app group "Group" {
 layout { sizes: proportional; compactness: 0.8 }
 service first "First"
 service second "Second"
}
service target "Target"
second -> target "one"
first -> target "two"
second -> target "three"
view main "Main" {
 include: [group, target]
 layout { sizes: auto; compactness: 0.6 }
 detail: 0.7
}`;
test('tile settings round-trip and reject invalid ranges and modes',()=>{
 const model=parseStrata(tileSource);
 assert.deepEqual(parseStrata(formatStrata(model)),model);
 for(const [before,after] of [["compactness: 0.8","compactness: 0"],["detail: 0.7","detail: 1.1"],["sizes: auto","sizes: invalid"]]) {
  assert.throws(()=>parseStrata(tileSource.replace(before,after)));
 }
});
test('first relationship reference determines peer order',()=>{
 const scene=new DiagramLayout(parseStrata(tileSource)).create('main');
 const first=scene.nodes.find(n=>n.resource.id==='first'),second=scene.nodes.find(n=>n.resource.id==='second');
 assert.ok(second.y<first.y || second.y===first.y && second.x<first.x);
 assert.ok(second.w*second.h>first.w*first.h);
});
test('semantic detail uses pixel budget, respects manual collapse, and never changes the baseline',()=>{
 const base=new DiagramLayout(parseStrata(tileSource)).create('main');
 const snapshot=JSON.stringify(base),resolver=new SemanticDetail();
 assert.ok(resolver.collapse(base,{detail:.5,width:50}).has('group'));
 assert.ok(!resolver.collapse(base,{detail:.5,width:3000}).has('group'));
 assert.ok(!resolver.collapse(base,{detail:.5,width:50,zoom:100}).has('group'));
 assert.equal(resolver.collapse(base,{detail:1,width:1}).size,0);
 assert.ok(resolver.collapse(base,{detail:1,width:1000,manual:new Set(['group'])}).has('group'));
 assert.ok(resolver.collapse(base,{detail:0}).has('group'));
 assert.equal(JSON.stringify(base),snapshot);
 assert.throws(()=>resolver.collapse(base,{detail:2}),/detail/);
});
test('compactness reduces channel space without overlapping tiles',()=>{
 const spacious=new DiagramLayout(parseStrata(tileSource.replace("compactness: 0.6","compactness: 0.1"))).create('main');
 const compact=new DiagramLayout(parseStrata(tileSource.replace("compactness: 0.6","compactness: 1"))).create('main');
 assert.ok(compact.width<spacious.width);
});
