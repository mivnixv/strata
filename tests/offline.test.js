import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { createOfflineHtml } from '../standalone/offline-export.js';
import { parseStrata } from '../src/language.js';
const template = await readFile(new URL('../dist/standalone.html',import.meta.url),'utf8');
function bootstrap(html) {
  return JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
}
test('standalone embeds CSS, renderer, language, editor, and source without external assets', () => {
  assert.ok(template.includes('<style>'));
  assert.ok(template.includes('class StrataDiagram'));
  assert.ok(template.includes('class DiagramMotion'));
  assert.ok(template.includes('prefers-reduced-motion'));
  assert.ok(template.includes('renderer.finishAnimations()'));
  assert.ok(template.includes('function parseStrata'));
  assert.ok(template.includes('id="export-html"'));
  assert.doesNotMatch(template, /<script[^>]+src=|<link[^>]+href=|@import|url\(\s*["']?https?:/i);
  assert.doesNotMatch(template, /^import .* from /m);
  assert.equal(parseStrata(bootstrap(template).source).title,'Amazon-style commerce');
  const executable = template.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(executable));
});
test('export embeds the exact current source and navigation state', () => {
  const source = 'diagram "Changed"\nservice api "API"';
  const presentation = {perspective:'all',collapsed:['api'],zoom:1.4,showLabels:false};
  assert.deepEqual(bootstrap(createOfflineHtml(template,source,presentation)),{source,presentation,icons:{}});
});
test('script-closing markup and replacement metacharacters cannot break the export', () => {
  const source = 'service api "</script><script>alert(1)</script> $& $`"';
  const html = createOfflineHtml(template,source);
  assert.equal(bootstrap(html).source,source);
  assert.equal((html.match(/<\/script>/g) ?? []).length,2);
  assert.ok(html.includes('\\u003c/script\\u003e'));
});
test('export can be exported again with a new model without growing or duplicating scripts', () => {
  const first = createOfflineHtml(template,'service first "First"');
  const second = createOfflineHtml(first,'service second "Second"');
  assert.equal(bootstrap(second).source,'service second "Second"');
  assert.equal((second.match(/<\/script>/g) ?? []).length,2);
});
test('invalid source and missing templates fail before download', () => {
  assert.throws(() => createOfflineHtml(template,'service api "API" {'), /missing/);
  assert.throws(() => createOfflineHtml('<html></html>',''), /template/);
});
test('offline exports retain global, additive and isolated perspective relationships', () => {
  const source = 'service api "API"\ndatabase db "DB"\napi -> db : "shared"\nview additive "Additive" {\n db -> api : "reply"\n}\nview isolated "Isolated" {\n relations only\n api -> db : "audit"\n}';
  const html = createOfflineHtml(template,source,{perspective:'isolated'});
  const saved = bootstrap(html);
  assert.equal(saved.source,source);
  const parsed = parseStrata(saved.source);
  assert.equal(parsed.relations[0].label,'shared');
  assert.equal(parsed.perspectives[0].relations[0].label,'reply');
  assert.equal(parsed.perspectives[1].inheritGlobalRelations,false);
  assert.equal(saved.presentation.perspective,'isolated');
});

test('offline exports enforce a full-window viewer without sidebar controls',()=>{
 const html=createOfflineHtml(template,'service api "API"');
 assert.match(html,/<html[^>]*data-offline-view="true"/);
 assert.equal((createOfflineHtml(html,'service api "API"').match(/<html[^>]*>/)[0].match(/data-offline-view=/g) ?? []).length,1);
 assert.ok(html.includes("$('toggle-sidebar').hidden=true"));
});

test('offline stylesheet starts with valid root styles and a local sans-serif stack',()=>{
 const css=template.match(/<style>([\s\S]*?)<\/style>/)[1];
 assert.match(css,/^:root\{/);
 assert.match(css,/font-family:system-ui,-apple-system/);
 assert.doesNotMatch(css,/fonts\.googleapis|display=swap|@import/);
});
