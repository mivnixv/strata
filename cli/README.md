# Strata CLI

Requires Node.js 20.11+. No installation, dependencies, or prior build required.
Run from the repository root:

```sh
node cli/strata.mjs verify architecture.strata
node cli/strata.mjs generate architecture.strata -o architecture.html
node cli/strata.mjs build architecture.strata -o architecture.html
node cli/strata.mjs build architecture.strata --view overview -o overview.html
cat architecture.strata | node cli/strata.mjs build - -o diagram.html
```

`npm run cli -- <arguments>` also works. Linking the checkout with `npm link`
exposes the `strata` command.

`generate` and `build` are aliases. `strata --version` (or `strata -v`) reports
the package version without loading a diagram. Run a GitHub release artifact:

```sh
npx --yes --package https://github.com/mivnixv/strata/releases/download/v1.0.0/strata-diagrams-1.0.0.tgz strata generate architecture.strata -o architecture.html
```

Use an available release version in both the tag and filename. See
[versioning and release artifacts](../publishing/release/README.md) for the
GitHub release workflow. No npm account or registry publication is needed.

Input accepts Strata text or compatible JSON models. JSON is detected by its
opening brace. Validation covers syntax, resource/reference rules, model limits,
and readability of every referenced icon. `build` additionally checks `--view`.
Validation is structural; it does not guarantee a crossing-free layout.

Icon paths resolve within the bundled `icons/` directory. Use paths relative to
that directory, without the `icons/` prefix.

Build outputs one interactive HTML viewer with the source, selected initial view,
renderer, styles, and referenced icons embedded. It opens directly from disk
without network access. The default initial view is the first declared view.
No Git identity, input path, or build timestamp is added to the HTML.
Source text is embedded verbatim, including comments and descriptions; remove
anything private before sharing. JSON input is normalized to Strata text.

The default output is next to the input, replacing its extension with `.html`;
stdin defaults to `diagram.html` in the current directory. Existing files are
never overwritten. Invalid input exits with status 1 and creates no HTML file.

Run CLI integration tests with `node --test cli/strata.test.mjs`.
