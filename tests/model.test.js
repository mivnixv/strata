import test from 'node:test';
import assert from 'node:assert/strict';
import { validateModel, parseModel, DiagramLayout } from '../src/framework.js';
import { example } from '../dist/example.js';
const copy = () => structuredClone(example);
test('validates and normalizes a complete model', () => {
  const result = validateModel(copy()); assert.deepEqual(result.resources.map(r => r.id),example.resources.map(r => r.id)); assert.equal(result.resources[0].parent,null);
});
test('rejects duplicate IDs, unknown references, cycles and malformed input', () => {
  let m = copy(); m.resources[1].id = m.resources[0].id; assert.throws(() => validateModel(m), /Duplicate/);
  m = copy(); m.resources[0].parent = 'missing'; assert.throws(() => validateModel(m), /Unknown parent/);
  m = copy(); m.resources[0].parent = 'web'; assert.throws(() => validateModel(m), /cycle/);
  m = copy(); m.relations[0].to = 'missing'; assert.throws(() => validateModel(m), /existing/);
  m = copy(); m.perspectives[0].resources = ['missing']; assert.throws(() => validateModel(m), /existing/);
  assert.throws(() => validateModel(null)); assert.throws(() => parseModel('{'));
});
test('rejects unsupported types and enforces resource budgets', () => {
  let m = copy(); m.resources[0].type = '__proto__'; assert.throws(() => validateModel(m), /Unknown resource type/);
  m = copy(); m.resources = Array.from({length:301},(_,i) => ({id:String(i),name:'Resource'})); assert.throws(() => validateModel(m), /at most/);
  assert.throws(() => parseModel(' '.repeat(1_000_001)), /1 MB/);
});
test('layout includes nested resources once and keeps nodes inside parents', () => {
  const layout = new DiagramLayout(example).create('system'); assert.deepEqual(layout.nodes.map(n => n.resource.id).sort(),example.resources.map(r => r.id).sort());
  for (const node of layout.nodes) {
    assert.ok(Number.isFinite(node.w) && node.w > 0);
    const parent = layout.nodes.find(n => n.resource.id === node.resource.parent);

    if (parent) { assert.ok(node.x > parent.x); assert.ok(node.y > parent.y); assert.ok(node.x+node.w < parent.x+parent.w); assert.ok(node.y+node.h < parent.y+parent.h); }

  }
});
test('collapsed groups roll relationships up without leaking descendants', () => {
  const layout = new DiagramLayout(example).create('system',new Set(['platform','clients','data','external']));
  assert.equal(layout.nodes.length,4); assert.ok(layout.edges.length > 0);
  assert.ok(layout.edges.every(e => layout.nodes.includes(e.from) && layout.nodes.includes(e.to)));
});
test('perspectives include ancestors but exclude unlisted siblings', () => {
  const ids = new DiagramLayout(example).create('data').nodes.map(n => n.resource.id);
  assert.ok(ids.includes('platform')); assert.ok(ids.includes('services')); assert.ok(ids.includes('orders'));
  assert.ok(!ids.includes('gateway')); assert.ok(!ids.includes('returns')); assert.ok(!ids.includes('clients'));
});
test('empty model and arbitrary input ordering remain renderable', () => {
  const m = copy(); m.resources.reverse(); assert.equal(new DiagramLayout(m).create('system').nodes.length,example.resources.length);
  const empty = {title:'New diagram',resources:[],relations:[],perspectives:[{id:'all',name:'All',resources:[]}]};
  const result = new DiagramLayout(empty).create('all'); assert.equal(result.nodes.length,0); assert.ok(result.width > 0);
});
test('enforces bounded hierarchy depth', () => {
  const m = {title:'Deep',resources:Array.from({length:15},(_,i) => ({id:String(i),name:String(i),parent:i ? String(i-1) : null})),relations:[],perspectives:[{id:'all',name:'All',resources:['0']}]};
  assert.throws(() => validateModel(m), /Nesting/);
});
