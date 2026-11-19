import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { ConnectionPorts } from './ports.js';
import { OrthogonalRouter, segmentIntersectsRect } from '../../routing.js';
import { connectionEndpoint } from '../endpoints/geometry.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const card=(id,x,y,w=240,h=120)=>({resource:{id},x,y,w,h});
const relation=(from,to,label='')=>({from,to,label});
function assertClear(nodes,edges) {
  const ports=new ConnectionPorts();
  for (const edge of edges) {
    for (const [point,node] of [[edge.points[0],edge.from],[edge.points.at(-1),edge.to]]) {
      const rect=ports.bounds(node);
      assert.ok((point.x===rect.x || point.x===rect.x+rect.w) && point.y>=rect.y && point.y<=rect.y+rect.h ||
        (point.y===rect.y || point.y===rect.y+rect.h) && point.x>=rect.x && point.x<=rect.x+rect.w);
    }
    for (let i=1;i<edge.points.length;i++) {
      for (const node of nodes) {
        assert.equal(segmentIntersectsRect(edge.points[i-1],edge.points[i],ports.bounds(node)),false);
      }
    }
  }
}

test('stacked cards use straight downward and upward connections',()=>{
  const upper=card('upper',100,100),lower=card('lower',100,400);
  for (const [from,to] of [[upper,lower],[lower,upper]]) {
    const [edge]=new OrthogonalRouter([upper,lower]).route([relation(from,to)]);
    assert.equal(edge.points.length,2);
    assert.equal(edge.points[0].x,220);
    assert.equal(edge.points[1].x,220);
    assert.deepEqual(edge.points.map(point=>point.y),from===upper ? [220,400] : [400,220]);
    assertClear([upper,lower],[edge]);
  }
});

test('overlapping horizontal spans align vertical ports while side-by-side cards keep horizontal ports',()=>{
  const upper=card('upper',100,100,400),lower=card('lower',300,400);
  const [edge]=new OrthogonalRouter([upper,lower]).route([relation(upper,lower)]);
  assert.equal(edge.points.length,2);
  assert.equal(edge.points[0].x,edge.points[1].x);
  assert.ok(edge.points[0].x>lower.x && edge.points[0].x<upper.x+upper.w);
  const right=card('right',700,100);
  assert.deepEqual(new ConnectionPorts().sides(relation(upper,right)),['right','left']);
  assertClear([upper,lower],[edge]);
});

test('parallel, bidirectional, fan-in and fan-out connections reserve distinct vertical ports',()=>{
  const upper=card('upper',100,100,480),lower=card('lower',100,500,480);
  const edges=new OrthogonalRouter([upper,lower]).route([
    relation(upper,lower,'first'),relation(upper,lower,'second'),relation(lower,upper,'return')
  ]);
  const ports=edges.map(edge=>edge.from===upper ? edge.points[0].x : edge.points.at(-1).x);
  assert.equal(new Set(ports).size,3);
  assert.ok(edges.every(edge=>edge.points.length===2));
  assertClear([upper,lower],edges);
  const left=card('left',100,500,160),right=card('right',420,500,160);
  const assignments=new ConnectionPorts().assign([relation(upper,right),relation(upper,left),relation(right,upper),relation(left,upper)]);
  assert.ok(assignments[1].start.x<assignments[0].start.x);
  assert.ok(assignments[3].end.x<assignments[2].end.x);
  assertClear([upper,left,right],new OrthogonalRouter([upper,left,right]).route(assignments.map(pair=>pair.edge)));
});

test('vertical routes detour around intervening cards without entering any card',()=>{
  const upper=card('upper',300,100),lower=card('lower',300,700),obstacle=card('obstacle',250,350,340,160);
  const nodes=[upper,lower,obstacle],edges=new OrthogonalRouter(nodes).route([relation(upper,lower)]);
  assert.ok(edges[0].points.length>2);
  assert.equal(edges[0].points[0].y,220);
  assert.equal(edges[0].points.at(-1).y,700);
  assertClear(nodes,edges);
});

test('offset vertical ports use slanted connectors in both directions',()=>{
  const upper={...card('upper',100,100),container:true,collapsed:true};
  const lower={...card('lower',100,500,300),container:true,collapsed:true};
  const nodes=[upper,lower];
  for (const [from,to] of [[upper,lower],[lower,upper]]) {
    const [edge]=new OrthogonalRouter(nodes).route([relation(from,to)]);
    assert.ok(edge.points.slice(1).some((point,index)=>point.x!==edge.points[index].x && point.y!==edge.points[index].y));
    assert.equal(edge.points[0].x,edge.points[1].x,'Source segment remains vertical');
    assert.equal(edge.points.at(-1).x,edge.points.at(-2).x,'Destination segment remains vertical');
    assertClear(nodes,[edge]);
  }
});

test('vertical return detours slant without cutting obstacle clearance',()=>{
  const obstacle=card('obstacle',100,100,100,100),router=new OrthogonalRouter([obstacle]);
  const path=[{x:50,y:250},{x:50,y:224},{x:250,y:224},{x:250,y:250}];
  const points=router.slantRoute(path);
  assert.notEqual(points[1].y,points[2].y,'Equal return arms still create a diagonal');
  const padded={x:88,y:88,w:124,h:124};
  for (let index=1;index<points.length;index++) {
    assert.equal(segmentIntersectsRect(points[index-1],points[index],padded),false);
  }
});

test('peer items use slanted vertical routes when an obstacle prevents port alignment',()=>{
  const upper=card('upper',100,100,400),lower=card('lower',300,600,400);
  const obstacle=card('obstacle',380,330,40,80),nodes=[upper,lower,obstacle];
  for (const [from,to] of [[upper,lower],[lower,upper]]) {
    const [edge]=new OrthogonalRouter(nodes).route([relation(from,to)]);
    assert.equal(edge.points[0].y,from===upper ? upper.y+upper.h : lower.y);
    assert.equal(edge.points.at(-1).y,to===lower ? lower.y : upper.y+upper.h);
    assert.ok(edge.points.slice(1).some((point,index)=>point.x!==edge.points[index].x && point.y!==edge.points[index].y));
    assertClear(nodes,[edge]);
  }
});

test('vertical detours stay orthogonal when a diagonal would clip clearance',()=>{
  const obstacle=card('obstacle',100,100,100,100),above=card('above',100,0,100,76);
  const router=new OrthogonalRouter([obstacle,above]);
  const path=[{x:50,y:50},{x:50,y:88},{x:250,y:88},{x:250,y:250}];
  assert.deepEqual(router.slantRoute(path),path);
});

test('vertical return routes use unequal shifts to clear adjacent peer services',()=>{
  const controller=card('controller',672,216,304,263.27272727272725);
  const migration=card('migration',1136,216,272,232.8);
  const canary=card('canary',672,575.2727272727273,304,220.72727272727275);
  const nodes=[controller,migration,canary],router=new OrthogonalRouter(nodes);
  const path=[{x:824,y:575.2727272727273},{x:824,y:480.8},{x:1548,y:480.8},{x:1548,y:188}];
  const points=router.slantRoute(path);
  assert.notEqual(points[1].y,points[2].y,'Return run becomes diagonal');
  assert.equal(points[0].x,points[1].x);
  assert.equal(points[2].x,points[3].x);
  for (const node of nodes) {
    assert.equal(segmentIntersectsRect(points[1],points[2],{x:node.x-12,y:node.y-12,w:node.w+24,h:node.h+24}),false,node.resource.id);
  }
});

test('collapsed vertical connections separate incoming and outgoing trunks',()=>{
  const upper={...card('upper',100,100),container:true,collapsed:true};
  const lower={...card('lower',100,500),container:true,collapsed:true};
  const nodes=[upper,lower],edges=new OrthogonalRouter(nodes).route([relation(upper,lower),relation(lower,upper)]);
  assert.ok(edges.every(edge=>edge.points.length===2));
  assert.notEqual(edges[0].points[0].x,edges[1].points[0].x);
  assert.equal(edges[0].points[0].y,upper.y+upper.h);
  assert.equal(edges[0].points.at(-1).y,lower.y);
  assertClear(nodes,edges);
});

test('expanded containers attach to the header edge above their children',()=>{
  const parent={...card('parent',100,100,480,600),container:true,collapsed:false};
  const child=card('child',220,300),nodes=[parent,child];
  const [edge]=new OrthogonalRouter(nodes).route([relation(parent,child)]);
  assert.equal(edge.points[0].y,parent.y+44);
  assert.equal(edge.points.at(-1).y,child.y);
  assert.equal(edge.points.length,2);
  assertClear(nodes,[edge]);
});

test('vertical connections place middle and endpoint labels horizontally beside the line',()=>{
  const upper=card('upper',400,100),lower=card('lower',400,700),nodes=[upper,lower];
  const [edge]=new OrthogonalRouter(nodes).route([{...relation(upper,lower,'Publish'),startLabel:'Sender',endLabel:'Receiver'}]);
  for (const key of ['labelPosition','startLabelPosition','endLabelPosition']) {
    const position=edge[key];
    assert.ok(position,key);
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y));
    const box={x:position.x-position.width/2,y:position.y-20,w:position.width,h:28};
    for (const node of nodes) {
      assert.ok(box.x+box.w<=node.x || node.x+node.w<=box.x || box.y+box.h<=node.y || node.y+node.h<=box.y);
    }
  }
  for (const end of [false,true]) {
    const endpoint=connectionEndpoint(edge.points,end);
    assert.equal(endpoint.tip.x,endpoint.inner.x);
    assert.ok(end ? endpoint.inner.y<endpoint.tip.y : endpoint.inner.y>endpoint.tip.y);
  }
});

test('offline bundles execute four-sided routing without external modules',async()=>{
  const html=await new StandaloneBuilder().build('service first "First"\nservice second "Second"\nfirst -> second');
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const core=script.slice(script.indexOf('(() => {')+8,script.indexOf('const $ = id =>'));
  const nodes=[card('upper',100,100),card('lower',100,400)];
  const points=new Script(`(()=>{${core}\nconst nodes=${JSON.stringify(nodes)};return JSON.stringify(new OrthogonalRouter(nodes).route([{from:nodes[0],to:nodes[1],label:'Down'}])[0].points);})()`).runInNewContext();
  assert.deepEqual(JSON.parse(points),[{x:220,y:220},{x:220,y:400}]);
});
