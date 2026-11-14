import test from 'node:test';
import assert from 'node:assert/strict';
import { routesOverlap,sharedTrunk,coveredConnections } from '../src/connections/overlap.js';
const line=[{x:0,y:20},{x:100,y:20}];
test('detects crossings and shared runs but excludes separate lines and endpoint touches',()=>{
 assert.ok(routesOverlap(line,[{x:50,y:0},{x:50,y:40}]));
 assert.ok(routesOverlap(line,[{x:50,y:20},{x:150,y:20}]));
 assert.ok(!routesOverlap(line,[{x:0,y:30},{x:100,y:30}]));
 assert.ok(!routesOverlap(line,[{x:100,y:20},{x:150,y:20}]));
});
test('intentional collapsed trunks are not treated as occlusion',()=>{
 const group={container:true,collapsed:true};
 assert.ok(sharedTrunk({from:group,to:{}},{from:group,to:{}}));
 assert.ok(!sharedTrunk({from:{},to:{}},{from:{},to:{}}));
});

test('diagonal crossings and overlaps retain hover occlusion',()=>{
 assert.ok(routesOverlap([{x:0,y:0},{x:100,y:100}],line));
 assert.ok(routesOverlap([{x:0,y:0},{x:100,y:100}],[{x:25,y:25},{x:125,y:125}]));
 assert.ok(!routesOverlap([{x:0,y:0},{x:100,y:100}],[{x:0,y:10},{x:100,y:110}]));
});

test('a hidden route cannot hide an otherwise uncovered connection',()=>{
 const edge=points=>({from:{},to:{},points});
 const lower=edge([{x:0,y:20},{x:60,y:20}]);
 const middle=edge([{x:40,y:0},{x:40,y:100}]);
 const upper=edge([{x:20,y:80},{x:100,y:80}]);
 const covered=coveredConnections([lower,middle,upper]);
 assert.equal(covered.has(middle),true);
 assert.equal(covered.has(lower),false);
 assert.equal(covered.has(upper),false);
 assert.equal(coveredConnections([lower,upper,middle]).has(lower),true);
});

test('every protected connection is visible even when protected connections cross',()=>{
 const edge=points=>({from:{},to:{},points});
 const first=edge([{x:0,y:20},{x:100,y:20}]);
 const second=edge([{x:50,y:0},{x:50,y:40}]);
 assert.equal(coveredConnections([first,second]).has(first),true);
 const covered=coveredConnections([first,second],()=>true);
 assert.equal(covered.size,0);
});
