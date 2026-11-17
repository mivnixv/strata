# Strata

Create interactive architecture diagrams from text. Export SVG or a single HTML
file that works offline. No runtime dependencies.

[Open the builder](https://mivnixv.github.io/strata/) to edit diagrams in your browser.

## Features

- **Diagrams as text:** define apps, services, databases, infrastructure,
  external systems, and generic groups with nested containers and labelled relationships.
- **Automatic layout:** hierarchical tiles and routed connections, with
  collapsible groups, zoom, and adaptive detail.
- **Item subheaders:** add custom secondary text with `subheader: "Text"` instead
  of automatic type labels, on both items and containers.
- **Custom types:** declare arbitrary item types and default colors, backgrounds,
  icons, and other styles. One item color controls borders, accents, and selected connections. Individual items can override defaults.
- **Perspectives:** show focused views with shared or view-specific relationships.
- **Connection and border styles:** solid or dashed connections, plus dashed
  container and item borders.
- **Connection endpoints:** independent start/end labels and dot, circle, arrow,
  asterisk, square, or no symbol at either end.
- **Numbered notes:** attach notes to items, containers, or connections; add
  standalone or view-specific notes. Use `note 1 "Text" {;   on: api; }` inside a view
  for view-only item detail alongside global notes. Item marks use dashed circles
  and default to top-left.
- **Mark positioning:** place item marks at any corner or side with `position`.
  Multiple marks stack along the chosen edge; connectors follow their marks,
  including when their item is collapsed.
- **Notebook blocks:** compact ruled pages use eight equal columns and wrap after
  eight notes. Text defaults to size 14; `font-size` accepts custom decimal sizes.
- **Optional note connectors:** connect note blocks to their numbered marks with
  labelled solid or dashed lines, or show just a mark and note.
- **Note focus and visibility:** notes, marks, and connectors start dimmed.
  Selecting an item reveals related notes; clicking a mark or block focuses only
  that note and its attachment. Enter/Space activates notes; Escape clears focus.
  **Show notes** toggles blocks, marks, and connectors together.
- **Animated transitions:** diagram elements and notes fade in and out, with
  smooth selection changes and support for reduced-motion preferences.
- **Themes and icons:** choose from seven themes and use bundled brand, cloud,
  Kubernetes, and general icons. Use `large-icon: false` to hide an item's large decorative
  icon while keeping its small header icon.
- **Browser editor:** live preview, source formatting, resource descriptions,
  JSON import, and local source persistence.
- **Portable exports:** export SVG or self-contained offline HTML with embedded
  icons. Validate and build diagrams from the CLI without runtime dependencies.
- **Built-in example:** explore an [order lifecycle](src/example.strata) with
  14 notes demonstrating attachments, mark positions, connector styles, font sizes,
  and view scope.

## Quick start

Requires Node.js 20.11+. No dependency installation needed.

```sh
git clone https://github.com/mivnixv/strata.git
cd strata
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173) for the editor and live preview.

## Define a diagram

Properties use `key: value`; named blocks group related settings. Inline blocks,
semicolons, and multiline lists are supported. See the [DSL reference](src/dsl/README.md).


Save as `architecture.strata`:

```text
diagram "My system"

app web "Web app"
service api "API" {
  subheader: "Handles incoming requests"
}
database db "Database" {
  icon: "brands/brands_p/postgresql_icon.svg"
}

web -> api "HTTPS"
api -> db "SQL"
```

Use `group backend "Backend" { ... }` to declare a generic container and nest items
inside its block. See [groups](src/items/group/README.md).

Declare custom types with `type queue { color: "#e6b86a" }` and use `queue jobs "Jobs"`. See
[custom types and default styles](src/items/types/README.md).

Set `line: dashed` in a connection block: `web -> api "HTTPS" { line: dashed }`.
Configure endpoint labels and symbols with `web -> api { start { shape: dot; label: "Client" } end { label: "API" } }`.
See [connection endpoints](src/connections/endpoints/README.md).
Add `line: dashed` inside a resource block for a dashed container or item border.
Use `note 1 "Text"` independently, inside an item block, or inside a connection block
to add a numbered note. See [notes](src/notes/README.md) and
[dashed borders](src/containers/dashed/README.md).

See [`examples/`](examples/) for complex subscription, data pipeline, and release workflows.

## Position note marks

Set `position` on a note inside an item or container block:

```text
service api "API" {
  note 1 "Uses the default top-left mark"
  note 2 "Checks requests" {
    position: top-right
  }
  note 3 "Preserves request IDs" {
    position: bottom
    font-size: 18
    connector {
      label: "Logging"
      line: dashed
    }
  }
}
```

Supported positions: `top-left` (default), `top`, `top-right`, `right`,
`bottom-right`, `bottom`, `bottom-left`, and `left`. The option positions the mark;
the notebook block stays in the notes grid. General and connection notes do not
accept item mark positions. See [note options](src/notes/README.md).

## Global and view-specific notes

Keep general notes at the top level and shared item notes inside the item.
Declare additional notes inside a view; `on api` attaches a view-only note to
an existing item:

```text
note 1 "Global context"
service api "API" {
  note 2 "Shared API explanation"
}

view checkout "Checkout" {
  note 3 "Checkout-only detail" {
    on: api
    position: right
    connector {
      line: dashed
    }
  }
}
view operations "Operations" {
  include: [api]
}
```

Checkout shows notes 1–3; Operations shows global notes 1–2. View notes add detail
without replacing global notes. Their item targets and ancestor containers are
included automatically. To add a view-only connection note, declare the same
connection inside the view with its note; matching global and local connections
merge and retain both sets of notes. Note numbers remain unique across views.

The [built-in example](src/example.strata) demonstrates this on the order item
and payment authorization connection. See [note scoping](src/notes/README.md#view-specific-notes-alongside-global-notes)
or the [guide](docs/guide.md#keep-global-notes-and-add-view-only-detail).

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

Add `icon: "path/to/icon.svg"` inside a resource block, as shown above.
Paths are relative to the bundled [`icons/`](icons/) directory; omit the `icons/` prefix.
Browse [`brands/`](icons/brands/), [`AWS`](icons/aws19/),
[`Kubernetes`](icons/kubernetes/), or [`general icons`](icons/svgs/).
Bundled icons also work through `npx` without downloading them separately.

Standalone HTML embeds the referenced bundled icons.

Add `large-icon: false` inside an item block to suppress its large decorative icon, even
when the card has room. The small header icon remains. See
[large icon visibility](src/items/no-large-icon/README.md).

[CLI options](cli/README.md) · [Full guide](docs/guide.md) · [GitHub Pages setup](publishing/README.md)

## Development

```sh
npm run check
npm test
```

## License

Copyright (c) 2026 mivnixv. Strata's original code is licensed under
[GNU GPL v3](LICENSE) (GPL-3.0-only). Commercial use and resale are permitted
under its terms. Third-party assets retain their applicable licenses.
