# Strata

Create interactive architecture diagrams from text. Export SVG or a single HTML
file that works offline. No runtime dependencies.

[Open the builder](https://mivnixv.github.io/strata/) to edit diagrams in your browser.

## Quick start

Requires Node.js 20.11+. No dependency installation needed.

```sh
git clone https://github.com/mivnixv/strata.git
cd strata
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173) for the editor and live preview.

## Define a diagram

Save as `architecture.strata`:

```text
diagram "My system"

app web "Web app"
service api "API"
database db "Database" {
  icon "brands/brands_p/postgresql_icon.svg"
}

web -> api : "HTTPS"
api -> db : "SQL"
```

## Validate and export

Run directly from GitHub with Node.js 20.11+; no manual clone or npm release needed:

```sh
npx --yes github:mivnixv/strata verify architecture.strata
npx --yes github:mivnixv/strata build architecture.strata -o architecture.html
```

`npx` downloads the package into its cache. From an existing checkout, use:

```sh
npm run cli -- verify architecture.strata
npm run cli -- build architecture.strata -o architecture.html
```

Open `architecture.html` in a browser or share it. Referenced icons are embedded;
no server or internet connection is needed. Existing output files are never overwritten.

## Icons

Add `icon "path/to/icon.svg"` inside a resource block, as shown above.
Paths are relative to the bundled [`icons/`](icons/) directory; omit the `icons/` prefix.
Browse [`brands/`](icons/brands/), [`AWS`](icons/aws19/),
[`Kubernetes`](icons/kubernetes/), or [`general icons`](icons/svgs/).
Bundled icons also work through `npx` without downloading them separately.

Standalone HTML embeds the referenced bundled icons.

[CLI options](cli/README.md) · [Full guide](docs/guide.md) · [GitHub Pages setup](publishing/README.md)

## Development

```sh
npm run check
npm test
```

[MIT License](LICENSE)
