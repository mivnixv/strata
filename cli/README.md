# Strata CLI

Requires Node.js 20.11+. No installation, dependencies, or prior build required.
Run from the repository root:

```sh
node cli/strata.mjs verify architecture.strata
node cli/strata.mjs build architecture.strata -o architecture.html
node cli/strata.mjs build architecture.strata --view overview -o overview.html
cat architecture.strata | node cli/strata.mjs build - -o diagram.html
```

`npm run cli -- <arguments>` also works. Linking the checkout with `npm link`
exposes the `strata` command.

Input accepts Strata text or compatible JSON models. JSON is detected by its
opening brace. Validation covers syntax, resource/reference rules, model limits,
and readability of every referenced icon. `build` additionally checks `--view`.
Validation is structural; it does not guarantee a crossing-free layout.

Icons default to the repository's `icons/` directory. Use `--icons /path/to/icons`
to select another root; IDs in the source remain relative to that root.

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
