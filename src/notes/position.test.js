import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../language.js';
import { DiagramLayout, validateModel } from '../framework.js';
import { NOTE_MARK_POSITIONS, itemNoteAnchor, noteMarkLayout } from './position.js';
import { NoteRenderer } from './notes.js';
import { StandaloneBuilder } from '../../cli/standalone-builder.mjs';

const declarations=NOTE_MARK_POSITIONS.map((position,index)=>` note ${index+1} "${position}" { position: ${position}; connector { label: "Details"; line: dashed } }`).join('\n');
const source=`service parent "Parent" {\n service api "API" {\n${declarations}\n }\n}`;

test('item mark positions round-trip through source, JSON and collapsed groups',()=>{
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.deepEqual(model.resources[1].notes.map(note=>note.position),NOTE_MARK_POSITIONS);
  const layout=new DiagramLayout(model).create('all',new Set(['parent']));
  assert.equal(layout.notes.length,8);
  layout.notes.forEach(({note,anchor})=>assert.deepEqual(anchor,itemNoteAnchor(layout.nodes[0],note.position)));
  assert.equal(parseStrata('service a "A" {\n note 1 "Default"\n}').resources[0].notes[0].position,'top-left');
});

test('all eight anchors lie on their requested side or corner',()=>{
  const node={x:100,y:100,w:200,h:100};
  const expected=[[100,78],[200,78],[300,78],[322,150],[300,222],[200,222],[100,222],[78,150]];
  NOTE_MARK_POSITIONS.forEach((position,index)=>{
    const anchor=itemNoteAnchor(node,position);
    assert.deepEqual([anchor.x,anchor.y],expected[index]);
  });
});

test('marks stack along the selected edge and outward without overlapping',()=>{
  const node={x:0,y:0,w:100,h:100};
  for (const position of NOTE_MARK_POSITIONS) {
    const anchor=itemNoteAnchor(node,position);
    const entries=Array.from({length:20},(_,index)=>({note:{number:index+1},anchor}));
    const marks=noteMarkLayout(entries), points=[...marks.positions.values()];
    assert.equal(new Set(points.map(point=>JSON.stringify(point))).size,entries.length);
    assert.ok(points.every(point=>point.x-14>=marks.minX && point.y-14>=marks.minY && point.x+14<=marks.maxX && point.y+14<=marks.maxY));
  }
});

test('note scene includes outer marks in its bounds and places notebook blocks below them',()=>{
  const node={x:0,y:0,w:100,h:100,resource:{id:'a',type:'service'}};
  const entries=Array.from({length:20},(_,index)=>({note:{number:index+1,text:'Note',fontSize:14},anchor:itemNoteAnchor(node,'bottom-left'),target:{kind:'item',resourceId:'a',nodeId:'a'}}));
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const scene=new NoteRenderer(el,text=>text.length*8).render(entries,{width:700,height:120,nodes:[node]},{muted:'#aaa',text:'#fff',tile:'#000'});
  const marks=noteMarkLayout(entries);
  assert.ok(scene.height>=marks.maxY);
  const firstBlock=scene.group.children.find(child=>child.attrs['data-note-text']===1);
  assert.ok(firstBlock.children[0].attrs.y>marks.maxY);
});

test('invalid positions, repeated options, and positioning unattached or connection notes are rejected',()=>{
  for (const option of ['position:','position: nowhere','position: top; position: left']) {
    assert.throws(()=>parseStrata(`service a "A" {
 note 1 "Note" { ${option} }\n}`));
  }
  for (const declaration of ["note 1 \"General\" {\n  position: top\n}","view v \"View\" {\n note 1 \"View\" {\n   position: left\n }\n}","service a \"A\"\nservice b \"B\"\na -> b {\n  note 1 \"Edge\" {\n    position: right\n  }\n}"]) {
    assert.throws(()=>parseStrata(declaration),/position.*only.*item/);
  }
  const model=parseStrata(source);
  for (const position of ['',42,{},'middle']) {
    const invalid=structuredClone(model); invalid.resources[1].notes[0].position=position;
    assert.throws(()=>validateModel(invalid),/position/);
  }
});

test('offline HTML preserves mark position settings and includes executable positioning code',async()=>{
  const html=await new StandaloneBuilder().build(source);
  assert.ok(html.includes('itemNoteAnchor'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});
