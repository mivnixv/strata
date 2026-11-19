import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Package version is the source of truth for GitHub tags and artifacts. */
export class ReleaseVersion {
  constructor(version) {
    const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);

    if (!match || match[4]?.split('.').some(id=>/^\d+$/.test(id) && id.length>1 && id[0]==='0')) {
      throw new Error('Release version must be SemVer, such as 1.2.3 or 1.2.3-beta.1.');
    }

    this.version=version; this.prerelease=Boolean(match[4]);
    this.tag='v'+version;
  }
  assertTag(tag) {

    if (tag!==this.tag) { throw new Error(`Release tag ${tag} must match package version ${this.tag}.`); }

  }
  assertPrerelease(flag) {

    if (flag!==String(this.prerelease)) { throw new Error('GitHub prerelease flag must match the package version prerelease suffix.'); }

  }
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const metadata=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
    const version=new ReleaseVersion(metadata.version);
    version.assertTag(process.argv[2]); version.assertPrerelease(process.argv[3]);
    console.log(`Validated release ${version.tag} (${version.prerelease ? 'prerelease' : 'stable'}).`);
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
