import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrata, formatStrata } from '../../language.js';
import { DiagramLayout, validateModel } from '../../framework.js';
import { containerStroke } from './style.js';

test('dashed resource borders survive source, JSON, and collapsed layouts',()=>{
  const model=parseStrata('service group "Group" {\n dashed\n service child "Child"\n}');
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.equal(new DiagramLayout(model).create('all',new Set(['group'])).nodes[0].resource.dashed,true);
  assert.deepEqual(containerStroke(model.resources[0]),{'stroke-dasharray':'8 6'});
  assert.deepEqual(containerStroke(model.resources[1]),{});
  for (const dashed of [null,1,'true',{}]) {
    const invalid=structuredClone(model); invalid.resources[0].dashed=dashed;
    assert.throws(()=>validateModel(invalid),/dashed.*boolean/);
  }
  assert.throws(()=>parseStrata('dashed'));
});
