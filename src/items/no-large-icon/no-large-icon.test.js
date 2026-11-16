import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { DiagramLayout, validateModel } from '../../framework.js';
import { tileIconPlacement } from '../../icons/tile-icon.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const source=`service parent "Parent" {
 noLargeIcon
 service api "API" {
  icon "svgs/solid/server.svg"
  noLargeIcon
 }
}
database db "Database"`;

test('noLargeIcon round-trips while preserving the small header icon',()=>{
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.equal(model.resources[0].noLargeIcon,true);
  assert.equal(model.resources[1].noLargeIcon,true);
  assert.equal(model.resources[1].icon,'svgs/solid/server.svg');
  assert.equal(model.resources[2].noLargeIcon,false);
  const onlyOption=parseStrata('service api "API" {\n noLargeIcon\n}');
  assert.deepEqual(parseStrata(formatStrata(onlyOption)),onlyOption);
});

test('noLargeIcon suppresses large leaf and collapsed icons despite available space',()=>{
  const model=parseStrata(source), tile={x:0,y:0,w:300,h:500,container:false,collapsed:false};
  assert.equal(tileIconPlacement({...tile,resource:model.resources[1]}),null);
  assert.ok(tileIconPlacement({...tile,resource:model.resources[2]}));
  const collapsed=new DiagramLayout(model).create('all',new Set(['parent']));
  const parent=collapsed.nodes.find(node=>node.resource.id==='parent');
  assert.equal(tileIconPlacement({...parent,w:300,h:500}),null);
});

test('noLargeIcon rejects non-booleans and declarations outside item blocks',()=>{
  const model=parseStrata(source);
  for (const noLargeIcon of [null,1,'true',{}]) {
    const invalid=structuredClone(model); invalid.resources[0].noLargeIcon=noLargeIcon;
    assert.throws(()=>validateModel(invalid),/noLargeIcon.*boolean/);
  }
  for (const declaration of ['noLargeIcon','view a "A" {\n noLargeIcon\n}','service api "API" {\n noLargeIcon true\n}']) {
    assert.throws(()=>parseStrata(declaration));
  }
});

test('offline HTML preserves noLargeIcon and includes executable icon suppression',async()=>{
  const html=await new StandaloneBuilder().build(source);
  assert.ok(html.includes('node.resource?.noLargeIcon'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
