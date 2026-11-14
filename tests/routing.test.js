import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagramLayout } from '../src/framework.js';
import { parseStrata } from '../src/language.js';
import { OrthogonalRouter, segmentIntersectsRect } from '../src/routing.js';
import { example } from '../dist/example.js';
function segments(edge) { return edge.points.slice(1).map((p,i) => [edge.points[i],p]); }
function shared(a,b,c,d) {

  if (a.x === b.x && c.x === d.x && a.x === c.x) { return Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)); }
  if (a.y === b.y && c.y === d.y && a.y === c.y) { return Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)); }

  return 0;
}
function assertRoutes(layout) {
  for (const edge of layout.edges) {
    assert.ok(edge.points.length >= 2);
    const start = edge.points[0], end = edge.points.at(-1);
    assert.ok(start.x === edge.from.x || start.x === edge.from.x+edge.from.w);
    assert.ok(end.x === edge.to.x || end.x === edge.to.x+edge.to.w);
    for (const [a,b] of segments(edge)) {
      assert.ok(a.x >= 0 && a.y >= 0 && b.x <= layout.width && b.y <= layout.height);
      for (const node of layout.nodes) {
        const obstacle = {...node,h:node.container && !node.collapsed ? 44 : node.h};
        assert.equal(segmentIntersectsRect(a,b,obstacle),false,`${edge.from.resource.id} → ${edge.to.resource.id} crosses ${node.resource.id}`);
      }
    }
  }
  for (let i = 0; i < layout.edges.length; i++) {
    for (let j = i+1; j < layout.edges.length; j++) {
      for (const [a,b] of segments(layout.edges[i])) {
        for (const [c,d] of segments(layout.edges[j])) {
          const first = layout.edges[i], second = layout.edges[j];
          const sameTrunk = (first.from === second.from && first.from.container && first.from.collapsed) || (first.to === second.to && first.to.container && first.to.collapsed);
          assert.ok(sameTrunk || shared(a,b,c,d) < .01,`Edges ${i} and ${j} overlap`);
        }
      }
    }
  }
}
test('example views avoid node intersections and collinear arrow overlaps', () => {
  for (const view of example.perspectives) { assertRoutes(new DiagramLayout(example).create(view.id)); }
});
test('collapsed and partially collapsed groups retain clear routes', () => {
  for (const ids of [['platform'],['services'],['clients','platform','data','external']]) {
    assertRoutes(new DiagramLayout(example).create('system',new Set(ids)));
  }
});
test('dependencies form left-to-right columns regardless of declaration order', () => {
  const m = parseStrata('database db "Database"\nservice api "API"\napp web "Web"\nweb -> api\napi -> db');
  const layout = new DiagramLayout(m).create('all');
  const get = id => layout.nodes.find(n => n.resource.id === id);
  assert.ok(get('web').x < get('api').x); assert.ok(get('api').x < get('db').x); assertRoutes(layout);
});
test('fan-out, fan-in, bidirectional edges, cycles and parallel labels use distinct ports', () => {
  const m = parseStrata('service a "A"\nservice b "B"\nservice c "C"\nservice d "D"\na -> b : "first"\na -> b : "second"\na -> c\nb -> d\nc -> d\nd -> a\nb -> a');
  const layout = new DiagramLayout(m).create('all'); assert.equal(layout.edges.length,7); assertRoutes(layout);
});
test('nested group dependencies arrange children into dependency layers', () => {
  const m = parseStrata('service system "System" {\n database db "Database"\n service api "API"\n}\napi -> db');
  const layout = new DiagramLayout(m).create('all');
  assert.ok(layout.nodes.find(n => n.resource.id === 'api').x < layout.nodes.find(n => n.resource.id === 'db').x);
  assertRoutes(layout);
});
test('rendered label anchors avoid cards and group headers', () => {
  for (const view of example.perspectives) {
    const layout = new DiagramLayout(example).create(view.id);
    for (const edge of layout.edges.filter(e => e.labelPosition)) {
      const {x,y} = edge.labelPosition;
      for (const node of layout.nodes) {
        const h = node.container && !node.collapsed ? 44 : node.h;
        assert.ok(!(x > node.x && x < node.x+node.w && y > node.y && y < node.y+h),'Label overlaps a resource');
      }
    }
  }
});

test('collapsed groups preserve neighbor sides and separate incoming from outgoing trunks', () => {
  const model = parseStrata(`app left "Left"
app group "Group" {
 service a "A"
 service b "B"
}
app right "Right"
left -> a : "one"
left -> b : "two"
a -> left : "three"
b -> left : "four"
right -> a : "five"
a -> right : "six"
a -> b : "internal"`);
  const diagram = new DiagramLayout(model);
  const expanded = diagram.create('all');
  const collapsed = diagram.create('all',new Set(['group']));
  const incoming = collapsed.edges.filter(e => e.to.resource.id === 'group');
  const outgoing = collapsed.edges.filter(e => e.from.resource.id === 'group');
  assert.equal(incoming.length,2);
  assert.equal(outgoing.length,2);
  for (const edge of incoming) {
    assert.equal(edge.points.at(-1).x,edge.from.x < edge.to.x ? edge.to.x : edge.to.x+edge.to.w);
  }
  for (const edge of outgoing) {
    assert.equal(edge.points[0].x,edge.to.x < edge.from.x ? edge.from.x : edge.from.x+edge.from.w);
  }
  assert.equal(collapsed.edges.reduce((sum,e) => sum+e.relationships.length,0),6);
  assert.equal(collapsed.edges.filter(e => e.label === '2 relationships').length,2);
  assert.ok(collapsed.nodes.every(n => !['a','b'].includes(n.resource.id)));
  assert.equal(expanded.edges.length,7);
  assert.deepEqual(diagram.create('all'),expanded);
  assertRoutes(collapsed);
});

test('collapsing both groups merges parallel relationships independently in each direction', () => {
  const model = parseStrata(`app first "First" {
 service a "A"
 service b "B"
}
app second "Second" {
 service c "C"
 service d "D"
}
a -> c : "one"
a -> d : "two"
b -> c : "three"
c -> a : "four"
d -> a : "five"
d -> b : "six"`);
  const diagram = new DiagramLayout(model);
  const collapsed = diagram.create('all',new Set(['first','second']));
  assert.equal(collapsed.edges.length,2);
  assert.deepEqual(collapsed.edges.map(e => [e.from.resource.id,e.to.resource.id,e.relationships.length]),[
    ['first','second',3],['second','first',3]
  ]);
  assert.ok(collapsed.edges.every(e => e.label === '3 relationships'));
  assert.ok(collapsed.edges.every(e => e.points.length === 2));
  assert.ok(collapsed.edges.every(e => e.points[0].y === e.points[1].y));
  assert.notEqual(collapsed.edges[0].points[0].y,collapsed.edges[1].points[0].y);
  assert.equal(diagram.create('all').edges.length,6);
  assertRoutes(collapsed);
});

test('each side of a collapsed item has at most one incoming and one outgoing branched trunk', () => {
  const node = (id,x,y,collapsed=false) => ({resource:{id},x,y,w:240,h:120,container:collapsed,collapsed});
  const group = node('group',500,200,true);
  const neighbors = [node('leftA',50,50),node('leftB',50,400),node('rightA',950,50),node('rightB',950,400)];
  const edges = neighbors.flatMap(other => [{from:other,to:group,label:''},{from:group,to:other,label:''}]);
  const routed = new OrthogonalRouter([group,...neighbors]).route(edges);
  for (const side of ['left','right']) {
    const branches = routed.filter(e => (e.from === group ? e.to.x : e.from.x) < group.x === (side === 'left'));
    const incoming = branches.filter(e => e.to === group), outgoing = branches.filter(e => e.from === group);
    assert.equal(incoming.length,2);
    assert.equal(outgoing.length,2);
    const end = incoming[0].points.at(-1), start = outgoing[0].points[0];
    assert.deepEqual(end,incoming[1].points.at(-1));
    assert.deepEqual(start,outgoing[1].points[0]);
    assert.equal(end.x,side === 'left' ? group.x : group.x+group.w);
    assert.equal(start.x,end.x);
    assert.notEqual(start.y,end.y);
    assert.ok(shared(...incoming[0].points.slice(-2),...incoming[1].points.slice(-2)) > 0);
    assert.ok(shared(...outgoing[0].points.slice(0,2),...outgoing[1].points.slice(0,2)) > 0);
  }
  assertRoutes({nodes:[group,...neighbors],edges:routed,width:1400,height:700});
});

test('aligned collapsed cards use two straight lines even with different heights', () => {
  const from = {resource:{id:'from'},x:50,y:50,w:240,h:96,container:true,collapsed:true};
  const to = {resource:{id:'to'},x:450,y:50,w:240,h:180,container:true,collapsed:true};
  const edges = new OrthogonalRouter([from,to]).route([{from,to,label:'out'},{from:to,to:from,label:'in'}]);
  assert.deepEqual(edges.map(e => e.points),[
    [{x:290,y:82},{x:450,y:82}],
    [{x:450,y:114},{x:290,y:114}]
  ]);
  assertRoutes({nodes:[from,to],edges,width:800,height:300});
});

test('expanded tiles with overlapping vertical spans use a straight connection',()=>{
 const from={resource:{id:'a'},x:50,y:50,w:240,h:400,container:false,collapsed:false};
 const to={resource:{id:'b'},x:500,y:200,w:240,h:120,container:false,collapsed:false};
 const edges=new OrthogonalRouter([from,to]).route([{from,to,label:'request'}]);
 assert.equal(edges[0].points.length,2);
 assert.equal(edges[0].points[0].y,edges[0].points[1].y);
 assertRoutes({nodes:[from,to],edges,width:800,height:500});
});

test('offset tiles use diagonal connectors without entering tile interiors',()=>{
 const from={resource:{id:'a'},x:50,y:50,w:200,h:100};
 const to={resource:{id:'b'},x:500,y:300,w:200,h:100};
 const edges=new OrthogonalRouter([from,to]).route([{from,to,label:'Calls'}]);
 assert.ok(segments(edges[0]).some(([a,b])=>a.x!==b.x && a.y!==b.y));
 assertRoutes({nodes:[from,to],edges,width:800,height:500});
});

test('tight obstacle detours use full diagonal runs without extra corner segments',()=>{
 const obstacle={resource:{id:'obstacle'},x:100,y:100,w:200,h:200};
 const router=new OrthogonalRouter([obstacle]);
 const points=router.slantRoute([{x:0,y:150},{x:80,y:150},{x:80,y:80},{x:320,y:80},{x:320,y:150},{x:400,y:150}]);
 assert.equal(points.length,6,'Slant whole runs without adding bevel points');
 for (let i=1;i<points.length-1;i++) {
   const a=points[i-1],b=points[i],c=points[i+1];
   assert.notEqual((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y),0,'No right-angle bends remain');
 }
 for (let i=1;i<points.length;i++) {
   assert.equal(segmentIntersectsRect(points[i-1],points[i],obstacle),false);
 }
 assert.deepEqual(points[0],{x:0,y:150});
 assert.deepEqual(points.at(-1),{x:400,y:150});
});

test('equal return runs become slanted rather than shifting vertically',()=>{
 const points=new OrthogonalRouter([]).slantRoute([{x:0,y:0},{x:100,y:0},{x:100,y:200},{x:0,y:200}]);
 assert.equal(points.length,4);
 assert.notEqual(points[1].x,points[2].x);
 assert.equal(points[1].y,0);
 assert.equal(points[2].y,200);
});

test('diagonal routes leave visible clearance around nearby blocks',()=>{
 const node={resource:{id:'block'},x:100,y:100,w:200,h:200};
 const points=new OrthogonalRouter([node]).slantRoute([{x:0,y:150},{x:76,y:150},{x:76,y:76},{x:324,y:76},{x:324,y:150},{x:400,y:150}]);
 const padded={x:88,y:88,w:224,h:224};
 for(let i=1;i<points.length;i++) {
   assert.equal(segmentIntersectsRect(points[i-1],points[i],padded),false);
 }
});
