import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagramLayout, selectionFocus } from '../src/framework.js';
import { parseStrata } from '../src/language.js';
const model = parseStrata('app web "Web"\nservice platform "Platform" {\n service api "API"\n database db "Database"\n service worker "Worker"\n service isolated "Isolated"\n}\nweb -> api : "request"\napi -> db : "SQL"\nworker -> db : "maintenance"\nview all "All" {\n include web, platform\n}\nview scoped "Scoped" {\n relations only\n api -> db : "local SQL"\n}');
const layout = new DiagramLayout(model).create('all');
const names = values => [...values].sort();
const labels = focus => [...focus.edges].map(e => e.label).sort();
test('a selected item highlights its incoming/outgoing edges and only direct neighbors', () => {
  const focus = selectionFocus(layout,'api',model.resources);
  assert.equal(focus.primary,'api');
  assert.deepEqual(names(focus.nodes),['api','db','web']);
  assert.deepEqual(labels(focus),['SQL','request']);
  assert.deepEqual(names(focus.context),['platform']);
  assert.ok(!focus.nodes.has('worker'));
});
test('switching selection changes focus without mutating the cached layout', () => {
  const before = JSON.stringify(layout);
  const focus = selectionFocus(layout,'db',model.resources);
  assert.deepEqual(names(focus.nodes),['api','db','worker']);
  assert.deepEqual(labels(focus),['SQL','maintenance']);
  assert.ok(!focus.nodes.has('web'));
  assert.equal(JSON.stringify(layout),before);
});
test('selecting a group does not highlight its descendants or their connections', () => {
  const focus = selectionFocus(layout,'platform',model.resources);
  assert.deepEqual(names(focus.nodes),['platform']);
  assert.deepEqual(labels(focus),[]);
});
test('collapsed groups and hidden descendants focus rolled-up connections', () => {
  const collapsed = new DiagramLayout(model).create('all',new Set(['platform']));
  const focus = selectionFocus(collapsed,'api',model.resources);
  assert.equal(focus.primary,'platform');
  assert.deepEqual(names(focus.nodes),['platform','web']);
  assert.deepEqual(labels(focus),['request']);
});
test('an isolated selected node remains visible while every unrelated edge is dimmed', () => {
  const focus = selectionFocus(layout,'isolated',model.resources);
  assert.deepEqual(names(focus.nodes),['isolated']);
  assert.equal(focus.edges.size,0);
  assert.deepEqual(names(focus.context),['platform']);
});
test('clearing selection or selecting an unknown item restores the normal view', () => {
  for (const selected of [null,'missing']) {
    const focus = selectionFocus(layout,selected,model.resources);
    assert.equal(focus.primary,null);
    assert.equal(focus.edges.size,0);
    assert.equal(focus.nodes.size,0);
  }
});
test('selection uses only edges in the current perspective and does not focus hidden siblings', () => {
  const scoped = new DiagramLayout(model).create('scoped');
  const focus = selectionFocus(scoped,'api',model.resources);
  assert.deepEqual(names(focus.nodes),['api','db']);
  assert.deepEqual(labels(focus),['local SQL']);
  assert.equal(selectionFocus(scoped,'worker',model.resources).primary,null);
});

test('group selection highlights only its own incoming and outgoing connections', () => {
  const connected = parseStrata(`app outside "Outside"
app parent "Parent" {
 service child "Child" {
  service nested "Nested"
 }
}
app neighbor "Neighbor" {
 service other "Other"
}
outside -> parent : "incoming"
parent -> neighbor : "outgoing"
outside -> child : "child connection"
child -> other : "child to child"
view all "All" {
 include outside, parent, neighbor
}`);
  const scene = new DiagramLayout(connected).create('all');
  const focus = selectionFocus(scene,'parent',connected.resources);
  assert.deepEqual(names(focus.nodes),['neighbor','outside','parent']);
  assert.deepEqual(labels(focus),['incoming','outgoing']);
  assert.equal(focus.context.size,0);
  const childFocus = selectionFocus(scene,'child',connected.resources);
  assert.deepEqual(names(childFocus.nodes),['child','other','outside']);
  assert.deepEqual(labels(childFocus),['child connection','child to child']);
  assert.deepEqual(names(childFocus.context),['neighbor','parent']);
});
