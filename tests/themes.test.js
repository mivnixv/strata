import test from 'node:test';
import assert from 'node:assert/strict';
import { themes,resolveTheme,applyTheme } from '../src/themes/themes.js';
test('seven distinct themes supply complete renderer and UI palettes',()=>{
 assert.equal(themes.length,7);
 assert.equal(new Set(themes.map(t=>t.id)).size,7);
 for(const theme of themes) {
  for(const value of [theme.canvas,theme.container,theme.tile,theme.border,theme.text,theme.muted,...Object.values(theme.palette)]) assert.match(value,/^#[a-f0-9]{6}$/i);
  const properties={};const element={style:{setProperty:(key,value)=>properties[key]=value},dataset:{}};
  assert.equal(applyTheme(element,theme.id),theme.id);
  assert.equal(properties['--type-service'],theme.palette.service);
 }
 assert.equal(resolveTheme('missing').id,'midnight');
});
