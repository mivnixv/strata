import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameAnimation, samplePolyline, interpolatePolyline, disclosureProgress } from '../src/motion.js';
function clock() {
  let time = 0,id = 0,reduced = false;
  const frames = new Map();
  const timeline = new FrameAnimation({now:() => time,requestFrame:callback => { frames.set(++id,callback); return id; },cancelFrame:id => frames.delete(id),reducedMotion:() => reduced});
  return {timeline,frames,reduce:() => { reduced = true; },tick:at => {
    time = at; const callbacks = [...frames.values()]; frames.clear();
    for (const callback of callbacks) { callback(at); }
  }};
}
test('animation clock reaches the final state and stops requesting frames', () => {
  const c = clock(),updates = []; let completed = 0;
  c.timeline.play(400,t => updates.push(t),() => completed++);
  assert.deepEqual(updates,[0]); c.tick(100); assert.equal(updates.at(-1),.25);
  c.tick(400); assert.equal(updates.at(-1),1); assert.equal(completed,1);
  assert.equal(c.frames.size,0); assert.equal(c.timeline.job,null);
});
test('rapid interaction cancels previous work without snapping it to its target', () => {
  const c = clock(),old = [],current = [];
  let staleCompletions = 0;
  c.timeline.play(400,t => old.push(t),() => staleCompletions++);
  const staleFrame = [...c.frames.values()][0];
  c.tick(100); c.timeline.play(200,t => current.push(t));
  staleFrame(400);
  assert.equal(old.at(-1),.25); assert.equal(staleCompletions,0);
  assert.equal(c.frames.size,1);
  c.tick(300); assert.equal(current.at(-1),1); assert.equal(c.frames.size,0);
});
test('export settling completes once and removes pending frames', () => {
  const c = clock(),updates = []; let completed = 0;
  c.timeline.play(420,t => updates.push(t),() => completed++); c.tick(60);
  c.timeline.finish(); c.timeline.finish();
  assert.equal(updates.at(-1),1); assert.equal(completed,1); assert.equal(c.frames.size,0);
});
test('reduced motion applies the final state immediately without animation frames', () => {
  const c = clock(),updates = []; c.reduce(); let completed = 0;
  c.timeline.play(420,t => updates.push(t),() => completed++);
  assert.deepEqual(updates,[1]); assert.equal(completed,1); assert.equal(c.frames.size,0);
});
test('a reduced-motion preference change settles an active animation', () => {
  const c = clock(),updates = []; let completed = 0;
  c.timeline.play(420,t => updates.push(t),() => completed++); c.tick(50); c.reduce(); c.tick(66);
  assert.equal(updates.at(-1),1); assert.equal(completed,1); assert.equal(c.frames.size,0);
});
test('cancelling drops callbacks without completing or changing the current position', () => {
  const c = clock(),updates = []; let completed = 0;
  c.timeline.play(200,t => updates.push(t),() => completed++); c.tick(50); c.timeline.cancel(); c.tick(200);
  assert.equal(updates.at(-1),.25); assert.equal(completed,0); assert.equal(c.frames.size,0);
});
test('zero duration settles immediately and invalid durations cannot create an endless job', () => {
  const c = clock(),updates = [];
  c.timeline.play(0,t => updates.push(t)); assert.deepEqual(updates,[1]);
  for (const invalid of [NaN,Infinity,-1]) { assert.throws(() => c.timeline.play(invalid,() => {}),/duration/); }
  assert.equal(c.frames.size,0);
});
test('route sampling preserves endpoints and equal distance along multiple segments', () => {
  const points = [{x:0,y:0},{x:20,y:0},{x:20,y:20}];
  assert.deepEqual(samplePolyline(points,5),[{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:20,y:10},{x:20,y:20}]);
  const fixed = samplePolyline(points); assert.equal(fixed.length,32);
  assert.deepEqual(fixed[0],points[0]); assert.deepEqual(fixed.at(-1),points.at(-1));
});
test('zero-length routes remain finite; invalid sample counts are rejected', () => {
  for (const points of [[{x:7,y:3}],[{x:7,y:3},{x:7,y:3}]]) {
    assert.ok(samplePolyline(points).every(p => p.x === 7 && p.y === 3));
  }
  for (const count of [1,129,NaN,2.5]) { assert.throws(() => samplePolyline([{x:0,y:0}],count),/samples/); }
  assert.throws(() => samplePolyline([]),/points/);
});
test('routes with different bend counts interpolate with stable endpoints and finite coordinates', () => {
  const a = samplePolyline([{x:0,y:0},{x:30,y:0}]);
  const b = samplePolyline([{x:10,y:20},{x:10,y:40},{x:60,y:40}]);
  assert.deepEqual(interpolatePolyline(a,b,0),a); assert.deepEqual(interpolatePolyline(a,b,1),b);
  assert.ok(interpolatePolyline(a,b,.5).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.throws(() => interpolatePolyline(a,b.slice(1),.5),/equal lengths/);
});

test('children disappear before geometry shrinks and appear after expansion finishes',()=>{
 const collapse={exiting:true},expand={entering:true};
 assert.equal(disclosureProgress(.2,collapse).layout,0);
 assert.equal(disclosureProgress(.25,collapse).exit,1);
 assert.ok(disclosureProgress(.5,collapse).layout>0);
 assert.equal(disclosureProgress(.7,expand).enter,0);
 assert.equal(disclosureProgress(.8,expand).layout,1);
 assert.ok(disclosureProgress(.9,expand).enter>0);
 assert.equal(disclosureProgress(1,expand).enter,1);
});
