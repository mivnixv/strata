import { validateModel, LIMITS } from '../framework.js';
import { ItemTypes, TYPE_LIMIT, validTypeName } from '../items/types/types.js';
import { NOTE_LIMIT } from '../notes/notes.js';
import { DSL_IDENTIFIER, DSL_PROPERTIES, DSL_ENUMS, decodeDslValue } from './syntax.js';
import { DslLexer } from './lexer.js';

/** Iterative scope stack; nested data never causes recursive parser calls. */
export class DslParser {
  constructor({lexer=new DslLexer(),validate=validateModel}={}) { this.lexer=lexer; this.validate=validate; }
  parse(source) {

    if (typeof source!=='string' || new TextEncoder().encode(source).length>LIMITS.bytes) { throw new Error('Source must be under 1 MB.'); }

    this.tokens=this.lexer.scan(source); this.index=0; this.relations=0; this.notes=0;
    this.model={title:'Untitled architecture',resources:[],relations:[],perspectives:[]};
    this.locations=new Map(); this.titleSeen=false;
    this.stack=[{kind:'root',target:this.model,seen:new Set()}];
    while (this.peek().kind!=='eof') {

      if (this.peek().kind==='separator') { this.take(); continue; }
      if (this.peek().raw==='}') {

        if (this.stack.length===1) { this.fail('closing brace has no matching block.'); }

        this.take(); this.stack.pop(); continue;
      }

      this.statement(this.stack.at(-1));
    }

    if (this.stack.length>1) { this.fail('block is missing a closing brace.',this.stack.at(-1).token); }
    if (!this.model.perspectives.length) { this.model.perspectives.push({id:'all',name:'System overview',resources:this.model.resources.filter(r=>r.parent===null).map(r=>r.id)}); }

    const types=new ItemTypes(this.model.types);
    for (const resource of this.model.resources) {

      if (!types.has(resource.type)) { this.fail(`unknown resource type: ${resource.type}`,this.locations.get(resource)); }

    }
    return this.validate(this.model);
  }
  peek(offset=0) { return this.tokens[Math.min(this.index+offset,this.tokens.length-1)]; }
  take() { return this.tokens[this.index++]; }
  fail(message,token=this.peek()) { throw new Error(`Line ${token.line}, column ${token.column}: ${message}`); }
  expect(raw) {

    if (this.peek().raw!==raw) { this.fail(`expected ${JSON.stringify(raw)}.`); }

    return this.take();
  }
  scalar(kind) {
    const token=this.peek();

    if (kind==='nullable-string' && token.raw==='null') { this.take(); return null; }
    if (kind==='string' || kind==='nullable-string') {

      if (token.kind!=='string') { this.fail('expected a quoted string.'); }

    } else if (kind==='number') {

      if (token.kind!=='number' || !Number.isFinite(token.value)) { this.fail('expected a finite number.'); }

    } else if (kind==='boolean') {

      if (token.kind!=='word' || !['true','false'].includes(token.raw)) { this.fail('expected true or false.'); }

      this.take(); return token.raw==='true';
    } else {

      if (token.kind!=='word' || !DSL_IDENTIFIER.test(token.raw)) { this.fail('expected an identifier (letters, digits, _, . or -).'); }
      if (DSL_ENUMS[kind] && !DSL_ENUMS[kind].includes(token.raw)) { this.fail(`expected ${DSL_ENUMS[kind].join(' | ')}.`); }

    }
    this.take(); return token.value;
  }
  finish() {

    if (this.peek().kind!=='separator' && this.peek().kind!=='eof' && this.peek().raw!=='}') { this.fail('expected a newline or semicolon between statements.'); }

  }
  unique(frame,key,token) {

    if (frame.seen.has(key)) { this.fail(`duplicate ${key} property or block.`,token); }

    frame.seen.add(key);
  }
  open(kind,target,token,extra={}) {
    this.expect('{');

    if (this.stack.length>=LIMITS.depth+4) { this.fail(`nesting exceeds ${LIMITS.depth} item levels.`,token); }

    this.stack.push({kind,target,token,seen:new Set(),...extra});
  }
  ids() {
    this.expect('[');
    const ids=[];
    while (this.peek().raw!==']') {
      while (this.peek().raw==='\n') { this.take(); }

      if (this.peek().raw===']') { break; }

      ids.push(this.scalar('id'));

      if (ids.length>LIMITS.resources) { this.fail(`include accepts at most ${LIMITS.resources} IDs.`); }

      while (this.peek().raw==='\n') { this.take(); }

      if (this.peek().raw===']') { break; }

      this.expect(',');
    }
    this.expect(']'); return ids;
  }
  property(frame) {
    const token=this.take(), descriptor=Object.hasOwn(DSL_PROPERTIES[frame.kind] ?? {},token.raw) ? DSL_PROPERTIES[frame.kind][token.raw] : null;

    if (!descriptor || (token.raw==='on' && !frame.allowOn)) { this.fail(`unknown ${frame.kind} property: ${token.raw}.`,token); }

    this.unique(frame,token.raw,token); this.expect(':');
    const [field,kind]=descriptor;
    const value=decodeDslValue(token.raw,kind==='ids' ? this.ids() : this.scalar(kind));
    frame.target[(frame.prefix ?? '')+field]=value;
    this.finish();
  }
  statement(frame) {
    const token=this.peek(), word=token.raw;

    if (this.peek(1).raw===':') { this.property(frame); return; }
    if (this.peek(1).raw==='{') { this.namedBlock(frame); return; }
    if (this.peek(1).raw==='->' && ['root','view','item'].includes(frame.kind)) { this.relation(frame); return; }
    if (word==='note' && ['root','view','item','relation'].includes(frame.kind)) { this.note(frame); return; }
    if (word==='diagram' && frame.kind==='root') {
      this.take();

      if (this.titleSeen) { this.fail('declare the diagram title only once.',token); }

      this.model.title=this.scalar('string'); this.titleSeen=true; this.finish(); return;
    }
    if (word==='type' && frame.kind==='root') { this.definition(); return; }
    if (word==='view' && frame.kind==='root') { this.view(); return; }
    if (['root','item'].includes(frame.kind) && validTypeName(word)) { this.item(frame); return; }

    this.fail(`unexpected ${JSON.stringify(word)} in ${frame.kind}; use key: value properties or a supported declaration.`);
  }
  namedBlock(frame) {
    const token=this.take(), key=token.raw;
    this.unique(frame,key,token);

    if (key==='layout' && ['item','view'].includes(frame.kind)) { this.open('layout',frame.target,token); return; }
    if (['start','end'].includes(key) && frame.kind==='relation') { this.open('endpoint',frame.target,token,{prefix:key}); return; }
    if (key==='connector' && frame.kind==='note') { frame.target.connector={}; this.open('connector',frame.target.connector,token); return; }

    this.fail(`unknown ${frame.kind} block: ${key}.`,token);
  }
  definition() {
    const token=this.take(), name=this.scalar('id');

    if (!validTypeName(name)) { this.fail('invalid item type name.',token); }

    this.model.types ??= [];

    if (this.model.types.length>=TYPE_LIMIT) { this.fail(`maximum ${TYPE_LIMIT} types.`,token); }

    const definition={name}; this.model.types.push(definition); this.open('type',definition,token);
  }
  item(frame) {
    const token=this.take();
    const resource={type:token.raw,id:this.scalar('id'),name:this.scalar('string'),parent:frame.kind==='item' ? frame.target.id : null};
    this.model.resources.push(resource); this.locations.set(resource,token);

    if (this.model.resources.length>LIMITS.resources) { this.fail(`maximum ${LIMITS.resources} resources.`,token); }

    if (this.peek().raw==='{') { this.open('item',resource,token); }
    else { this.finish(); }

  }
  view() {
    const token=this.take(), view={id:this.scalar('id'),name:this.scalar('string'),resources:null,relations:[]};
    this.model.perspectives.push(view);

    if (this.model.perspectives.length>LIMITS.perspectives) { this.fail(`maximum ${LIMITS.perspectives} views.`,token); }

    this.open('view',view,token);
  }
  relation(frame) {
    const token=this.peek(), from=this.scalar('id'); this.expect('->');
    const to=this.scalar('id'), hasLabel=this.peek().kind==='string';
    const relation={from,to,label:hasLabel ? this.scalar('string') : ''};
    const owner=frame.kind==='view' ? frame.target : this.model;
    owner.relations.push(relation); this.relations++;

    if (this.relations>LIMITS.relations) { this.fail(`maximum ${LIMITS.relations} relationships.`,token); }

    if (this.peek().raw==='{') {
      this.open('relation',relation,token);

      if (hasLabel) { this.stack.at(-1).seen.add('label'); }

    } else { this.finish(); }
  }
  note(frame) {
    const token=this.take(), note={number:this.scalar('number'),text:this.scalar('string')};
    frame.target.notes ??= []; frame.target.notes.push(note); this.notes++;

    if (this.notes>NOTE_LIMIT) { this.fail(`maximum ${NOTE_LIMIT} notes.`,token); }

    if (this.peek().raw==='{') { this.open('note',note,token,{allowOn:['root','view'].includes(frame.kind)}); }
    else { this.finish(); }

  }
}
