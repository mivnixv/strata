import { validateModel } from '../framework.js';
import { DSL_IDENTIFIER, ITEM_PROPERTIES, encodeDslValue } from './syntax.js';

/** Canonical output uses multiline blocks; parsing also accepts inline blocks. */
export class DslFormatter {
  constructor({validate=validateModel}={}) { this.validate=validate; }
  format(input) {
    const model=this.validate(input);
    for (const id of [...model.resources.map(r=>r.id),...model.perspectives.map(v=>v.id)]) {

      if (!DSL_IDENTIFIER.test(id)) { throw new Error(`ID “${id}” cannot be represented in Strata. Use letter-led IDs containing letters, digits, _, . or -.`); }

    }
    this.lines=[`diagram ${JSON.stringify(model.title)}`,''];
    for (const definition of model.types ?? []) {
      this.block(`type ${definition.name}`,this.styles(definition,{},true),0,true); this.lines.push('');
    }
    for (const note of model.notes) { this.note(note,0); }
    this.items(model);
    for (const relation of model.relations) { this.relation(relation,0); }
    for (const view of model.perspectives) { this.view(view); }
    return this.lines.join('\n').replace(/\n{3,}/g,'\n\n').trimEnd()+'\n';
  }
  line(text,depth) { this.lines.push('  '.repeat(depth)+text); }
  property(key,value,depth) {
    const raw=encodeDslValue(key,value);
    const text=['line','relations','shape','sizes','position','on'].includes(key) ? raw : JSON.stringify(raw);
    this.line(`${key}: ${text}`,depth);
  }
  block(header,properties,depth,required=false) {

    if (!properties.length) { this.line(header+(required ? ' {}' : ''),depth); return; }

    this.line(header+' {',depth);
    for (const [key,value] of properties) { this.property(key,value,depth+1); }
    this.line('}',depth);
  }
  styles(item,defaults,all=false) {
    const properties=[];
    for (const [key,[field]] of Object.entries(ITEM_PROPERTIES)) {

      if (Object.hasOwn(item,field) && (all || item[field] || Object.hasOwn(defaults,field))) { properties.push([key,item[field]]); }

    }
    return properties;
  }
  layout(target,depth,view=false) {
    const properties=[];

    if (target.sizes!==null && (!view || target.sizes!=='auto')) { properties.push(['sizes',target.sizes]); }
    if (target.compactness!==null && (!view || target.compactness!==.6)) { properties.push(['compactness',target.compactness]); }
    if (properties.length) { this.block('layout',properties,depth); }

  }
  items(model) {
    const children=new Map();
    for (const resource of model.resources) {
      const list=children.get(resource.parent) ?? []; list.push(resource); children.set(resource.parent,list);
    }
    const queue=(children.get(null) ?? []).map(resource=>({resource,depth:0}));
    for (let index=0;index<queue.length;index++) {
      const entry=queue[index], {depth}=entry;

      if (entry.close) { this.line('}',depth); continue; }

      const r=entry.resource, nested=children.get(r.id) ?? [];
      const properties=this.styles(r,model.types?.find(type=>type.name===r.type) ?? {});
      const block=properties.length || nested.length || r.notes.length || r.description || r.sizes!==null || r.compactness!==null;
      this.line(`${r.type} ${r.id} ${JSON.stringify(r.name)}${block ? ' {' : ''}`,depth);

      if (!block) { continue; }

      for (const [key,value] of properties) { this.property(key,value,depth+1); }

      if (r.description) { this.property('description',r.description,depth+1); }

      this.layout(r,depth+1);
      for (const note of r.notes) { this.note(note,depth+1); }
      queue.splice(index+1,0,...nested.map(resource=>({resource,depth:depth+1})),{close:true,depth});
    }
    this.lines.push('');
  }
  note(note,depth) {
    const properties=[];

    if (note.resource!==null) { properties.push(['on',note.resource]); }
    if (note.position && note.position!=='top-left') { properties.push(['position',note.position]); }
    if (note.fontSize!==14) { properties.push(['font-size',note.fontSize]); }

    const header=`note ${note.number} ${JSON.stringify(note.text)}`;

    if (!note.connector) { this.block(header,properties,depth); return; }

    this.line(header+' {',depth);
    for (const [key,value] of properties) { this.property(key,value,depth+1); }
    const connector=[];

    if (note.connector.label) { connector.push(['label',note.connector.label]); }
    if (note.connector.dashed) { connector.push(['line',true]); }

    this.block('connector',connector,depth+1,true); this.line('}',depth);
  }
  relation(relation,depth) {
    const decorated=relation.dashed || relation.notes.length || relation.startType!=='none' || relation.endType!=='arrow' || relation.startLabel || relation.endLabel;
    this.line(`${relation.from} -> ${relation.to}${relation.label ? ' '+JSON.stringify(relation.label) : ''}${decorated ? ' {' : ''}`,depth);

    if (!decorated) { return; }
    if (relation.dashed) { this.property('line',true,depth+1); }

    for (const end of ['start','end']) {
      const properties=[];

      if (relation[end+'Type']!==(end==='start' ? 'none' : 'arrow')) { properties.push(['shape',relation[end+'Type']]); }
      if (relation[end+'Label']) { properties.push(['label',relation[end+'Label']]); }
      if (properties.length) { this.block(end,properties,depth+1); }

    }
    for (const note of relation.notes) { this.note(note,depth+1); }
    this.line('}',depth);
  }
  view(view) {
    this.lines.push(''); this.line(`view ${view.id} ${JSON.stringify(view.name)} {`,0);

    if (view.description) { this.property('description',view.description,1); }
    if (view.resources!==null) { this.line(`include: [${view.resources.join(', ')}]`,1); }
    if (!view.inheritGlobalRelations) { this.property('relations',false,1); }
    if (view.detail!==1) { this.property('detail',view.detail,1); }

    this.layout(view,1,true);
    for (const note of view.notes) { this.note(note,1); }
    for (const relation of view.relations) { this.relation(relation,1); }
    this.line('}',0);
  }
}
