import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStrata, formatStrata } from '../language.js';
import { DslParser } from './parser.js';
import { LIMITS } from '../framework.js';

const source=`diagram "Syntax tour"
type queue { color: "#aabbcc"; line: dashed; large-icon: false; icon: "svgs/solid/server.svg" }
type service { subheader: "Worker" }
group backend "Backend" {
  layout { sizes: uniform; compactness: 0.8 }
  queue jobs "Jobs"
  service api "API" {
    subheader: ""
    icon: null
    note 2 "Item" { position: right; font-size: 12.5; connector { line: dashed; label: "Why" } }
  }
  api -> jobs {
    end { label: "Inbox"; shape: circle }
    label: "Publish"
    start { shape: dot; label: "Sender" }
    line: dashed
    note 3 "Connection" { connector {} }
  }
}
note 1 "General # note with {braces}"
view overview "Overview" {
  include: [
    backend,
  ]
  relations: inherit
  detail: 0.5
  layout { compactness: 6e-1 }
  note 4 "View item" { on: api; position: bottom-left; connector {} }
}
view local "Local" { relations: local; include: [] }
`;

test('all scopes share properties and blocks while preserving model semantics',()=>{
  const model=parseStrata(source), formatted=formatStrata(model);
  assert.deepEqual(parseStrata(formatted),model);
  assert.equal(formatStrata(parseStrata(formatted)),formatted);
  assert.equal(model.resources[2].parent,'backend');
  assert.equal(model.resources[2].subheader,'');
  assert.equal(model.resources[2].icon,null);
  assert.equal(model.relations[0].startType,'dot');
  assert.equal(model.relations[0].notes[0].connector.dashed,false);
  assert.equal(model.perspectives[1].inheritGlobalRelations,false);
  assert.deepEqual(model.perspectives[1].resources,[]);
  assert.equal(model.notes[0].text,'General # note with {braces}');
});

test('inline blocks, semicolons, comments, and CRLF are whitespace independent',()=>{
  const inline='service a "A" { subheader: "Unicode ☃"; large-icon: false }; service b "B"; a -> b "Call" { end { shape: none } }';
  assert.deepEqual(parseStrata(inline),parseStrata(inline.replaceAll(';','\r\n')));
  assert.deepEqual(parseStrata(source),parseStrata(source.replaceAll('\n','\r\n')));
  assert.equal(parseStrata('service a "A" # trailing comment').resources[0].name,'A');
});

test('forward type references and property-like type names are unambiguous',()=>{
  const model=parseStrata('color red "Red"\ntype color { color: "#ff0000" }');
  assert.equal(model.resources[0].type,'color');
  assert.deepEqual(parseStrata(formatStrata(model)),model);
});

test('duplicate keys and blocks fail instead of silently overwriting',()=>{
  for (const body of [
    'service a "A" { icon: null; icon: null }',
    'service a "A" { layout {} layout {} }',
    'view v "V" { include: []; include: [] }',
    'note 1 "N" { font-size: 12; font-size: 14 }',
    'note 1 "N" { connector {} connector {} }',
    'type queue { line: solid; line: dashed }',
    'service a "A"; service b "B"; a -> b "" { label: "Again" }',
    'service a "A"; service b "B"; a -> b { start {} start {} }'
  ]) { assert.throws(()=>parseStrata(body),/Line 1, column \d+: duplicate/); }
});

test('wrong scopes, invalid values, and malformed tokens report source locations',()=>{
  for (const body of [
    'color: "#ffffff"', 'type queue { description: "No" }',
    'service a "A" { detail: 0.5 }', 'view v "V" { color: "#ffffff" }',
    'note 1 "N" { on: "a" }', 'service a "A" { note 1 "N" { on: a } }',
    'service a "A" { large-icon: "false" }', 'view v "V" { include: [a b] }',
    'view v "V" { include: ["a"] }', 'view v "V" { detail: 1e999 }',
    'service a "A" { constructor: "unsafe" }', 'service a "A" { layout { size: uniform } }',
    'service a "bad\\q"', 'service a "A" { subheader: "x" color: "#ffffff" }'
  ]) { assert.throws(()=>parseStrata(body),/Line \d+, column \d+:/); }
  assert.throws(()=>parseStrata('\nservice a "A" {\n subheader: 3\n}'),/Line 3, column 13: expected a quoted string/);
});

test('removed syntax is rejected without a legacy parser or aliases',()=>{
  for (const body of [
    'service a "A" { noLargeIcon }', 'service a "A" { dashed }',
    'service a "A" { subheader "Old" }', 'view v "V" { include a, b }',
    'view v "V" { relations only }', 'service a "A"; service b "B"; a -> b : "Old"',
    'note 1 "N" fontSize 12', 'service a "A" { sizes uniform }'
  ]) { assert.throws(()=>parseStrata(body)); }
});

test('parser budgets and an injected validator remain explicit and reusable',()=>{
  const parser=new DslParser();
  assert.deepEqual(parser.parse(''),parser.parse(''));
  assert.throws(()=>parser.parse(' '.repeat(LIMITS.bytes+1)),/1 MB/);
  assert.throws(()=>parser.parse(Array.from({length:LIMITS.resources+1},(_,i)=>`service a${i} "A"`).join('\n')),/maximum 300/);
  assert.throws(()=>parser.parse('group a "A" {\n'.repeat(LIMITS.depth+5)),/nesting/);
  let captured;
  const injected=new DslParser({validate:model=>{captured=model;return model;}});
  assert.equal(injected.parse('diagram "Injected"'),captured);
});

test('all shipped diagrams use canonical grammar and round-trip',async()=>{
  for (const file of ['example.strata','../examples/data-pipeline.strata','../examples/release-delivery.strata','../examples/subscription-lifecycle.strata','../examples/language-tour.strata']) {
    const model=parseStrata(await readFile(new URL('../'+file,import.meta.url),'utf8'));
    assert.deepEqual(parseStrata(formatStrata(model)),model);
  }
});

test('every documented DSL code block parses with the same grammar',async()=>{
  const root=new URL('../../',import.meta.url);
  const parser=new DslParser({validate:model=>model});
  for (const file of [
    'README.md','docs/guide.md','src/dsl/README.md','src/notes/README.md',
    'src/items/types/README.md','src/items/group/README.md','src/items/subheader/README.md',
    'src/items/no-large-icon/README.md','src/connections/endpoints/README.md',
    'src/connections/dashed/README.md','src/containers/dashed/README.md'
  ]) {
    const markdown=await readFile(new URL(file,root),'utf8');
    for (const match of markdown.matchAll(/```text\n([\s\S]*?)```/g)) {
      assert.doesNotThrow(()=>parser.parse(match[1]),file);
    }
  }
  const html=await readFile(new URL('src/index.html',root),'utf8');
  for (const match of html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)) {
    assert.doesNotThrow(()=>parser.parse(match[1]),'in-app guide');
  }
});
