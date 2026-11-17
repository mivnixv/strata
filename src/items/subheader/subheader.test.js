import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../../language.js';
import { validateModel } from '../../framework.js';
import { ItemSubheader } from './subheader.js';
import { StandaloneBuilder } from '../../../cli/standalone-builder.mjs';

const source=`service parent "Parent" {
 subheader: "Commerce boundary"
 service api "API" {
  subheader: "Request processing"
 }
}
database db "Database"`;

test('subheaders round-trip through text and JSON without adding type labels',()=>{
  const model=parseStrata(source);
  assert.equal(model.resources[0].subheader,'Commerce boundary');
  assert.equal(model.resources[1].subheader,'Request processing');
  assert.equal(model.resources[2].subheader,'');
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  const leaf=parseStrata("service api \"API\" {\n subheader: \"Leaf-only block\"\n}");
  assert.deepEqual(parseStrata(formatStrata(leaf)),leaf);
});

test("subheader: validation rejects invalid JSON , unquoted text and wrong scope",()=>{
  const model=parseStrata(source);
  for (const subheader of [null,1,{},'x'.repeat(501)]) {
    const invalid=structuredClone(model); invalid.resources[0].subheader=subheader;
    assert.throws(()=>validateModel(invalid),/subheader/);
  }
  for (const value of ["subheader: \"Outside\"","view a \"A\" {\n subheader: \"View\"\n}","service api \"API\" {\n subheader: Unquoted\n}"]) {
    assert.throws(()=>parseStrata(value));
  }
});

test('optional subheaders render on leaves and expanded/collapsed containers',()=>{
  const el=(tag,attrs,text)=>({tag,attrs,text});
  const renderer=new ItemSubheader(el,{fit:(text,width)=>({text,size:16})});
  const node={x:100,y:200,w:300,h:400,container:false,collapsed:false,resource:{type:'database',subheader:''}};
  assert.equal(renderer.render(node,0,{muted:'#aaa'}),null);
  const resource={...node.resource,subheader:'<script> is text'};
  const leaf=renderer.render({...node,resource},0,{muted:'#aaa'});
  assert.equal(leaf.text,'<script> is text');
  assert.equal(leaf.attrs.y,272);
  const expanded=renderer.render({...node,resource,container:true},2,{muted:'#aaa'});
  assert.equal(expanded.attrs.y,255);
  const collapsed=renderer.render({...node,resource,container:true,collapsed:true},2,{muted:'#aaa'});
  assert.equal(collapsed.text,resource.subheader);
  assert.equal(collapsed.attrs.y,272);
  assert.equal(renderer.render({...node,container:true,collapsed:true},2,{muted:'#aaa'}).text,'2 components · collapsed');
});

test('offline HTML includes subheaders and executable rendering',async()=>{
  const html=await new StandaloneBuilder().build(source);
  assert.ok(html.includes('Commerce boundary'));
  assert.ok(html.includes('data-subheader'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
