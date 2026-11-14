import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IconLibrary,iconId } from '../src/icons/library.js';
import { parseStrata,formatStrata } from '../src/language.js';
import { createOfflineHtml } from '../standalone/offline-export.js';
const id='brands/brands_s/stripe_icon.svg';
const source=`external payments "Payments" {\n icon "${id}"\n}`;
test('icon paths survive parsing and formatting',()=>{
 const model=parseStrata(source);
 assert.equal(model.resources[0].icon,id);
 assert.deepEqual(parseStrata(formatStrata(model)),model);
 for(const invalid of ['../secret.svg','/tmp/icon.svg','https://example.com/a.svg','brands/x.svg?foo','a/../b.svg']) {
  assert.throws(()=>iconId(invalid));
 }
});
test('offline export embeds referenced icons and resolves them without fetching',async()=>{
 const svg=await readFile(new URL('../icons/'+id,import.meta.url));
 const data='data:image/svg+xml;base64,'+svg.toString('base64');
 const library=new IconLibrary({embedded:{[id]:data},fetchAsset:()=>{throw new Error('Unexpected fetch');}});
 const assets=await library.collect(parseStrata(source).resources);
 const template=await readFile(new URL('../dist/standalone.html',import.meta.url),'utf8');
 const html=createOfflineHtml(template,source,{},assets);
 const bootstrap=JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(bootstrap.icons[id],data);
 assert.equal(library.resolve(id),data);
 await assert.rejects(()=>library.collect([{icon:'missing.svg'}]),/not embedded/);
});
test('local icons use the asset route and missing files prevent incomplete exports',async()=>{
 const library=new IconLibrary({fetchAsset:async()=>({ok:false})});
 assert.equal(library.resolve(id),'/assets/icons/'+id);
 await assert.rejects(()=>library.collect([{icon:id}]),/not found/);
});
test('repository deployments resolve icons and export fetches under the project path',async()=>{
 const entryUrl='https://example.github.io/strata/src/app.js';
 const basePath=new URL('../assets/icons/',entryUrl).href;
 let fetched;
 const library=new IconLibrary({basePath,fetchAsset:async url=>{fetched=url;return {ok:false};}});
 assert.equal(library.resolve(id),'https://example.github.io/strata/assets/icons/'+id);
 await assert.rejects(()=>library.collect([{icon:id}]),/not found/);
 assert.equal(fetched,library.resolve(id));
 assert.equal(new URL('../dist/standalone.html',entryUrl).href,'https://example.github.io/strata/dist/standalone.html');
});
