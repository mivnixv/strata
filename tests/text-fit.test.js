import test from 'node:test';
import assert from 'node:assert/strict';
import { TextFit } from '../src/typography/fit.js';
const fitter=new TextFit((text,size)=>Array.from(text).length*size*.5);
test('uses larger text in wide tiles and shrinks before truncating',()=>{
 assert.deepEqual(fitter.fit('Architecture',300),{text:'Architecture',size:24});
 assert.deepEqual(fitter.fit('Architecture',90),{text:'Architecture',size:15});
 const narrow=fitter.fit('Architecture',40);
 assert.equal(narrow.size,12);
 assert.ok(narrow.text.endsWith('…'));
 assert.ok(narrow.text.length*6<=40);
 assert.equal(fitter.fit('Architecture',0).text,'');
});
