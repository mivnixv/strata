import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { validateModel, DiagramLayout, relationsForPerspective, StrataDiagram } from '../../framework.js';
import { ENDPOINT_TYPES, endpointOptions } from './options.js';
import { ConnectionMarkers } from './markers.js';
import { ConnectionEndLabels } from './labels.js';
import { segmentIntersectsRect } from '../../routing.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const resources='service a "A"\nservice b "B"\n';
const source=resources+"a -> b \"Request\" {\n  line: dashed\n  start {\n    shape: dot\n    label: \"Caller\"\n  }\n  end {\n    shape: circle\n    label: \"Store\"\n  }\n  note 1 \"Details\"\n}";

test('all start/end types and labels round-trip through source and JSON in both scopes',()=>{
  for (const start of ENDPOINT_TYPES) {
    for (const end of ENDPOINT_TYPES) {
      const declaration=`a -> b "Main" { line: dashed; start { shape: ${start}; label: "Sender" } end { shape: ${end}; label: "Receiver" } }`;
      const model=parseStrata(resources+declaration+'\nview v "V" {\n '+declaration+'\n}');
      assert.deepEqual(parseStrata(formatStrata(model)),model);
      assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
      assert.equal(model.relations[0].startType,start);
      assert.equal(model.perspectives[0].relations[0].endType,end);
    }
  }
  const noted=parseStrata(source);
  assert.equal(noted.relations[0].notes.length,1);
  assert.deepEqual(parseStrata(formatStrata(noted)),noted);
  const labelsOnly=parseStrata(resources+"a -> b {\n  start {\n    label: \"Sender\"\n  }\n  end {\n    label: \"Receiver\"\n  }\n}");
  assert.equal(labelsOnly.relations[0].startType,'none');
  assert.equal(labelsOnly.relations[0].endType,'arrow');
  assert.equal(labelsOnly.relations[0].endLabel,'Receiver');
  assert.deepEqual(endpointOptions({}),{startType:'none',endType:'arrow',startLabel:'',endLabel:''});
});

test('endpoint declarations reject duplicate clauses, invalid types, and malformed labels',()=>{
  for (const suffix of ['start {} start {}','end { shape: triangle }','start { shape: dot; shape: circle }','end { label: 2 }','start { label: "A"; label: "B" }']) {
    assert.throws(()=>parseStrata(resources+'a -> b { '+suffix+' }'),/Line 3/);
  }
  for (const key of ['startType','endType','startLabel','endLabel']) {
    const invalid=key.endsWith('Type') ? [null,{},1,'triangle'] : [null,{},1,'x'.repeat(501)];
    for (const value of invalid) {
      const model=parseStrata(resources+'view v "V" {\n a -> b\n}');
      model.perspectives[0].relations[0][key]=value;
      assert.throws(()=>validateModel(model),new RegExp(key));
    }
  }
  assert.doesNotThrow(()=>endpointOptions({startLabel:'x'.repeat(500)}));
});

test('deduplication and collapsed bundles preserve different terminal meanings',()=>{
  const model=parseStrata(`group g "G" {
 service a "A"
 service c "C"
}
service b "B"
a -> b {
  start {
    shape: dot
    label: "Sender"
  }
  end {
    shape: circle
    label: "Receiver"
  }
}
c -> b {
  start {
    shape: dot
    label: "Sender"
  }
  end {
    shape: circle
    label: "Receiver"
  }
}
a -> b {
  start {
    shape: square
    label: "Sender"
  }
  end {
    shape: circle
    label: "Receiver"
  }
}
a -> b {
  start {
    shape: dot
    label: "Other"
  }
  end {
    shape: circle
    label: "Receiver"
  }
}
view v "V" {
 include: [g, b]
 a -> b {
   start {
     shape: dot
     label: "Sender"
   }
   end {
     shape: circle
     label: "Receiver"
   }
 }
}`);
  assert.equal(relationsForPerspective(model,model.perspectives[0]).length,4);
  const layout=new DiagramLayout(model).create('v',new Set(['g']));
  assert.equal(layout.edges.length,3);
  assert.equal(layout.edges.find(edge=>edge.startType==='dot' && edge.startLabel==='Sender').relationships.length,2);
});

class Element {
  constructor(tag,attrs={},text) { this.tag=tag; this.attrs=attrs; this.children=[]; this.textContent=text; }
  setAttribute(key,value) { this.attrs[key]=value; }
  getAttribute(key) { return this.attrs[key] ?? null; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  addEventListener() {}
  querySelectorAll(selector) {
    const result=[], queue=[...this.children];
    for (let i=0;i<queue.length;i++) {
      const element=queue[i]; queue.push(...element.children);

      if (selector===element.tag) { result.push(element); }

    }
    return result;
  }
}
const element=(tag,attrs,text)=>new Element(tag,attrs,text);

test('markers use filled dots, hollow circles, arrows, asterisks, squares, and no symbol',()=>{
  const markers=new ConnectionMarkers(element), defs=element('defs');
  for (const type of ENDPOINT_TYPES) {
    const result=markers.create(defs,type,type,'#abcdef','#123456');

    if (type==='none') { assert.equal(result,undefined); continue; }

    assert.equal(result,`url(#${type})`);
    const marker=defs.children.at(-1);
    assert.equal(marker.attrs.orient,'auto-start-reverse');
    assert.equal(marker.attrs.markerUnits,'userSpaceOnUse');
  }
  assert.equal(defs.children.find(marker=>marker.attrs.id==='dot').children[0].attrs.fill,'#abcdef');
  assert.equal(defs.children.find(marker=>marker.attrs.id==='circle').children[0].attrs.fill,'#123456');
  assert.equal(defs.children.find(marker=>marker.attrs.id==='square').children[0].tag,'rect');
  assert.deepEqual(markers.attributes(defs,'none',{startType:'none',endType:'none'},'#aaa','#bbb','#ccc'),{});
});

test('endpoint label geometry handles both directions, bends, short and zero-length routes',()=>{
  const labels=new ConnectionEndLabels();
  for (const points of [
    [{x:100,y:100},{x:400,y:100}],
    [{x:400,y:100},{x:100,y:100}],
    [{x:100,y:100},{x:100,y:400}],
    [{x:100,y:400},{x:100,y:100}],
    [{x:100,y:100},{x:200,y:200},{x:300,y:200}],
    [{x:100,y:100},{x:100,y:100},{x:120,y:100}]
  ]) {
    const edge={points,startLabel:'Sender',endLabel:'Receiver'}, occupied=[];
    labels.place([edge],[],occupied,segmentIntersectsRect);
    assert.ok(edge.startLabelPosition);
    assert.ok(edge.endLabelPosition);
    for (const p of [edge.startLabelPosition,edge.endLabelPosition]) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.width>0);
    }
  }
  const zero={points:[{x:100,y:100},{x:100,y:100}],startLabel:'Sender'};
  assert.doesNotThrow(()=>labels.place([zero],[],[],segmentIntersectsRect));
  assert.equal(zero.startLabelPosition,undefined);
});

test('parallel connections reserve space for endpoint and middle labels without hitting cards',()=>{
  const model=parseStrata(resources+"a -> b \"Request\" {\n  start {\n    shape: dot\n    label: \"Caller\"\n  }\n  end {\n    shape: circle\n    label: \"Store\"\n  }\n}\na -> b {\n  start {\n    shape: arrow\n    label: \"Send\"\n  }\n  end {\n    shape: asterisk\n    label: \"Many\"\n  }\n}\na -> b {\n  start {\n    shape: square\n    label: \"Source\"\n  }\n  end {\n    shape: none\n    label: \"Sink\"\n  }\n}");
  const layout=new DiagramLayout(model).create('all');
  assert.ok(layout.edges[0].labelPosition);
  for (const edge of layout.edges) {
    for (const key of ['startLabelPosition','endLabelPosition']) {
      const position=edge[key];
      assert.ok(position);
      const box={x:position.x-position.width/2,y:position.y-16,w:position.width,h:24};
      assert.ok(box.x>=0 && box.y>=0 && box.x+box.w<=layout.width && box.y+box.h<=layout.height);
      assert.equal(layout.nodes.some(node=>box.x<node.x+node.w && box.x+box.w>node.x && box.y<node.y+node.h && box.y+box.h>node.y),false);
    }
  }
});

test('SVG renders selected and faded terminal symbols; label visibility follows the toolbar',t=>{
  const previous=globalThis.document;
  globalThis.document={createElementNS:(_,tag)=>element(tag),createElement:()=>({getContext:()=>({measureText:text=>({width:text.length*8})})})};
  t.after(()=>{

    if (previous===undefined) { delete globalThis.document; }
    else { globalThis.document=previous; }

  });
  const model=parseStrata(resources+"a -> b {\n  start {\n    shape: dot\n    label: \"<Sender>\"\n  }\n  end {\n    shape: circle\n    label: \"Receiver\"\n  }\n}");
  const renderer=new StrataDiagram(element('root'),{motion:{transition() {}}});
  const layout=renderer.render(model,{selected:'a'});
  assert.ok(layout.edges[0].startLabelPosition);
  assert.ok(layout.edges[0].endLabelPosition);
  const markers=renderer.svg.querySelectorAll('marker');
  assert.equal(markers.length,4);
  assert.equal(markers[0].children[0].attrs.fill,'#7cb8fa');
  assert.equal(markers[1].children[0].attrs.fill,'#0b1019');
  const labels=renderer.svg.querySelectorAll('text').filter(text=>text.attrs['data-end-label']);
  assert.equal(labels.length,2);
  assert.ok(labels[0].textContent.startsWith('<'));
  assert.deepEqual(labels.map(label=>label.children[0].textContent),['<Sender>','Receiver']);
  const paths=renderer.svg.querySelectorAll('path');
  assert.ok(paths.some(path=>path.attrs['marker-start'] && path.attrs['marker-end']));
  assert.ok(paths.some(path=>path.attrs['data-endpoint']==='start' && path.attrs['marker-start']));
  renderer.render(model,{showLabels:false});
  assert.equal(renderer.svg.querySelectorAll('text').filter(text=>text.attrs['data-end-label']).length,0);
  renderer.render(parseStrata(resources+"a -> b {\n  end {\n    shape: none\n  }\n}"));
  assert.equal(renderer.svg.querySelectorAll('marker').length,0);
});

test('offline bundles preserve endpoint options and execute their parsing and layout',async()=>{
  const html=await new StandaloneBuilder().build(source);
  const saved=JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(parseStrata(saved.source).relations[0].endLabel,'Store');
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Script(script));
  const library=script.slice(0,script.indexOf('const bootstrapElement'));
  const type=runInNewContext(`${library}\nreturn new DiagramLayout(parseStrata(${JSON.stringify(source)})).create('all').edges[0].startType;\n})();`,{TextEncoder});
  assert.equal(type,'dot');
});
