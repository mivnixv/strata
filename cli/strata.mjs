#!/usr/bin/env node
import { open, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve, parse } from 'node:path';
import { LIMITS, parseModel } from '../src/framework.js';
import { parseStrata, formatStrata } from '../src/language.js';
import { StandaloneBuilder } from './standalone-builder.mjs';

const help=`Usage:
  strata verify <input.strata|input.json|->
  strata build <input.strata|input.json|-> [-o output.html] [--view id]

Use - to read stdin. JSON is detected by its opening brace.
Build defaults to <input-name>.html (diagram.html for stdin).
Existing output files are never overwritten. Requires Node.js 20.11+.
`;

async function readSource(input) {

  if (input==='-') {
    const chunks=[];
    let size=0;
    for await (const chunk of process.stdin) {
      size+=chunk.length;

      if (size>LIMITS.bytes) { throw new Error('Source must be under 1 MB.'); }

      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  const file=await open(input,'r');
  try {
    const bytes=Buffer.alloc(LIMITS.bytes+1);
    let size=0;
    while (size<bytes.length) {
      const result=await file.read(bytes,size,bytes.length-size,null);

      if (result.bytesRead===0) { break; }

      size+=result.bytesRead;
    }

    if (size>LIMITS.bytes) { throw new Error('Source must be under 1 MB.'); }

    return bytes.subarray(0,size).toString('utf8');
  } finally { await file.close(); }
}

async function run() {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{
    help:{type:'boolean',short:'h'},
    output:{type:'string',short:'o'},
    view:{type:'string'}
  }});

  if (values.help) { process.stdout.write(help); return; }

  const [command,input]=positionals;

  if (!['verify','build'].includes(command) || !input || positionals.length!==2) { throw new Error(help); }
  if (command==='verify' && (values.output!==undefined || values.view!==undefined)) { throw new Error('verify does not accept --output or --view.'); }

  const raw=await readSource(input);
  const source=raw.trimStart().startsWith('{') ? formatStrata(parseModel(raw)) : raw;
  const model=parseStrata(source);
  const view=values.view ?? model.perspectives[0].id;

  if (!model.perspectives.some(perspective=>perspective.id===view)) { throw new Error('Unknown view: '+view); }

  const builder=new StandaloneBuilder();
  const icons=await builder.collectIcons(model);

  if (command==='verify') {
    console.log(`Valid: ${model.resources.length} resources, ${model.perspectives.length} views, ${Object.keys(icons).length} icons.`);
    return;
  }

  const output=values.output ?? (input==='-' ? 'diagram.html' : resolve(parse(input).dir,parse(input).name+'.html'));
  const html=await builder.build(source,{perspective:view},icons);
  await writeFile(output,html,{flag:'wx'});
  console.log('Created '+output);
}

try { await run(); }
catch (error) { console.error('strata: '+error.message); process.exitCode=1; }
