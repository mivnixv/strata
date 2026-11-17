import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrata, formatStrata } from '../src/language.js';
import { DiagramLayout, validateModel, relationsForPerspective } from '../src/framework.js';
const resources = 'app web "Web"\nservice platform "Platform" {\n service api "API"\n database db "Database"\n service worker "Unrelated worker"\n}\n';
const labels = (model,view) => new DiagramLayout(model).create(view).edges.map(e => e.label).sort();
const ids = (model,view) => new DiagramLayout(model).create(view).nodes.map(n => n.resource.id).sort();
test('scoped relationships infer endpoints and ancestors without including siblings', () => {
  const m = parseStrata(resources+"view data \"Data\" {\n api -> db \"query\"\n}");
  assert.equal(m.perspectives[0].resources,null);
  assert.equal(m.relations.length,0);
  assert.deepEqual(ids(m,'data'),['api','db','platform']);
  assert.deepEqual(labels(m,'data'),['query']);
});
test('global and local relationships coexist without leaking to another view', () => {
  const m = parseStrata(resources+"api -> db \"global\"\nview a \"A\" {\n include: [api, db]\n db -> api \"local reply\"\n}\nview b \"B\" {\n include: [api, db]\n}");
  assert.deepEqual(labels(m,'a'),['global','local reply']);
  assert.deepEqual(labels(m,'b'),['global']);
  assert.deepEqual(parseStrata(formatStrata(m)),m);
});
test("relations: local", () => {
  const m = parseStrata(resources+"web -> api \"global ingress\"\napi -> db \"global SQL\"\nview only \"Only\" {\n relations: local\n api -> db \"local query\"\n}");
  assert.deepEqual(labels(m,'only'),['local query']);
  assert.deepEqual(ids(m,'only'),['api','db','platform']);
  assert.deepEqual(parseStrata(formatStrata(m)),m);
});
test('inferred local membership limits inherited globals to participating endpoints', () => {
  const m = parseStrata(resources+"web -> api \"hidden ingress\"\napi -> db \"shared query\"\nview data \"Data\" {\n db -> api \"reply\"\n}");
  assert.deepEqual(labels(m,'data'),['reply','shared query']);
  assert.ok(!ids(m,'data').includes('web'));
});
test('legacy include lists work and local endpoints supplement explicit membership', () => {
  const m = parseStrata(resources+"web -> api \"request\"\nview a \"A\" {\n include: [web]\n api -> db \"query\"\n}");
  assert.deepEqual(ids(m,'a'),['api','db','platform','web']);
  assert.deepEqual(labels(m,'a'),['query','request']);
});
test('a view with no include or local edges infers its graph from global relationships', () => {
  const m = parseStrata(resources+"web -> api \"request\"\nview a \"A\" {\n}");
  assert.deepEqual(ids(m,'a'),['api','platform','web']);
  assert.deepEqual(labels(m,'a'),['request']);
});
test('duplicate inherited/local edges are rendered once and distinct labels remain distinct', () => {
  const m = parseStrata(resources+"api -> db \"SQL\"\nview data \"Data\" {\n api -> db \"SQL\"\n api -> db \"audit\"\n}");
  assert.deepEqual(labels(m,'data'),['SQL','audit']);
  assert.equal(relationsForPerspective(m,m.perspectives[0]).length,2);
});
test('unresolved scoped endpoints and malformed JSON scope options are rejected', () => {
  assert.throws(() => parseStrata(resources+'view a "A" {\n api -> missing\n}'),/existing/);
  const m = parseStrata(resources+'view a "A" {\n api -> db\n}');
  const invalid = structuredClone(m); invalid.perspectives[0].inheritGlobalRelations = 'false';
  assert.throws(() => validateModel(invalid),/boolean/);
  invalid.perspectives[0].inheritGlobalRelations = true; invalid.perspectives[0].relations = null;
  assert.throws(() => validateModel(invalid),/array/);
});
test('the relationship budget includes all scopes', () => {
  const m = parseStrata(resources+'view a "A" {\n api -> db\n}');
  m.relations = Array.from({length:1000},() => ({from:'api',to:'db',label:''}));
  assert.throws(() => validateModel(m),/total global and perspective/);
});
test('an explicitly empty membership list and empty isolated scope round-trip', () => {
  const m = parseStrata(resources+"api -> db\nview empty \"Empty\" {\n include: []\n}\nview only \"Only\" {\n relations: local\n}");
  assert.deepEqual(ids(m,'empty'),[]); assert.deepEqual(ids(m,'only'),[]);
  assert.deepEqual(parseStrata(formatStrata(m)),m);
});
