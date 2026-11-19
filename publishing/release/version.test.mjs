import test from 'node:test';
import assert from 'node:assert/strict';
import { ReleaseVersion } from './version.mjs';

test('stable releases bind an exact v-prefixed tag to the package version',()=>{
  const version=new ReleaseVersion('1.2.3');
  version.assertTag('v1.2.3'); version.assertPrerelease('false');
  assert.equal(version.prerelease,false);
  assert.throws(()=>version.assertTag('1.2.3'),/must match/);
  assert.throws(()=>version.assertTag('v1.2.4'),/must match/);
  assert.throws(()=>version.assertPrerelease('true'),/prerelease flag/);
});

test('prereleases require matching GitHub prerelease metadata',()=>{
  for (const suffix of ['beta.1','rc.0','alpha-next.12','0']) {
    const version=new ReleaseVersion('1.2.3-'+suffix);
    version.assertTag('v1.2.3-'+suffix); version.assertPrerelease('true');
    assert.equal(version.prerelease,true);
    assert.throws(()=>version.assertPrerelease('false'),/prerelease flag/);
  }
});

test('invalid version formats fail before release commands can run',()=>{
  for (const version of ['',undefined,'v1.2.3','1.2','01.2.3','1.02.3','1.2.03','1.2.3-','1.2.3-beta..1','1.2.3-beta.01','1.2.3+metadata','1.2.3\n']) {
    assert.throws(()=>new ReleaseVersion(version),/SemVer/,String(version));
  }
});
