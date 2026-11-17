# Strata guide

Create interactive architecture diagrams from text. Source defines items,
connections, perspectives, styles, and numbered notes. The browser provides
navigation, zoom, selection, and export. No runtime dependencies are required.

## Get started

Requires Node.js 20.11+. Run `npm run dev`, then open
[the local editor](http://127.0.0.1:4173).

```text
diagram "My system"

app web "Web application"
group backend "Backend" {
  subheader: "Core application boundary"
  line: dashed
  service api "API" {
    large-icon: false
    note 1 "Preserve request IDs." { position: top-right }
  }
  database db "PostgreSQL" { icon: "brands/brands_p/postgresql_icon.svg" }
}

web -> api "HTTPS"
api -> db "Query" {
  start { shape: dot; label: "Caller" }
  end { shape: arrow; label: "Store" }
  note 2 "Uses a read replica." { connector { label: "Read path"; line: dashed } }
}

view overview "System overview" { include: [web, backend] }
```

## Language basics

Declarations use concise headers; properties always use `key: value`. Related
properties use named blocks such as `layout`, `start`, `end`, and `connector`.

- Separate properties and leaf declarations with newlines or semicolons.
- Blocks can be inline or multiline; indentation is for readability.
- Use double-quoted strings with JSON escapes, explicit booleans, and bare enums.
- Lists use `[a, b]`, support multiple lines, and allow a trailing comma.
- `#` starts a comment outside strings.
- IDs start with a letter or underscore, followed by letters, digits, `_`, `.`,
  or `-`. Item IDs are global, even when nested.
- Item and type references can precede their declarations.
- Unknown, duplicate, and wrong-scope properties are errors. Syntax errors
  identify the line and column.

See [the complete grammar and defaults](../src/dsl/README.md).

## Items, containers, and custom types

Built-in types are `app`, `service`, `database`, `infrastructure`, `external`, and
`group`. Any item becomes a container when it has children. `group` represents
an organizational boundary with no specific architectural role; empty groups
are valid. Types affect default styling, not diagram behavior.

```text
type queue {
  color: "#e6b86a"
  background: "#182333"
  icon: "svgs/solid/server.svg"
  line: dashed
  large-icon: false
  subheader: "Async work"
}
queue jobs "Jobs"
queue events "Events" {
  line: solid
  large-icon: true
  icon: null
  subheader: ""
}
```

The same style properties work on built-in type declarations and individual
items. Item properties override type defaults. Formatting preserves inheritance;
changing the type still updates items without explicit overrides. Defaults apply
to an item's own type, not to its descendants.

| Property | Behavior |
| --- | --- |
| `color` | Border, accent, neutral-icon tint, and selected connection colors; quoted six-digit hex. |
| `background` | Item/container fill; quoted six-digit hex. |
| `icon` | Bundled icon path relative to `icons/`; `null` clears inheritance. |
| `large-icon` | Boolean; `false` hides the decorative icon, keeping the header icon. |
| `line` | `solid` or `dashed` item border. |
| `subheader` | Secondary text; empty string clears inheritance. |
| `description` | Longer explanation shown when the Description control is enabled. Item-only. |

There are seven themes. Custom types without a color use the theme's muted
color. Colored icons retain their colors; neutral icons use the item accent.
Offline exports embed referenced icons, including inherited icons. Missing files
prevent incomplete exports. See [custom types](../src/items/types/README.md).

## Connections and endpoints

```text
api -> jobs "Publish" {
  line: dashed
  start { shape: dot; label: "Producer" }
  end { shape: circle; label: "Inbox" }
}
```

The middle label is optional. It can appear after the target ID or as `label:`
inside the block. Start/end labels are independent. All labels follow the Labels
control; symbols remain visible when labels are hidden.

Endpoint shapes are `dot` (filled circle), `circle` (hollow), `arrow`, `asterisk`,
`square`, and `none`. Defaults are no start symbol and an end arrow. Endpoint
labels shrink or truncate to fit and can be omitted when no clear space exists.
Symbols stay solid on dashed connections. Different endpoint meanings remain
separate during deduplication and collapse. See
[connection endpoints](../src/connections/endpoints/README.md).

Connections outside views are global, including connections nested in item
blocks. IDs are always global; nesting does not introduce relative references.
Canonical formatting moves global connections after item declarations.

## Views

```text
view checkout "Checkout" {
  description: "Only checkout dependencies."
  include: [web, backend]
  relations: local
  api -> db "Read"
  detail: 0.8
  layout { sizes: proportional; compactness: 0.7 }
}
```

- `include` selects explicit items. Selecting a container includes descendants.
- Omit `include` to infer membership; use `include: []` for no explicit context.
- Local connection endpoints and item-note targets are included automatically.
- Without explicit inclusion, local connections/attached notes determine
  membership. If neither exists, inherited connections determine membership.
- Ancestors of visible items are included as context.
- `relations: inherit` includes applicable global connections, plus local ones.
- `relations: local` uses only connections declared in that view.
- Identical global and local connections merge their notes.
- No views means an automatic overview containing all root items.

## Numbered notes

```text
note 1 "General explanation"
service api "API" {
  note 2 "Keep request IDs." {
    position: top-right
    font-size: 18
    connector { label: "Retry contract"; line: dashed }
  }
}
service db "Database"
api -> db "Query" {
  note 3 "Read-only." { connector {} }
}
view checkout "Checkout" {
  include: [api, db]
  note 4 "Checkout-only detail." { on: api; position: left }
}
```

Document-level unattached notes appear across views. Item and connection notes
attach to their declaration's target. View notes appear only in that view;
`on: ID` attaches a document/view note to an existing item. This adds to global
item notes rather than replacing them. Note numbers are positive safe integers
and unique across the diagram.

| Property / block | Behavior |
| --- | --- |
| `on` | Item ID; available only on document/view notes. |
| `position` | Item mark location: `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`, `bottom-left`, `left`. |
| `font-size` | Positive finite size, including decimals; default 14. |
| `connector` | Optional item/connection annotation line. Empty block enables a solid, unlabeled line. |
| Connector `label` | Optional quoted label. |
| Connector `line` | `solid` or `dashed`; default `solid`. |

Unattached notes cannot have connectors or mark positions. Connection marks
cannot use item positions. Marks stack along the chosen edge; note blocks wrap
at eight columns. Collapsed groups collect visible descendant item marks; internal
connection notes disappear with their connections.

Notes start dimmed. Select an item to reveal related notes or select a mark/block
to focus one explanation. Enter/Space activates notes; Escape clears selection.
Show notes toggles marks, blocks, and connectors. See [notes](../src/notes/README.md).

## Layout and detail

```text
group backend "Backend" {
  layout { sizes: uniform; compactness: 0.8 }
  service api "API"
  database db "Database"
}
view overview "Overview" {
  include: [backend]
  detail: 0.7
  layout { sizes: proportional; compactness: 0.6 }
}
```

`layout` works on items and views. Item settings control their children; view
settings control the view. `sizes` is `auto`, `uniform`, or `proportional`.
`compactness` ranges from 0.1 to 1; larger values reduce gaps. Defaults are
`auto` and 0.6. View `detail` ranges from 0 to 1 and defaults to 1. Available
viewport size and zoom also affect adaptive collapse. Manual collapses persist
across zoom changes.

Dense graphs can require shared routes and crossings. Labels can truncate or
hide; tooltips retain full endpoint labels. Routing is deterministic, not planar
or optimal in every case.

## Editor, save, and export

- Source edits update the preview after a short debounce. Invalid source leaves
  the last valid preview visible.
- Format produces canonical multiline source and discards comments.
- Perspective, Resource, Theme, Detail, zoom, and collapse controls affect the
  preview. Description opens an item's explanation.
- Click an item to reveal direct connections; double-click to collapse/expand.
  Hover reveals direct connections when nothing is selected.
- Source exports `.strata`; Import accepts `.strata` or the existing JSON model.
- SVG exports the current view. Offline HTML embeds the complete model, source,
  renderer, styles, and referenced icons without external assets.
- Source is saved locally under this grammar's storage key. Older saved DSL is
  retained under its previous key and is not loaded or migrated automatically.

The DSL has changed intentionally; old syntax is unsupported. JSON field names
remain unchanged. See [the DSL mapping](../src/dsl/README.md#formatting-and-json).

## Built-in and workflow examples

The [commerce example](../src/example.strata) follows checkout through delivery
and returns, with focused views and 14 notes. Compare Order lifecycle with Browse
& checkout to see view-specific detail. The [workflow examples](../examples/)
cover subscriptions, data pipelines, and release delivery. All use the new grammar.

`npm run build` validates source and regenerates ignored `dist/example.js` and
`dist/standalone.html`. Do not hand-edit generated files.

## Embed and develop

Import `parseStrata` and `formatStrata` from `src/language.js`; import
`StrataDiagram`, `DiagramLayout`, and `validateModel` from `src/framework.js`.
The embedding application owns navigation state and re-renders through injected
selection/collapse callbacks. `diagram.exportSvg()` settles motion before export;
`{animate:false}` disables SVG motion. Source is never evaluated as code.

| Limit | Value |
| --- | --- |
| Source | 1 MB |
| Items / total connections / views | 300 / 1,000 / 30 |
| Item nesting | 12 parent levels |
| Type declarations / type name length | 100 / 100 characters |
| Notes / note text | 1,000 / 1–5,000 characters |
| Subheaders / connection and annotation labels | 500 characters |

Run `npm run check`, `npm test`, `npm run build`, and `npm run build:pages`.
The lexer, parser, formatter, grammar reference, and grammar tests live together
in `src/dsl/`; `src/language.js` is the public integration point. Existing model,
rendering, routing, and note features remain in their feature folders.
