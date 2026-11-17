import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../language.js';
import { DiagramLayout, validateModel } from '../framework.js';
import { noteSelectionFocus } from './selection.js';
import { StandaloneBuilder } from '../../cli/standalone-builder.mjs';

const source=`note 1 "Global context"
note 8 "Global database note" {
  on: db
}
service parent "Parent" {
 service api "API" {
  note 2 "Global item note"
 }
}
database db "Database"
api -> db "SQL" {
  note 3 "Global connection note"
}
view checkout "Checkout" {
 include: [api, db]
 note 4 "Checkout item note" {
   on: api
   position: right
   connector {
     label: "Checkout"
     line: dashed
   }
 }
 note 5 "Checkout context"
 api -> db "SQL" {
   note 6 "Checkout connection note"
 }
}
view other "Other" {
 include: [api, db]
}
view scoped "Scoped" {
 note 7 "Only this view's item" {
   on: api
 }
}
view data "Data" {
 include: [db]
}`;
const numbers=layout=>layout.notes.map(entry=>entry.note.number);

test('view-specific item, standalone and connection notes preserve applicable global notes',()=>{
  const model=parseStrata(source), layout=new DiagramLayout(model), before=JSON.stringify(model);
  assert.deepEqual(numbers(layout.create('checkout')),[1,2,3,4,5,6,8]);
  assert.deepEqual(numbers(layout.create('other')),[1,2,3,8]);
  assert.deepEqual(numbers(layout.create('data')),[1,8]);
  assert.equal(layout.create('checkout').edges.length,1);
  assert.equal(JSON.stringify(model),before);
  const entry=layout.create('checkout').notes.find(entry=>entry.note.number===4);
  assert.equal(entry.target.kind,'item');
  assert.equal(entry.target.resourceId,'api');
});

test('view item notes infer their target and ancestors without unrelated siblings',()=>{
  const layout=new DiagramLayout(parseStrata(source)).create('scoped');
  assert.deepEqual(layout.nodes.map(node=>node.resource.id).sort(),['api','parent']);
  assert.deepEqual(numbers(layout),[1,2,7]);
});

test('view item attachments follow collapsed owners, positioning and note focus',()=>{
  const model=parseStrata(source), layout=new DiagramLayout(model).create('checkout',new Set(['parent']));
  const note=layout.notes.find(entry=>entry.note.number===4);
  const parent=layout.nodes.find(node=>node.resource.id==='parent');
  assert.equal(note.target.nodeId,'parent');
  assert.ok(note.anchor.x>parent.x+parent.w);
  assert.deepEqual([...noteSelectionFocus(note,model.resources,12).nodes],['parent']);
  assert.deepEqual(numbers(layout),[1,2,3,4,5,6,8]);
});

test('scoped item note options round-trip in any order through source and JSON',()=>{
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  const reordered=parseStrata("service api \"API\"\nview a \"A\" {\n note 1 \"Note\" {\n   on: api\n   position: bottom\n   font-size: 18\n   connector {}\n }\n}");
  assert.equal(reordered.perspectives[0].notes[0].resource,'api');
  assert.equal(reordered.perspectives[0].notes[0].position,'bottom');
});

test('invalid or ambiguous item attachments and duplicate numbers are rejected',()=>{
  for (const declaration of ['note 1 "Note" on',"note 1 \"Note\" {\n  on: missing\n}",'note 1 "Note" on api on api',"service api \"API\" {\n note 1 \"Note\" {\n   on: api\n }\n}","service api \"API\"\nservice db \"DB\"\napi -> db {\n  note 1 \"Note\" {\n    on: api\n  }\n}"]) {
    assert.throws(()=>parseStrata(declaration));
  }
  assert.throws(()=>parseStrata(source+"\nview duplicate \"Duplicate\" {\n note 4 \"Duplicate\" {\n   on: db\n }\n}"),/Duplicate note/);
  const model=parseStrata(source);
  for (const resource of [42,{},'missing']) {
    const invalid=structuredClone(model); invalid.perspectives[0].notes[0].resource=resource;
    assert.throws(()=>validateModel(invalid),/existing resource/);
  }
});

test('offline HTML includes executable view-specific attachments without losing global notes',async()=>{
  const html=await new StandaloneBuilder().build(source);
  const bootstrap=JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const layout=new DiagramLayout(parseStrata(bootstrap.source));
  assert.deepEqual(numbers(layout.create('checkout')),[1,2,3,4,5,6,8]);
  assert.deepEqual(numbers(layout.create('other')),[1,2,3,8]);
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
