import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReleaseVersion } from './version.mjs';

/** Build once, smoke-test the packed CLI, and checksum the exact release files. */
class ReleaseArtifacts {
  constructor({root=fileURLToPath(new URL('../../',import.meta.url)),run=execFileSync}={}) {
    this.root=root; this.run=run;
  }
  command(args,cwd=this.root) {
    return this.run('npm',args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:4_000_000});
  }
  async smoke(tarball,workspace,version) {
    const args=['exec','--offline','--yes','--ignore-scripts','--cache',join(workspace,'cache'),'--','file:'+tarball];
    const actual=this.command([...args,'--version'],workspace).trim();

    if (actual!==version.version) { throw new Error('Packed CLI version does not match the release.'); }

    await writeFile(join(workspace,'input.strata'),'service api "API" { icon: "svgs/solid/server.svg" }\ndatabase db "DB"\napi -> db\nview overview "Overview" { include: [api, db] }\n');
    this.command([...args,'generate','input.strata','--view','overview','-o','diagram.html'],workspace);
    const html=await readFile(join(workspace,'diagram.html'),'utf8');

    if (!html.includes('data:image/svg+xml;base64,') || !html.includes('strata-bootstrap')) { throw new Error('Packed CLI did not generate an offline diagram with bundled icons.'); }

  }
  async build(tag) {
    const metadata=JSON.parse(await readFile(join(this.root,'package.json'),'utf8'));
    const version=new ReleaseVersion(metadata.version);

    if (tag!==undefined) { version.assertTag(tag); }

    const output=join(this.root,'dist','releases');
    const workspace=await mkdtemp(join(tmpdir(),'strata-release-'));
    try {
      await mkdir(output,{recursive:true});
      this.command(['run','build']);
      const [packed]=JSON.parse(this.command(['pack','--json','--cache',join(workspace,'cache'),'--pack-destination',output]));
      const tarball=join(output,packed.filename);
      await this.smoke(tarball,workspace,version);
      const htmlName=`strata-${version.version}.html`;
      await copyFile(join(this.root,'dist','standalone.html'),join(output,htmlName));
      const checksums=[];
      for (const name of [packed.filename,htmlName]) {
        const bytes=await readFile(join(output,name));
        checksums.push(createHash('sha256').update(bytes).digest('hex')+'  '+name);
      }
      await writeFile(join(output,'SHA256SUMS'),checksums.join('\n')+'\n');
      console.log(`Release artifacts: ${output}\nPacked npx smoke test passed (${version.tag}).`);
    } finally { await rm(workspace,{recursive:true,force:true}); }
  }
}

try { await new ReleaseArtifacts().build(process.argv[2]); }
catch (error) { console.error(error.message); process.exitCode=1; }
