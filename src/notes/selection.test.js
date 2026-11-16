import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrata } from '../language.js';
import { DiagramLayout } from '../framework.js';
import { noteSelectionFocus, NoteInteraction } from './selection.js';
import { NoteRenderer } from './notes.js';

const model=parseStrata(`note 1 "General"
service parent "Parent" {
 service api "API" {
   note 2 "First"
   note 3 "Second"
 }
}
database db "Database"
service other "Other"
api -> db note 4 "Query"
api -> other note 5 "Other connection"`);
const layout=new DiagramLayout(model).create('all');
const focusFor=number=>noteSelectionFocus(layout.notes.find(entry=>entry.note.number===number),model.resources,12);

test('an item note focuses only its owner and ancestor context, not neighbors',()=>{
  const focus=focusFor(2);
  assert.equal(focus.primary,'api');
  assert.deepEqual([...focus.nodes],['api']);
  assert.equal(focus.edges.size,0);
  assert.deepEqual([...focus.context],['parent']);
});

test('a connection note focuses only its connection and endpoints',()=>{
  const focus=focusFor(4);
  assert.equal(focus.primary,null);
  assert.deepEqual([...focus.nodes],['api','db']);
  assert.equal(focus.edges.size,1);
  assert.equal([...focus.edges][0].to.resource.id,'db');
});

test('standalone notes focus no diagram items; collapsed notes use their visible owner',()=>{
  const focus=focusFor(1);
  assert.equal(focus.nodes.size,0); assert.equal(focus.edges.size,0);
  const collapsed=new DiagramLayout(model).create('all',new Set(['parent']));
  const entry=collapsed.notes.find(entry=>entry.note.number===2);
  assert.deepEqual([...noteSelectionFocus(entry,model.resources,12).nodes],['parent']);
});

test('specific note selection dims other notes on the same item and its connections',()=>{
  const el=(tag,attrs={},text)=>({tag,attrs,text,children:[],append(...children){this.children.push(...children);}});
  const renderer=new NoteRenderer(el,text=>text.length*8), colors={tile:'#000',muted:'#aaa',text:'#fff',canvas:'#000'};
  for (const number of [1,2,4]) {
    const scene=renderer.render(layout.notes,layout,colors,{focus:focusFor(number),selectedNote:number,resources:model.resources});
    const rows=scene.group.children.filter(child=>child.attrs['data-note-text']);
    assert.deepEqual(rows.filter(child=>child.attrs.opacity===1).map(child=>child.attrs['data-note-text']),[number]);
    assert.ok(rows.filter(child=>child.attrs['data-note-text']!==number).every(child=>child.attrs.opacity===.25));
    const marks=scene.group.children.filter(child=>child.attrs['data-note']);
    assert.ok(marks.every(child=>child.attrs.opacity===(child.attrs['data-note']===number ? 1 : .25)));
  }
});

test('mark and block activation stop canvas clearing and support keyboard selection',()=>{
  const selected=[], events=new Map(), attributes=new Map();
  const element={setAttribute:(name,value)=>attributes.set(name,value),addEventListener:(name,handler)=>events.set(name,handler)};
  new NoteInteraction(number=>selected.push(number)).bind(element,2,true);
  assert.equal(attributes.get('role'),'button');
  assert.equal(attributes.get('tabindex'),'0');
  assert.equal(attributes.get('aria-pressed'),'true');
  let stopped=0, prevented=0;
  const event={stopPropagation:()=>stopped++,preventDefault:()=>prevented++};
  events.get('click')(event);
  for (const key of ['Enter',' ','Escape']) { events.get('keydown')({...event,key}); }
  events.get('dblclick')(event);
  assert.deepEqual(selected,[2,2,2]);
  assert.equal(stopped,4); assert.equal(prevented,2);
});
