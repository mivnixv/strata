import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { DiagramLayout, validateModel, relationsForPerspective } from '../../framework.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';
import { connectionStroke, CONNECTION_DASH_PATTERN } from './style.js';

const resources='service api "API"\ndatabase db "DB"\nservice dashed "Dashed ID"\n';

test('labeled and unlabeled dashed connections round-trip globally and within views',()=>{
  const model=parseStrata(resources+'api -> db : "Query" dashed\napi -> dashed\nview main "Main" {\n api -> db dashed\n db -> api : "dashed"\n}');
  assert.equal(model.relations[0].dashed,true);
  assert.equal(model.relations[1].dashed,false);
  assert.equal(model.relations[1].to,'dashed');
  assert.equal(model.perspectives[0].relations[0].dashed,true);
  assert.equal(model.perspectives[0].relations[1].dashed,false);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
});

test('JSON accepts optional booleans and rejects malformed connection styles',()=>{
  const model=parseStrata(resources+'api -> db\nview main "Main" {\n db -> api\n}');
  delete model.relations[0].dashed;
  assert.equal(validateModel(model).relations[0].dashed,false);
  for (const scope of [model.relations,model.perspectives[0].relations]) {
    for (const value of ['true',1,null,{}]) {
      const previous=scope[0].dashed;
      scope[0].dashed=value;
      assert.throws(()=>validateModel(model),/dashed.*boolean/);
      scope[0].dashed=previous;
    }
  }
  for (const suffix of ['dotted','dashed dashed',': dashed','dashed : "Query"']) {
    assert.throws(()=>parseStrata(resources+'api -> db '+suffix));
  }
});

test('solid and dashed relationships stay distinct while same-style duplicates merge',()=>{
  const model=parseStrata(resources+'api -> db : "Query" dashed\nview main "Main" {\n api -> db : "Query" dashed\n api -> db : "Query"\n}');
  const view=model.perspectives[0];
  assert.equal(relationsForPerspective(model,view).length,2);
  const layout=new DiagramLayout(model).create('main');
  assert.deepEqual(layout.edges.map(edge=>edge.dashed).sort(),[false,true]);
});

test('collapsed groups bundle connections separately by stroke style',()=>{
  const model=parseStrata(`service parent "Parent" {
 service one "One"
 service two "Two"
}
service outside "Outside"
one -> outside : "First" dashed
two -> outside : "Second" dashed
one -> outside : "Solid"`);
  const layout=new DiagramLayout(model).create('all',new Set(['parent']));
  assert.equal(layout.edges.length,2);
  assert.equal(layout.edges.find(edge=>edge.dashed).relationships.length,2);
  assert.equal(layout.edges.find(edge=>!edge.dashed).relationships.length,1);
});

test('dashed SVG attributes leave solid connections unchanged',()=>{
  assert.deepEqual(connectionStroke({dashed:false}),{});
  assert.deepEqual(connectionStroke({dashed:true}),{'stroke-dasharray':CONNECTION_DASH_PATTERN});
});

test('offline HTML preserves dashed connections and includes their renderer',async()=>{
  const source=resources+'api -> db : "Async query" dashed';
  const html=await new StandaloneBuilder().build(source);
  const saved=JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(parseStrata(saved.source).relations[0].dashed,true);
  assert.ok(html.includes('stroke-dasharray'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
