import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { parseStrata, formatStrata } from '../language.js';
import { DiagramLayout, validateModel } from '../framework.js';
import { NoteRenderer, NOTE_LIMIT, noteConnectionAnchor } from './notes.js';
import { StandaloneBuilder } from '../../cli/standalone-builder.mjs';

const source=`note 1 "General note"
service group "Group" {
  note 2 "Group note"
  service api "API" {
    note 3 "Item note"
  }
}
database db "Database"
api -> db "Query" {
  line: dashed
  note 4 "Connection note"
  note 5 "Another note"
}
view all "All" {
  include: [group, db]
  note 6 "View note"
  api -> db "Query" {
    line: dashed
    note 7 "Local annotation"
  }
}
view other "Other" {
  include: [db]
}`;

test('all note attachment scopes round-trip through source and JSON',()=>{
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.equal(model.relations[0].notes.length,2);
});

test('marks, blocks, and connectors identify their visible item owners for synchronized motion',()=>{
  const model=parseStrata('group parent "Parent" { service api "API" { note 1 "Item" { connector {} } } }\nservice db "DB"\napi -> db { note 2 "Connection" { connector {} } }\nnote 3 "General"');
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  for (const collapsed of [new Set(),new Set(['parent'])]) {
    const layout=new DiagramLayout(model).create('all',collapsed);
    const scene=new NoteRenderer(el,text=>text.length*8).render(layout.notes,layout,{tile:'#000',muted:'#aaa',text:'#fff'},{resources:model.resources});
    const owner=collapsed.size ? 'parent' : 'api';
    for (const group of [...scene.group.children,...scene.connectors.children]) {
      const number=Number(group.attrs['data-note'] ?? group.attrs['data-note-text'] ?? group.attrs['data-note-connector']);
      assert.deepEqual(JSON.parse(group.attrs['data-note-owners']),number===1 ? [owner] : number===2 ? [owner,'db'] : []);
    }
  }
});

test('visible notes follow views, collapsed descendants and merged relationships',()=>{
  const layout=new DiagramLayout(parseStrata(source));
  const normal=layout.create('all');
  assert.deepEqual(normal.notes.map(entry=>entry.note.number),[1,2,3,4,5,6,7]);
  assert.equal(normal.edges.length,1);
  const collapsed=layout.create('all',new Set(['group']));
  assert.deepEqual(collapsed.notes.map(entry=>entry.note.number),[1,2,3,4,5,6,7]);
  assert.deepEqual(collapsed.notes[1].anchor,collapsed.notes[2].anchor);
  assert.deepEqual(layout.create('other').notes.map(entry=>entry.note.number),[1]);
});

test('rejects malformed, duplicate, oversized and over-budget notes',()=>{
  const model=parseStrata('');
  for (const notes of [null,{},[{number:0,text:'x'}],[{number:1.5,text:'x'}],[{number:Infinity,text:'x'}],[{number:1,text:''}],[{number:1,text:5}],[{number:1,text:'x'.repeat(5001)}]]) {
    assert.throws(()=>validateModel({...model,notes}),/Note|note/);
  }
  assert.throws(()=>parseStrata(source+'\nnote 2 "Duplicate"'),/Duplicate note/);
  assert.throws(()=>validateModel({...model,notes:Array.from({length:NOTE_LIMIT+1},(_,i)=>({number:i+1,text:'Note'}))}),/at most/);
  for (const suffix of ['note 1','note 1 "x" extra','note 0 "x"',"note NaN \"x\""]) {
    assert.throws(()=>parseStrata("service a \"A\"\nservice b \"B\"\na -> b"+suffix));
  }
});

test('note-only diagrams and maximum note numbers remain valid',()=>{
  const model=parseStrata(`note ${Number.MAX_SAFE_INTEGER} "Standalone"`);
  const layout=new DiagramLayout(model).create('all');
  assert.equal(layout.nodes.length,0);
  assert.equal(layout.notes.length,1);
  assert.equal(layout.notes[0].anchor,null);
});

test('connection badges use distance along the route, not an endpoint',()=>{
  assert.deepEqual(noteConnectionAnchor([{x:0,y:0},{x:200,y:0}]),{x:100,y:20});
  assert.deepEqual(noteConnectionAnchor([{x:0,y:0},{x:10,y:0},{x:10,y:90}]),{x:10,y:60});
});

test('renderer preserves hostile text as text and wraps all content within the scene',()=>{
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,text=>Array.from(text).length*10);
  const layout=new DiagramLayout(parseStrata('note 1 "<script>\\nLong unbroken text"')).create('all');
  const result=renderer.render(layout.notes,{...layout,width:300},{text:'#fff',tile:'#000',muted:'#aaa'});
  assert.ok(result.height>=layout.height);
  const rows=result.group.children[0].children;
  assert.equal(rows.filter(row=>row.tag==='text').slice(1).map(row=>row.text).join(''),'<script>Long unbroken text');
  assert.ok(rows.every(row=>['text','rect','path'].includes(row.tag)));
});

test('offline exports include notes and executable note rendering',async()=>{
  const html=await new StandaloneBuilder().build(source);
  assert.ok(html.includes('data-note-text'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});

test('collapsed context does not reveal notes on siblings excluded from the view',()=>{
  const model=parseStrata(`service parent "Parent" {
 service included "Included" {
   note 1 "Visible"
 }
 service excluded "Excluded" {
   note 2 "Hidden"
 }
}
view scoped "Scoped" {
 include: [included]
}`);
  const layout=new DiagramLayout(model).create('scoped',new Set(['parent']));
  assert.deepEqual(layout.notes.map(entry=>entry.note.number),[1]);
});

test('note remains a valid resource identifier in arrows',()=>{
  const model=parseStrata("service note \"Note service\"\nservice db \"DB\"\nnote -> db\ndb -> note {\n  note 1 \"Return\"\n}");
  assert.equal(model.relations.length,2);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
});

test('item badges default above the top-left corner of items and use individual dashed circles',()=>{
  const layout=new DiagramLayout(parseStrata(source)).create('all');
  const item=layout.nodes.find(node=>node.resource.id==='api');
  const entry=layout.notes.find(entry=>entry.note.number===3);
  assert.equal(entry.anchor.x,item.x);
  assert.ok(entry.anchor.y<item.y);
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,text=>text.length*8);
  const badge=renderer.badge(entry.note,entry.anchor,{tile:'#000',muted:'#aaa'},false);
  assert.equal(badge.children[0].tag,'circle');
  assert.equal(badge.children[0].attrs['stroke-dasharray'],'3 3');
  assert.equal(badge.children[1].text,'3');
});

test('selection highlights selected item and direct connection notes, dims unrelated notes, and respects Show notes',()=>{
  const model=parseStrata(source), layout=new DiagramLayout(model).create('all');
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,text=>text.length*8);
  const colors={tile:'#000',muted:'#aaa',text:'#fff',palette:{app:'#abc'}};
  const focus={primary:'api',edges:new Set(layout.edges)};
  const result=renderer.render(layout.notes,layout,colors,{focus,resources:model.resources});
  const highlighted=key=>result.group.children.filter(child=>child.attrs[key] && child.attrs['data-highlighted']==='true').map(child=>child.attrs[key]);
  assert.deepEqual(highlighted('data-note'),[3,4,5,7]);
  assert.deepEqual(highlighted('data-note-text'),[3,4,5,7]);
  assert.equal(result.group.children.find(child=>child.attrs['data-note-text']===2).attrs.opacity,.25);
  const hidden=renderer.render(layout.notes,layout,colors,{showNotes:false,focus,resources:model.resources});
  assert.equal(hidden.height,layout.height);
  assert.equal(hidden.group.children.length,0);
  assert.equal(hidden.connectors.children.length,0);
  assert.equal(hidden.minX,0);
  assert.equal(hidden.width,layout.width);
  const switched=renderer.render(layout.notes,layout,colors,{focus:{primary:'db',edges:new Set(layout.edges)},resources:model.resources});
  assert.equal(switched.group.children.find(child=>child.attrs['data-note']===3).attrs.opacity,.25);
  const idle=renderer.render(layout.notes,layout,colors);
  assert.ok(idle.group.children.filter(child=>child.attrs['data-note']).every(child=>child.attrs.opacity===.25));
  assert.ok(idle.group.children.filter(child=>child.attrs['data-note-text']).every(child=>child.attrs.opacity===.25));
});

test('notebook blocks wrap after eight entries and align row heights',()=>{
  const renderer=new NoteRenderer(()=>{},text=>text.length*8);
  const columnWidth=renderer.blocks([{note:{number:1,text:'Short'}}],700,40).boxes[0].width;
  for (const count of [0,1,2,7,8,9,17]) {
    const entries=Array.from({length:count},(_,index)=>({note:{number:index+1,text:index===0 ? 'A longer note '.repeat(20) : 'Short'}}));
    const layout=renderer.blocks(entries,700,40);
    assert.equal(layout.boxes.length,count);
    assert.ok(layout.width>=700);
    for (let index=0;index<count;index++) {
      const box=layout.boxes[index];
      assert.ok(box.x+box.width<=layout.width);
      assert.ok(box.width<=layout.width/8);
      assert.equal(box.width,columnWidth);
      assert.ok(box.y+box.height<=layout.height);
      assert.equal(box.y,layout.boxes[Math.floor(index/8)*8].y);
      assert.equal(box.height,layout.boxes[Math.floor(index/8)*8].height);
      if (index>=8) { assert.ok(box.y>layout.boxes[index-8].y+layout.boxes[index-8].height); }
    }
    if (count>8) { assert.equal(layout.boxes[8].x,layout.boxes[0].x); }
  }
});

test('labelled solid and dashed note connectors round-trip on items and relations',async()=>{
  const source=`service api "API" {
 note 1 "Item note" {
   connector {
     label: "Explanation"
     line: dashed
   }
 }
 note 2 "Solid note" {
   connector {}
 }
}
database db "DB"
api -> db {
  note 3 "Edge note" {
    connector {
      label: "Query context"
    }
  }
  note 4 "Another" {
    connector {
      line: dashed
    }
  }
}
view local "Local" {
 api -> db {
   note 5 "Local edge" {
     connector {}
   }
 }
}`;
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.deepEqual(model.resources[0].notes[0].connector,{label:'Explanation',dashed:true});
  assert.deepEqual(model.relations[0].notes[0].connector,{label:'Query context',dashed:false});
  const html=await new StandaloneBuilder().build(source);
  assert.ok(html.includes('data-note-connector'));
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
});

test('invalid connectors and connectors without marks are rejected',()=>{
  const model=parseStrata('service api "API" {\n note 1 "Note"\n}');
  for (const connector of [true,[],{dashed:'yes'},{dashed:null},{label:null},{label:5},{label:'x'.repeat(501)}]) {
    const invalid=structuredClone(model); invalid.resources[0].notes[0].connector=connector;
    assert.throws(()=>validateModel(invalid),/connector/);
  }
  for (const source of ["note 1 \"No mark\" {\n  connector {}\n}","view a \"A\" {\n note 1 \"No mark\" {\n   connector {}\n }\n}",'service api "API" {\n note 1 "Bad" connect : dashed\n}','service api "API" {\n note 1 "Bad" connect dotted\n}']) {
    assert.throws(()=>parseStrata(source));
  }
});

test('connectors end at actual mark positions and hide with note blocks',()=>{
  const model=parseStrata("service api \"API\" {\n note 1 \"One\" {\n   connector {\n     label: \"Label\"\n     line: dashed\n   }\n }\n note 2 \"Two\" {\n   connector {}\n }\n}");
  const layout=new DiagramLayout(model).create('all');
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,text=>text.length*8), colors={tile:'#000',muted:'#aaa',text:'#fff',canvas:'#000',palette:{app:'#abc'}};
  const focus={primary:'api',edges:new Set()};
  const scene=renderer.render(layout.notes,layout,colors,{focus,resources:model.resources});
  assert.equal(scene.connectors.children.length,2);
  const first=scene.connectors.children[0];
  assert.equal(first.attrs.opacity,.5);
  assert.equal(first.children[0].attrs['stroke-dasharray'],'8 6');
  assert.equal(first.children[1].text,'Label');
  assert.equal(first.children[0].attrs.stroke,colors.muted);
  assert.equal(first.children[1].attrs.fill,colors.muted);
  assert.equal(scene.connectors.children[1].children[0].attrs['stroke-dasharray'],undefined);
  for (const connector of scene.connectors.children) {
    const badge=scene.group.children.find(child=>child.attrs['data-note']===connector.attrs['data-note-connector']);
    const mark=badge.children[0].attrs;
    assert.equal(mark.stroke,colors.muted);
    assert.equal(badge.children[1].attrs.fill,colors.muted);
    const block=scene.group.children.find(child=>child.attrs['data-note-text']===connector.attrs['data-note-connector']);
    assert.equal(block.children[0].attrs.stroke,colors.muted);
    assert.equal(block.children.at(-1).attrs.fill,colors.text);
    assert.ok(connector.children[0].attrs.d.endsWith(`${mark.cx} ${mark.cy+14}`));
  }
  const idle=renderer.render(layout.notes,layout,colors);
  assert.ok(idle.connectors.children.every(connector=>connector.attrs.opacity===.25));
  const unrelated=renderer.render(layout.notes,layout,colors,{focus:{primary:'other',edges:new Set()},resources:model.resources});
  assert.ok(unrelated.connectors.children.every(connector=>connector.attrs.opacity===.25));
  assert.ok(scene.connectors.children.every(connector=>connector.attrs.opacity===.5));
  assert.equal(renderer.render(layout.notes,layout,colors,{showNotes:false}).connectors.children.length,0);
});

test('arbitrary positive note font sizes round-trip in all scopes and option orders',()=>{
  const source=`note 1 "General" {
  font-size: 12.5
}
service api "API" {
 note 2 "Large" {
   font-size: 48
   connector {
     line: dashed
   }
 }
}
database db "DB"
api -> db {
  note 3 "Small" {
    font-size: 7.25
    connector {
      label: "Details"
    }
  }
}
view all "All" {
 note 4 "View" {
   font-size: 100
 }
}`;
  const model=parseStrata(source);
  assert.deepEqual(parseStrata(formatStrata(model)),model);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  assert.equal(model.notes[0].fontSize,12.5);
  assert.equal(model.resources[0].notes[0].fontSize,48);
  assert.equal(model.relations[0].notes[0].fontSize,7.25);
  assert.equal(model.perspectives[0].notes[0].fontSize,100);
  assert.equal(parseStrata('note 1 "Default"').notes[0].fontSize,14);
  assert.equal(parseStrata(formatStrata(parseStrata("note 1 \"Explicit\" {\n  font-size: 16\n}"))).notes[0].fontSize,16);
});

test('invalid and repeated font sizes are rejected at import and source boundaries',()=>{
  const model=parseStrata('note 1 "Note"');
  for (const fontSize of [0,-1,NaN,Infinity,null,'24',{}]) {
    assert.throws(()=>validateModel({...model,notes:[{number:1,text:'Note',fontSize}]}),/fontSize/);
  }
  for (const suffix of ['font-size:','font-size: nope','font-size: 0','font-size: 24; font-size: 30']) {
    assert.throws(()=>parseStrata('note 1 "Note" { '+suffix+' }'));
  }
});

test('font size drives text measurement, line spacing, block width and height',()=>{
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,(text,size)=>text.length*size*.6);
  const entries=[16,64,500].map((fontSize,index)=>({note:{number:index+1,text:'Wide text\nSecond line',fontSize}}));
  const layout=renderer.blocks(entries,700,24);
  for (let index=0;index<entries.length;index++) {
    const note=entries[index].note, box=layout.boxes[index];
    assert.equal(box.fontSize,note.fontSize);
    assert.equal(box.lineHeight,note.fontSize*1.5);
    assert.ok(box.width>=note.fontSize*.6+56);
    assert.ok(box.height>=box.lines.length*box.lineHeight+16+Math.max(0,14-note.fontSize));
    const block=renderer.block(note,box,{muted:'#aaa',tile:'#000',text:'#fff'},false,false);
    const text=block.children.filter(child=>child.tag==='text').slice(1);
    assert.ok(text.every(child=>child.attrs['font-size']===note.fontSize));
    assert.equal(text[0].attrs.y,box.y+8+Math.max(14,note.fontSize));
    assert.equal(text[1].attrs.y-text[0].attrs.y,box.lineHeight);
  }
});
