import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { parseStrata } from '../src/language.js';

const entry=fileURLToPath(new URL('strata.mjs',import.meta.url));
const root=new URL('../',import.meta.url);
const source="diagram \"CLI example\"\nservice api \"API\"\ndatabase db \"DB\"\napi -> db \"Read\"\nview overview \"Overview\" {\n include: [api, db]\n}\nview storage \"Storage\" {\n include: [db]\n}\n";
const run=(cwd,args,input,cli=entry)=>spawnSync(process.execPath,[cli,...args],{cwd,input,encoding:'utf8',timeout:15000});
const bootstrap=html=>JSON.parse(html.match(/<script id="strata-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1]);

async function workspace(t) {
  const directory=await mkdtemp(join(tmpdir(),'strata-cli-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'input.strata'),source);
  return directory;
}

test('verify validates input without producing output',async t=>{
  const cwd=await workspace(t);
  const result=run(cwd,['verify','input.strata']);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Valid: 2 resources, 2 views/);
  await assert.rejects(readFile(join(cwd,'input.html')), {code:'ENOENT'});
});

test('build preserves source, embeds a selected view, and emits executable offline HTML',async t=>{
  const cwd=await workspace(t);
  const result=run(cwd,['build','input.strata','--view','storage','-o','out.html']);
  assert.equal(result.status,0,result.stderr);
  const html=await readFile(join(cwd,'out.html'),'utf8');
  assert.deepEqual(bootstrap(html),{source,presentation:{perspective:'storage'},icons:{}});
  assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|@import/i);
  assert.doesNotThrow(()=>new Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]));
  assert.ok(!html.includes(cwd));
  assert.ok(!html.includes('Amazon-style commerce'));
});

test('supports stdin, default output, and compatible JSON',async t=>{
  const cwd=await workspace(t);
  const result=run(cwd,['build','-'],JSON.stringify(parseStrata(source)));
  assert.equal(result.status,0,result.stderr);
  const saved=bootstrap(await readFile(join(cwd,'diagram.html'),'utf8'));
  assert.deepEqual(parseStrata(saved.source),parseStrata(source));
  assert.equal(saved.presentation.perspective,'overview');
  assert.equal(run(cwd,['build','input.strata']).status,0);
  await readFile(join(cwd,'input.html'));
});

test('rejects invalid syntax, references, views, and arguments without writing output',async t=>{
  const cwd=await workspace(t);
  for (const [input,extra,diagnostic] of [
    ['service api "API" {',[],/missing/i],
    ['service api "API"\napi -> absent',[],/reference|unknown/i],
    [source,['--view','absent'],/Unknown view/],
    [source,['--unknown'],/Unknown option/],
    [source,['--icons','some-directory'],/Unknown option/]
  ]) {
    const result=run(cwd,['build','-','-o','invalid.html',...extra],input);
    assert.equal(result.status,1);
    assert.match(result.stderr,diagnostic);
    await assert.rejects(readFile(join(cwd,'invalid.html')),{code:'ENOENT'});
  }
  assert.equal(run(cwd,['verify','input.strata','-o','bad.html']).status,1);
  const removedOption=run(cwd,['verify','input.strata','--icons','some-directory']);
  assert.equal(removedOption.status,1);
  assert.match(removedOption.stderr,/Unknown option/);
});

test('existing output and source files cannot be overwritten',async t=>{
  const cwd=await workspace(t);
  await writeFile(join(cwd,'out.html'),'keep me');
  for (const output of ['out.html','input.strata']) {
    const result=run(cwd,['build','input.strata','-o',output]);
    assert.equal(result.status,1);
    assert.match(result.stderr,/EEXIST/);
  }
  assert.equal(await readFile(join(cwd,'out.html'),'utf8'),'keep me');
  assert.equal(await readFile(join(cwd,'input.strata'),'utf8'),source);
});

test('embeds bundled icons and builds without a dist directory or prior build',async t=>{
  const cwd=await workspace(t);
  for (const folder of ['src','standalone','cli']) {
    await cp(new URL(folder+'/',root),join(cwd,folder),{recursive:true});
  }
  await cp(new URL('package.json',root),join(cwd,'package.json'));
  await mkdir(join(cwd,'icons','svgs','solid'),{recursive:true});
  const svg=await readFile(new URL('icons/svgs/solid/server.svg',root),'utf8');
  await writeFile(join(cwd,'icons','svgs','solid','server.svg'),svg);
  const input="service api \"API\" {\n icon: \"svgs/solid/server.svg\"\n}";
  const args=['build','-','-o','bundled.html'];
  const result=run(cwd,args,input,join(cwd,'cli','strata.mjs'));
  assert.equal(result.status,0,result.stderr);
  const saved=bootstrap(await readFile(join(cwd,'bundled.html'),'utf8'));
  assert.equal(saved.icons['svgs/solid/server.svg'],'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));
  for (const command of ['verify','build']) {
    const missing=run(cwd,[command,'-'],"service api \"API\" {\n icon: \"missing.svg\"\n}");
    assert.equal(missing.status,1);
    assert.match(missing.stderr,/Cannot read icon: missing.svg/);
  }
});

test('enforces the input byte limit for files and stdin',async t=>{
  const cwd=await workspace(t);
  const oversized=' '.repeat(1_000_001);
  await writeFile(join(cwd,'large.strata'),oversized);
  for (const input of ['large.strata','-']) {
    const result=run(cwd,['verify',input],input==='-' ? oversized : undefined);
    assert.equal(result.status,1);
    assert.match(result.stderr,/under 1 MB/);
  }
});
