import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrata, formatStrata } from '../src/language.js';
import { validateModel } from '../src/framework.js';
import { example } from '../dist/example.js';
test('canonical source round-trips the full example without losing data', () => {
  assert.deepEqual(parseStrata(formatStrata(example)), validateModel(example));
});
test('supports nested resources, forward references, comments, descriptions and default view', () => {
  const m = parseStrata('diagram "Shop"\nweb -> api : "HTTPS" # forward reference\napp web "Web #1"\nservice backend "Backend" {\n description "Hello \\"world\\""\n service api "API"\n}\n');
  assert.equal(m.resources[2].parent,'backend'); assert.equal(m.resources[1].description,'Hello "world"');
  assert.equal(m.relations[0].label,'HTTPS'); assert.deepEqual(m.perspectives[0].resources,['web','backend']);
});
test('custom perspectives select explicit resources', () => {
  const m = parseStrata('service api "API"\ndatabase db "DB"\nview data "Data" {\ninclude api, db\n}');
  assert.deepEqual(m.perspectives[0].resources,['api','db']);
});
test('syntax diagnostics identify the offending line or unclosed block', () => {
  assert.throws(() => parseStrata('service api "API" {'), /Line 1.*missing/);
  assert.throws(() => parseStrata('}'), /Line 1.*matching/);
  assert.throws(() => parseStrata('service api API'), /Line 1.*quoted/);
  assert.throws(() => parseStrata('service api "API"\n!bad'), /Line 2.*column/);
  assert.throws(() => parseStrata('view v "V" {\ninclude api,\n}'), /Line 2.*commas/);
  assert.throws(() => parseStrata('diagram "One"\ndiagram "Two"'), /only once/);
});
test('rejects duplicate resource IDs and unresolved references', () => {
  assert.throws(() => parseStrata('service api "API"\nservice api "Duplicate"'), /Duplicate/);
  assert.throws(() => parseStrata('service api "API"\napi -> missing'), /existing/);
});
test('empty source is a valid empty diagram; braces in strings are text', () => {
  assert.equal(parseStrata('').resources.length,0);
  assert.equal(parseStrata('service api "API { v2 }"').resources[0].name,'API { v2 }');
});
test('quoted hostile text stays data; executable syntax is rejected', () => {
  assert.equal(parseStrata('service api "<img src=x onerror=alert(1)>"').resources[0].name,'<img src=x onerror=alert(1)>');
  assert.throws(() => parseStrata('alert(1)'), /Line 1/);
});
test('perspective explanations round-trip and reject invalid descriptions', () => {
  const source = 'service api "API"\nview all "Checkout" {\n description "Reserve stock, then authorize.\\nCommit order and outbox together."\n include api\n}';
  const model = parseStrata(source);
  assert.equal(model.perspectives[0].description,'Reserve stock, then authorize.\nCommit order and outbox together.');
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  const invalid = structuredClone(model); invalid.perspectives[0].description = 42;
  assert.throws(() => validateModel(invalid), /Perspective descriptions/);
});
test('app declarations work while resource and application are rejected', () => {
  const model = parseStrata('app clients "Clients" {\n app web "Web"\n}\n');
  assert.equal(model.resources[0].type,'app');
  assert.equal(model.resources[1].parent,'clients');
  assert.match(formatStrata(model),/app web "Web"/);
  for (const removed of ['resource','application']) {
    assert.throws(() => parseStrata(`${removed} web "Web"`),/Line 1/);
    const invalid = structuredClone(model);
    invalid.resources[0].type = removed;
    assert.throws(() => validateModel(invalid),/Unknown resource type/);
    assert.throws(() => formatStrata(invalid),/Unknown resource type/);
  }
});
