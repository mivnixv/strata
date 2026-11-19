# Versioning and releases

`package.json` is the version source. Git tags must be exactly `v<version>`.
Use standard SemVer releases (`1.2.3`) or prereleases (`1.2.3-beta.1`).
The release archive is named **strata-diagrams-<version>.tgz**; its executable
is **strata**. Distribution uses GitHub release assets. No npm account, registry
publication, or registry credentials are required.

## Create a release

From a clean, current `main` checkout:

```sh
npm version patch -m "Release v%s"
# Or: npm version minor / major / 1.2.3 / 1.2.3-beta.1
git push --atomic origin main --follow-tags
```

`npm version` runs syntax checks and the full test suite through `preversion`,
updates `package.json`, and creates the version commit and annotated tag. It
stops if checks fail. It does not push or publish anything.

In GitHub **Releases → Draft a new release**, select the pushed tag, generate
release notes, and publish. Alternatively, for a stable version:

```sh
gh release create v1.0.0 --verify-tag --generate-notes
```

For a prerelease, check **Set as a pre-release** in GitHub, or pass `--prerelease`
to `gh release create`. The workflow rejects mismatched tags, package versions,
or prerelease flags before building artifacts.

Publishing the GitHub release triggers `.github/workflows/release.yml`. It:

1. Checks out that exact tag and runs syntax checks and tests.
2. Builds and packs the CLI with its renderer, styles, and bundled icons.
3. Installs the tarball into an isolated npm cache with networking disabled,
   checks `--version`, and generates a diagram containing an embedded icon.
4. Attaches the tested `.tgz`, offline viewer HTML, and `SHA256SUMS` to the release.

The workflow uses GitHub-hosted runners and adds no runtime dependencies.
GitHub Actions usage is subject to the repository's normal Actions allowance;
no additional hosting service is needed.

## Run a pinned release

Run the exact version directly from its GitHub release artifact:

```sh
npx --yes --package https://github.com/mivnixv/strata/releases/download/v1.0.0/strata-diagrams-1.0.0.tgz strata generate architecture.strata -o architecture.html
```

Replace `1.0.0` in both the tag and filename with the desired released version,
including any prerelease suffix. `npx` installs the tarball into its local cache
and runs the bundled CLI. `build` remains an alias for `generate`; `--version`
reports the archive's package version.

The package is marked `private` to prevent accidental npm publication. This
still allows `npm pack` and `npx` installation from a release tarball.

See [npm version](https://docs.npmjs.com/cli/v11/commands/npm-version/) and
[GitHub release events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release).

## Test artifacts locally

```sh
npm run release:pack
# Optionally enforce the intended tag:
npm run release:pack -- v1.0.0
```

This builds and smoke-tests `dist/releases/` without committing, tagging,
uploading, or publishing. Node.js 20.11+ is required for the CLI; releases are
built on Node 24. Generated files stay ignored by Git.
