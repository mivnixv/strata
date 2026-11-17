import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { DiagramLayout, StrataDiagram, validateModel } from '../../framework.js';
import { ItemTypes, TYPE_LIMIT } from './types.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const source=`type queue {
 color: "#e6b86a"
 background: "#112233"
 icon: "svgs/solid/server.svg"
 line: dashed
 large-icon: false
 subheader: "Async work"
}
group backend "Backend" {
 queue jobs "Jobs"
 queue events "Events" {
  color: "#aabbcc"
  line: solid
  large-icon: true
  icon: null
  subheader: ""
 }
}
jobs -> events "Publish"`;

test('custom types and explicit overrides round-trip without materializing defaults',()=>{
  const model=parseStrata(source), canonical=formatStrata(model);
  assert.deepEqual(parseStrata(canonical),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.equal(Object.hasOwn(model.resources[1],'icon'),false);
  assert.equal(model.resources[2].icon,null);
  const changed=parseStrata(canonical.replace('#e6b86a','#123456'));
  const nodes=new DiagramLayout(changed).create('all').nodes;
  assert.equal(nodes.find(node=>node.resource.id==='jobs').resource.color,'#123456');
  assert.equal(nodes.find(node=>node.resource.id==='events').resource.color,'#aabbcc');
  const jobs=nodes.find(node=>node.resource.id==='jobs').resource;
  assert.equal(jobs.dashed,true);
  assert.equal(jobs.noLargeIcon,true);
  assert.equal(jobs.icon,'svgs/solid/server.svg');
  const events=nodes.find(node=>node.resource.id==='events').resource;
  assert.equal(events.dashed,false);
  assert.equal(events.noLargeIcon,false);
  assert.equal(events.subheader,'');
  assert.equal(events.icon,null);
});

test('types support forward declarations, empty definitions, nesting, and built-in defaults',()=>{
  const model=parseStrata("worker a \"A\" {\n worker b \"B\"\n}\ntype worker {\n}\ntype service {\n line: dashed\n}\nservice api \"API\"");
  const layout=new DiagramLayout(model).create('all',new Set(['a']));
  assert.equal(layout.nodes.find(node=>node.resource.id==='a').collapsed,true);
  assert.equal(layout.nodes.find(node=>node.resource.id==='api').resource.dashed,true);
  const palette=new ItemTypes(model.types).palette({service:'#123456'},'#abcdef');
  assert.equal(palette.worker,'#abcdef');
  assert.equal(palette.service,'#123456');
  const missingType=validateModel({...model,resources:[{id:'x',name:'X'}],perspectives:[{id:'all',name:'All'}]});
  assert.equal(new ItemTypes(missingType.types).resolve(missingType.resources[0]).dashed,true);
});

test('rejects undefined, duplicate, reserved and over-budget types and invalid styles',()=>{
  for (const invalid of [
    'unknown a "A"',
    'type worker {\n}\ntype worker {\n}',
    'type view {\n}',
    'type __proto__ {\n}',
    "type worker {\n color: \"red\"\n}",
    "type worker {\n background: \"#abc\"\n}",
    "type worker {\n icon: \"../bad.svg\"\n}",
    "type worker {\n line: maybe\n}",
    "type worker {\n description: \"Not a style\"\n}",
    "type worker {\n color: \"#123456\"\n color: \"#123456\"\n}",
    'group g "G" {\n type worker {\n}\n}',
    Array.from({length:TYPE_LIMIT+1},(_,i)=>`type t${i} {\n}`).join('\n')
  ]) { assert.throws(()=>parseStrata(invalid)); }
  assert.equal(new ItemTypes(Array.from({length:TYPE_LIMIT},(_,i)=>({name:`t${i}`}))).definitions.length,TYPE_LIMIT);
  for (const types of [null,{},[{name:'worker',dashed:'false'}],[{name:'worker',unknown:true}]]) {
    assert.throws(()=>validateModel({...parseStrata(''),types}));
  }
});

class Element {
  constructor(tag) { this.tag=tag; this.attrs={}; this.children=[]; }
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

test('SVG applies inherited fills, borders, flags, icons, and connection endpoint colors',t=>{
  const previous=globalThis.document;
  globalThis.document={
    createElementNS:(_,tag)=>new Element(tag),
    createElement:()=>({getContext:()=>({measureText:text=>({width:text.length*8})})})
  };
  t.after(()=>{

    if (previous===undefined) { delete globalThis.document; }
    else { globalThis.document=previous; }

  });
  const renderer=new StrataDiagram(new Element('root'),{motion:{transition() {}},resolveIcon:id=>'icons/'+id});
  renderer.iconTint={apply() {}};
  renderer.render(parseStrata(source),{selected:'jobs'});
  const groups=renderer.svg.querySelectorAll('g');
  const jobs=groups.find(group=>group.attrs['data-resource']==='jobs');
  const events=groups.find(group=>group.attrs['data-resource']==='events');
  assert.equal(jobs.children[0].attrs.fill,'#112233');
  assert.equal(jobs.children[0].attrs.stroke,'#e6b86a');
  assert.equal(jobs.children[0].attrs['stroke-dasharray'],'8 6');
  assert.equal(events.children[0].attrs['stroke-dasharray'],undefined);
  assert.equal(jobs.querySelectorAll('image')[0].attrs.href,'icons/svgs/solid/server.svg');
  const stops=renderer.svg.querySelectorAll('stop').map(stop=>stop.attrs['stop-color']);
  assert.ok(stops.includes('#e6b86a'));
  assert.ok(stops.includes('#aabbcc'));
  renderer.render(parseStrata(source));
  const normalJobs=renderer.svg.querySelectorAll('g').find(group=>group.attrs['data-resource']==='jobs');
  assert.equal(normalJobs.children[0].attrs.stroke,'#e6b86a66');
  const normalGradient=renderer.svg.querySelectorAll('linearGradient').find(gradient=>gradient.attrs.id.endsWith('-connection-0'));
  assert.deepEqual(normalGradient.children.map(stop=>stop.attrs['stop-color']),['#b8c8e1','#b8c8e1']);
  const body=renderer.svg.querySelectorAll('g').find(group=>Object.hasOwn(group.attrs,'data-connection-body'));
  assert.equal(body.children[1].attrs.stroke,`url(#${normalGradient.attrs.id})`);
  const arrow=renderer.svg.querySelectorAll('marker').find(marker=>marker.attrs.id.endsWith('-symbol-end'));
  assert.equal(arrow.children[0].attrs.fill,'#b8c8e1');
});

test('color is the only item accent and connection color property',()=>{
  for (const declaration of ['service api "API" { border-color: "#aabbcc" }','type worker { border-color: "#aabbcc" }']) {
    assert.throws(()=>parseStrata(declaration),/unknown .* property: border-color/);
  }
  assert.throws(()=>new ItemTypes([{name:'worker',borderColor:'#aabbcc'}]),/Unknown style/);
});

test('offline bundles embed inherited icons and execute custom type resolution',async()=>{
  const html=await new StandaloneBuilder().build(source);
  const bootstrap=JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.match(bootstrap.icons['svgs/solid/server.svg'],/^data:image\/svg\+xml;base64,/);
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Script(script));
  const library=script.slice(0,script.indexOf('const bootstrapElement'));
  const color=runInNewContext(`${library}\nreturn new DiagramLayout(parseStrata(${JSON.stringify(source)})).create('all').nodes.find(node=>node.resource.id==='jobs').resource.color;\n})();`,{TextEncoder});
  assert.equal(color,'#e6b86a');
});
