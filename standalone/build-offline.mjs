import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseStrata } from '../src/language.js';
import { StandaloneBuilder } from '../cli/standalone-builder.mjs';

const output=new URL('../dist/',import.meta.url);
const source=await readFile(new URL('../src/example.strata',import.meta.url),'utf8');
const example=parseStrata(source);
const offline=await new StandaloneBuilder().build(source,{perspective:'orders'});
await mkdir(output,{recursive:true});
await writeFile(new URL('example.js',output),'// Generated from example.strata by npm run build.\nexport const example = '+JSON.stringify(example,null,2)+';\n');
await writeFile(new URL('standalone.html',output),offline);
console.log(`Built dist/standalone.html (${Buffer.byteLength(offline)} bytes); no external assets.`);
