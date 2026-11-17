import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { DiagramLayout, validateModel } from '../../framework.js';
import { themes, applyTheme } from '../../themes/themes.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const source=`group backend "Backend" {
 group services "Services" {
  service api "API"
 }
 database db "Database"
}
group empty "Empty"
backend -> empty : "Context"
api -> db : "SQL"
view all "All" {
 include backend, empty
}`;

test('group declarations round-trip through text and JSON, including empty groups',()=>{
  const model=parseStrata(source);
  assert.equal(model.resources[0].type,'group');
  assert.equal(model.resources[1].parent,'backend');
  assert.equal(model.resources.at(-1).type,'group');
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
});

test('groups use existing nesting, visibility, collapse, and connection behavior',()=>{
  const layout=new DiagramLayout(parseStrata(source));
  const expanded=layout.create('all');
  const backend=expanded.nodes.find(node=>node.resource.id==='backend');
  const services=expanded.nodes.find(node=>node.resource.id==='services');
  assert.equal(backend.container,true);
  assert.ok(services.x>backend.x && services.x+services.w<backend.x+backend.w);
  assert.equal(expanded.nodes.find(node=>node.resource.id==='empty').container,false);
  const collapsed=layout.create('all',new Set(['backend']));
  assert.deepEqual(collapsed.nodes.map(node=>node.resource.id).sort(),['backend','empty']);
  assert.equal(collapsed.nodes.find(node=>node.resource.id==='backend').collapsed,true);
  assert.equal(collapsed.edges.length,1);
  assert.equal(collapsed.edges[0].from.resource.id,'backend');
});

test('every theme supplies a neutral group color for rendering and UI',()=>{
  for (const theme of themes) {
    const properties={};
    applyTheme({style:{setProperty:(key,value)=>properties[key]=value},dataset:{}},theme.id);
    assert.equal(theme.palette.group,theme.muted);
    assert.equal(properties['--type-group'],theme.palette.group);
  }
});

test('offline bundles execute group parsing and layout without module dependencies',async()=>{
  const html=await new StandaloneBuilder().build(source);
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Script(script));
  const library=script.slice(0,script.indexOf('const bootstrapElement'));
  assert.ok(library.length<script.length);
  const count=runInNewContext(`${library}\nreturn new DiagramLayout(parseStrata(${JSON.stringify(source)})).create('all').nodes.length;\n})();`,{TextEncoder});
  assert.equal(count,5);
});
