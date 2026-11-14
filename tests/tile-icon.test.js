import test from 'node:test';
import assert from 'node:assert/strict';
import { tileIconPlacement } from '../src/icons/tile-icon.js';
const tile={x:100,y:200,w:300,h:500,container:false,collapsed:false};
test('large leaf and collapsed tiles have top-centered icons, expanded parents do not',()=>{
 assert.deepEqual(tileIconPlacement(tile),{x:250,y:364,size:144});
 assert.ok(tileIconPlacement({...tile,container:true,collapsed:true}));
 assert.equal(tileIconPlacement({...tile,container:true}),null);
});
test('icons fit below metadata and disappear when too small on screen',()=>{
 assert.equal(tileIconPlacement({...tile,h:120}),null);
 assert.equal(tileIconPlacement({...tile,w:80}),null);
 assert.equal(tileIconPlacement(tile,.1),null);
 const box=tileIconPlacement({...tile,h:240});
 assert.ok(box.y-box.size/2>=tile.y+92);
 assert.ok(box.size>=48);
});
