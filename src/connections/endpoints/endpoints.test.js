import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionEndpoint } from './geometry.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';
import { Script } from 'node:vm';

const line=[{x:0,y:20},{x:100,y:20}];
test('source and target endpoint strokes fade over bounded route distances',()=>{
  const start=connectionEndpoint(line),end=connectionEndpoint(line,true);
  assert.equal(start.d,'M 0 20 L 25.6 20');
  assert.equal(end.d,'M 74.4 20 L 100 20');
  assert.deepEqual(start.tip,{x:0,y:20});
  assert.deepEqual(end.tip,{x:100,y:20});
  assert.equal(start.offset,0);
  assert.equal(end.offset,74.4);
});

test('clipping follows bends instead of stopping at the first short segment',()=>{
  const points=[{x:0,y:0},{x:10,y:0},{x:10,y:100}];
  const start=connectionEndpoint(points);
  assert.match(start.d,/^M 0 0 L 10 0 L 10 /);
  assert.ok(Math.abs(start.inner.y-15.6)<1e-9);
  assert.equal(connectionEndpoint(points,true).d,'M 10 74.4 L 10 100');
});

test('short and zero-length routes keep finite, non-overlapping endpoint geometry',()=>{
  const short=[{x:0,y:0},{x:12,y:0}];
  assert.equal(connectionEndpoint(short).d,'M 0 0 L 6 0');
  assert.equal(connectionEndpoint(short,true).d,'M 6 0 L 12 0');
  const duplicate=[{x:0,y:0},{x:0,y:0},{x:100,y:0}];
  assert.equal(connectionEndpoint(duplicate).d,'M 0 0 L 25.6 0');
  for (const end of [false,true]) {
    const zero=connectionEndpoint([{x:1,y:2},{x:1,y:2}],end);
    assert.equal(zero.d,'M 1 2');
    assert.equal(zero.offset,0);
  }
});

test('diagonal endpoint lengths and dash offsets stay aligned with the complete route',()=>{
  const points=[{x:0,y:0},{x:60,y:80}];
  const start=connectionEndpoint(points),end=connectionEndpoint(points,true);
  assert.ok(Math.abs(Math.hypot(start.inner.x,start.inner.y)-25.6)<1e-9);
  assert.ok(Math.abs(Math.hypot(60-end.inner.x,80-end.inner.y)-25.6)<1e-9);
  assert.equal(end.offset,74.4);
});

test('standalone HTML includes executable endpoint fades with dashed styling',async()=>{
  const html=await new StandaloneBuilder().build('service api "API"\nservice worker "Worker"\napi -> worker dashed');
  assert.ok(html.includes('data-connection-ends'));
  assert.ok(html.includes('stop-opacity'));
  assert.ok(html.includes('stroke-dashoffset'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
