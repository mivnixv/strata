import { parseNoteDeclarations, formatNoteDeclaration } from './notes/source.js';
import { validateModel, LIMITS } from './framework.js';
const types = new Set(['app','service','database','infrastructure','external']);
const identifier = /^[A-Za-z_][\w.-]*$/;
function tokensFor(line, lineNumber) {
  const result = [];
  const pattern = /\s+|#[^\n]*|"(?:\\.|[^"\\])*"|->|[{}:,]|[0-9]+(?:\.[0-9]+)?|[A-Za-z_][\w.-]*/gy;
  let offset = 0;
  while (offset < line.length) {
    pattern.lastIndex = offset;
    const token = pattern.exec(line);

    if (!token) { throw new Error(`Line ${lineNumber}: unexpected character at column ${offset+1}.`); }

    offset = pattern.lastIndex;

    if (!/^\s|^#/.test(token[0])) { result.push(token[0]); }

  }
  return result;
}
function quoted(token, line) {

  if (!token?.startsWith('"')) { throw new Error(`Line ${line}: expected a quoted string.`); }

  try { return JSON.parse(token); }
  catch { throw new Error(`Line ${line}: invalid quoted string. Use JSON-style escapes.`); }
}
function id(token,line) {

  if (!identifier.test(token ?? '')) { throw new Error(`Line ${line}: expected an identifier (letters, digits, _, . or -).`); }

  return token;
}
/** Parses Strata source without evaluating code. Braces define hierarchy. */
export function parseStrata(source) {

  if (typeof source !== 'string' || new TextEncoder().encode(source).length > LIMITS.bytes) { throw new Error('Source must be under 1 MB.'); }

  const model = {title:'Untitled architecture',resources:[],relations:[],perspectives:[]};
  const stack = [];
  const lines = source.split(/\r?\n/);
  let titleSeen = false;
  let relationCount = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    const t = tokensFor(lines[index],line);

    if (!t.length) { continue; }

    const current = stack.at(-1);

    if (t[0] === '}' && t.length === 1) {

      if (!stack.length) { throw new Error(`Line ${line}: closing brace has no matching block.`); }

      stack.pop(); continue;
    }
    if (t[0] === 'diagram' && t.length === 2 && !current) {

      if (titleSeen) { throw new Error(`Line ${line}: declare the diagram title only once.`); }

      model.title = quoted(t[1],line); titleSeen = true; continue;
    }
    if (types.has(t[0]) && (t.length === 3 || (t.length === 4 && t[3] === '{')) && current?.kind !== 'view') {
      const resource = {id:id(t[1],line),name:quoted(t[2],line),type:t[0],parent:current?.resource.id ?? null,description:''};
      model.resources.push(resource);

      if (model.resources.length > LIMITS.resources) { throw new Error(`Line ${line}: maximum ${LIMITS.resources} resources.`); }
      if (t[3] === '{') { stack.push({kind:'resource',resource,line}); }
      if (stack.length > LIMITS.depth + 1) { throw new Error(`Line ${line}: nesting exceeds ${LIMITS.depth} levels.`); }

      continue;
    }
    if (['sizes','compactness','detail'].includes(t[0]) && t.length===2 && current) {
      if (t[0]==='detail' && current.kind!=='view') { throw new Error(`Line ${line}: detail belongs inside a view.`); }
      const target=current.kind==='view' ? current.view : current.resource;
      target[t[0]]=t[0]==='sizes' ? t[1] : Number(t[1]);
      continue;
    }
    if (t[0]==='dashed' && t.length===1 && current?.kind==='resource') {
      current.resource.dashed=true; continue;
    }
    if (t[0]==='note' && t[1]!=='->') {
      const target=current ? (current.kind==='resource' ? current.resource : current.view) : model;
      target.notes ??= [];
      target.notes.push(...parseNoteDeclarations(t,line,quoted)); continue;
    }
    if (t[0]==='noLargeIcon' && t.length===1 && current?.kind==='resource') {
      current.resource.noLargeIcon=true; continue;
    }
    if (t[0]==='subheader' && t.length===2 && current?.kind==='resource') {
      current.resource.subheader=quoted(t[1],line); continue;
    }
    if (t[0] === 'icon' && t.length === 2 && current?.kind === 'resource') {
      current.resource.icon = quoted(t[1],line); continue;
    }
    if (t[0] === 'description' && t.length === 2 && current) {
      (current.kind === 'resource' ? current.resource : current.view).description = quoted(t[1],line); continue;
    }
    if (t[0] === 'view' && t.length === 4 && t[3] === '{' && !current) {
      const view = {id:id(t[1],line),name:quoted(t[2],line),resources:null,relations:[],inheritGlobalRelations:true};
      model.perspectives.push(view); stack.push({kind:'view',view,line});

      if (model.perspectives.length > LIMITS.perspectives) { throw new Error(`Line ${line}: maximum ${LIMITS.perspectives} views.`); }

      continue;
    }
    if (t[0] === 'include' && current?.kind === 'view') {
      if (t.length === 1) { current.view.resources = []; continue; }

      const entries = t.slice(1);

      if (entries.length % 2 === 0 || entries.some((token,i) => i % 2 === 1 && token !== ',')) { throw new Error(`Line ${line}: separate resource IDs with commas.`); }

      current.view.resources ??= [];
      current.view.resources.push(...entries.filter((_,i) => i % 2 === 0).map(token => id(token,line))); continue;
    }
    if (t[0] === 'relations' && t[1] === 'only' && t.length === 2 && current?.kind === 'view') {
      current.view.inheritGlobalRelations = false; continue;
    }
    const noteStart=t.findIndex((token,index)=>index>=3 && token==='note');
    const relationNotes=[];

    if (t[1]==='->' && noteStart!==-1) {
      relationNotes.push(...parseNoteDeclarations(t.splice(noteStart),line,quoted));
    }
    const dashed=t.at(-1)==='dashed' && (t.length===4 || t.length===6);
    const relationLength=t.length-(dashed ? 1 : 0);
    if ((!current || current.kind === 'view') && t[1] === '->' && (relationLength === 3 || (relationLength === 5 && t[3] === ':'))) {
      const target = current ? current.view.relations : model.relations;
      target.push({from:id(t[0],line),to:id(t[2],line),label:relationLength === 5 ? quoted(t[4],line) : '',dashed,notes:relationNotes});
      relationCount++;

      if (relationCount > LIMITS.relations) { throw new Error(`Line ${line}: maximum ${LIMITS.relations} relationships.`); }

      continue;
    }

    throw new Error(`Line ${line}: expected a resource, relationship, view, or closing brace. See Language guide.`);
  }

  if (stack.length) { throw new Error(`Line ${stack.at(-1).line}: block is missing a closing brace.`); }
  if (!model.perspectives.length) { model.perspectives.push({id:'all',name:'System overview',resources:model.resources.filter(r => r.parent === null).map(r => r.id)}); }

  return validateModel(model);
}
/** Produces canonical source; JSON imports with incompatible IDs are rejected. */
export function formatStrata(input) {
  const model = validateModel(input);
  for (const value of [...model.resources.map(r => r.id),...model.perspectives.map(v => v.id)]) {

    if (!identifier.test(value)) { throw new Error(`ID “${value}” cannot be represented in Strata. Use letter-led IDs containing letters, digits, _, . or -.`); }

  }
  const noteSource=notes=>notes.map(formatNoteDeclaration);
  const relationSource=e=>`${e.from} -> ${e.to}${e.label ? ' : ' + JSON.stringify(e.label) : ''}${e.dashed ? ' dashed' : ''}${e.notes.length ? ' '+noteSource(e.notes).join(' ') : ''}`;
  const lines = [`diagram ${JSON.stringify(model.title)}`,''];
  lines.push(...noteSource(model.notes));
  const queue = model.resources.filter(r => r.parent === null).map(resource => ({kind:'resource',resource,depth:0}));
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i], pad = '  '.repeat(entry.depth);

    if (entry.kind === 'close') { lines.push(pad + '}'); continue; }

    const r = entry.resource, children = model.resources.filter(c => c.parent === r.id);
    const block = r.noLargeIcon || r.subheader || r.dashed || r.notes.length>0 || children.length > 0 || r.icon || r.description.length > 0 || r.sizes!==null || r.compactness!==null;
    lines.push(`${pad}${r.type} ${r.id} ${JSON.stringify(r.name)}${block ? ' {' : ''}`);

    if (r.dashed) { lines.push(`${pad}  dashed`); }
    lines.push(...noteSource(r.notes).map(line=>`${pad}  ${line}`));

    for (const key of ['sizes','compactness']) {
      if (r[key]!==null) { lines.push(`${pad}  ${key} ${r[key]}`); }
    }
    if (r.subheader) { lines.push(`${pad}  subheader ${JSON.stringify(r.subheader)}`); }
    if (r.noLargeIcon) { lines.push(`${pad}  noLargeIcon`); }
    if (r.icon) { lines.push(`${pad}  icon ${JSON.stringify(r.icon)}`); }
    if (r.description) { lines.push(`${pad}  description ${JSON.stringify(r.description)}`); }
    if (block) { queue.splice(i+1,0,...children.map(resource => ({kind:'resource',resource,depth:entry.depth+1})),{kind:'close',depth:entry.depth}); }

  }
  lines.push('','# Relationships');
  for (const e of model.relations) { lines.push(relationSource(e)); }
  for (const v of model.perspectives) {
    lines.push('',`view ${v.id} ${JSON.stringify(v.name)} {`);

    lines.push(`  sizes ${v.sizes}`,`  compactness ${v.compactness}`,`  detail ${v.detail}`);
    lines.push(...noteSource(v.notes).map(line=>`  ${line}`));
    if (v.description) { lines.push(`  description ${JSON.stringify(v.description)}`); }

    if (!v.inheritGlobalRelations) { lines.push('  relations only'); }
    if (v.resources !== null) { lines.push(`  include${v.resources.length ? ' ' + v.resources.join(', ') : ''}`); }
    for (const e of v.relations) { lines.push('  '+relationSource(e)); }

    lines.push('}');
  }
  return lines.join('\n') + '\n';
}
