# Strata guide

Create interactive architecture diagrams from text. The browser canvas provides
navigation and selection; the source defines resources, relationships, views,
and notes. No runtime dependencies are required.

## Contents

1. [Get started](#get-started)
2. [Language basics](#language-basics)
3. [Items and containers](#items-and-containers)
4. [Connections and perspectives](#connections-and-perspectives)
5. [Numbered notes](#numbered-notes)
6. [Layout and detail](#layout-and-detail)
7. [Editor and navigation](#editor-and-navigation)
8. [Save and export](#save-and-export)
9. [Built-in example](#built-in-example)
10. [Embed the framework](#embed-the-framework)
11. [Limits and development](#limits-and-development)

## Get started

Requires Node.js 20.11 or newer. From the repository root:

```sh
npm run dev
```

Open [the local editor](http://127.0.0.1:4173). This command also builds the offline
HTML template; no dependency installation is needed.

Paste the following into the editor or save it as `architecture.strata` and import it:

```text
diagram "My system"

app web "Web application"
service platform "Application platform" {
  subheader "Core application boundary"
  dashed
  service api "API" {
    subheader "Validates incoming requests"
    noLargeIcon
    note 1 "Preserve request IDs across retries." position top-right
  }
  database db "PostgreSQL" {
    icon "brands/brands_p/postgresql_icon.svg"
  }
}

web -> api : "HTTPS"
api -> db : "Query" note 2 "Uses a read replica." connect : "Read path" dashed

view overview "System overview" {
  include web, platform
}
```

## Language basics

| Element | Rule |
| --- | --- |
| Statements | One statement per line; closing braces occupy their own line. |
| Hierarchy | Braces define nesting. Indentation is for readability. |
| Item declaration | `TYPE ID "Display name"`, optionally followed by `{`. |
| Types | `app`, `service`, `database`, `infrastructure`, `external`. |
| IDs | Start with a letter or underscore; then letters, digits, `_`, `.`, or `-`. Resource IDs are unique; view IDs are unique within views. |
| Strings | Double-quoted, with JSON escapes such as `\"` and `\n`. |
| Comments | `#` outside a quoted string starts a comment. |
| References | Connections may reference items declared later. |

Inline blocks and semicolons are unsupported. Without explicit views, Strata
creates a system overview automatically.

## Items and containers

An item becomes a container when other items are nested inside its block.
Resource types determine icons and colors; cards do not display automatic type
names.

### Item options

| Option | Example | Behavior |
| --- | --- | --- |
| Subheader | `subheader "Request entry point"` | Optional text below the title; at most 500 characters. |
| Description | `description "Longer explanation"` | Details shown when selecting an item with **Description** enabled; at most 5,000 characters. |
| Icon | `icon "svgs/solid/server.svg"` | Replaces the header glyph and any large decorative icon. |
| Hide large icon | `noLargeIcon` | Suppresses the large decorative icon; keeps the small header icon. |
| Dashed border | `dashed` | Uses a dashed item/container border; solid is the default. |
| Note | `note 1 "Details"` | Attaches a numbered note to this item. |
| Layout | `sizes proportional`, `compactness 0.8` | Controls layout of this container's children. |

Options apply to their item, including its collapsed form. They do not
automatically apply to descendants.

### Subheaders

Subheaders render on leaf items and expanded/collapsed groups. They shrink or
truncate to fit. Omission or an empty string shows no secondary text on a leaf
or expanded group. A collapsed group without a custom subheader retains its
component-count summary. A custom subheader replaces that summary.

See [item subheaders](../src/items/subheader/README.md).

### Icons

Icon paths are relative to the bundled `icons/` directory; omit the `icons/`
prefix. A large decorative icon appears only when a leaf or collapsed group has
enough space. Expanded containers show only the small header icon.

```text
service api "API" {
  icon "svgs/solid/server.svg"
  noLargeIcon
}
```

`noLargeIcon` suppresses both custom and generated large icons without changing
card size or layout. Offline HTML embeds referenced icons; offline edits can
reuse those icon IDs. Missing icon files prevent incomplete exports.

See [large icon visibility](../src/items/no-large-icon/README.md).

## Connections and perspectives

### Connections

```text
service api "API"
infrastructure queue "Queue"

api -> queue : "Publish event" dashed
queue -> api
```

Labels are optional. Append `dashed` after the optional label; otherwise the
connection is solid. This option is independent of an item's border style.
Connections may also carry [notes](#numbered-notes).

Duplicate connections with the same `(from, to, label, dashed)` are drawn once,
merging their notes. Different labels or stroke styles remain distinct.

See [dashed connections](../src/connections/dashed/README.md) and
[dashed borders](../src/containers/dashed/README.md).

### Perspectives

Connections outside views are global. A view inherits applicable global
connections by default and can add local ones:

```text
app web "Web"
service api "API"
database db "Database"
api -> db : "SQL"

view checkout "Checkout" {
  description "Customer request flow"
  include web, api, db
  web -> api : "Place order"
}

view audit "Audit only" {
  relations only
  api -> db : "Write audit record"
}
```

| View directive | Behavior |
| --- | --- |
| `include api, db` | Selects items explicitly; including a container includes its descendants. |
| Omitted `include` | Local connection endpoints determine membership; if there are no local connections, inherited globals determine it. |
| Empty `include` | Adds no explicit items; local endpoints still participate. |
| `relations only` | Disables inherited global connections for this view. |
| `description "Text"` | Stores a view explanation in the model. |
| `note 1 "Context"` | Adds a standalone note visible only in this view. |

Local endpoints and their ancestor context are always included, without
unrelated siblings. Local relationships never appear in other views.

## Numbered notes

### Attachments

```text
note 1 "General architecture context"
service api "API" {
  note 2 "Item attachment with a mark, without a connector"
  note 3 "Another item note" position right fontSize 18 connect : "Details" dashed
}
database db "Database"
api -> db : "Query" note 4 "Connection attachment" connect solid

view operations "Operations" {
  include api, db
  note 5 "Standalone note for this view only"
}
```

| Declaration location | Attachment |
| --- | --- |
| Top level | Standalone note, visible across views; no mark. |
| Inside an item/container block | Item note with a numbered mark. |
| After a connection | Connection note with a mark near the route. |
| Inside a view | Standalone note scoped to that view. |

Numbers must be positive safe integers, unique across the entire diagram.
Multiple notes may follow a connection. Text must be nonempty, at most 5,000
characters; `\n` inserts a line break.

### Note options

| Option | Default | Applies to |
| --- | --- | --- |
| `fontSize 18.5` | `14` SVG pixels | All note bodies; any positive finite number. |
| `position top-right` | `top-left` | Item/container marks only. |
| `connect` | No connector | Item and connection notes with a mark. |
| `connect : "Label" dashed` | Solid line, empty label when omitted | Optional block-to-mark connector. |

`fontSize`, `position`, and `connect` may appear in any order. Append `solid` or
`dashed` immediately after the optional connector label. Omitting `connect`
shows just the note and its mark. Standalone notes cannot have connectors or
item mark positions.

### Mark positions

Supported positions: `top-left`, `top`, `top-right`, `right`, `bottom-right`,
`bottom`, `bottom-left`, and `left`.

Marks sit just outside the selected corner or side. Multiple marks stack along
that edge, then outward. Collapsed descendant notes use their chosen position on
the visible collapsed owner. Annotation connectors follow the actual mark.

### Notebook layout and visibility

- Notes appear in number order as compact ruled blocks in eight equal columns.
- Rows wrap after eight notes; partially filled rows do not stretch their blocks.
- Font size controls text wrapping, line spacing, and block height. Marks and
  connector labels retain their own sizes.
- Blocks, marks, and connectors start at 25% opacity.
- Selecting an item reveals its related blocks/marks; related connectors use
  50% opacity. Unrelated notes remain dimmed. Colors do not change.
- Clicking a mark or block focuses only that note and its item or connection.
  Connection endpoints stay visible; other notes on the same item also dim.
- **Show notes** toggles blocks, marks, and annotation connectors together.
- Notes follow view membership. Collapsed items collect descendant marks;
  bundled connections retain their notes. Hidden internal connections hide
  their notes until expanded.

Blocks, marks, and connectors fade with the diagram. Enter/Space activates a
focused mark or block; Escape or empty canvas clears note focus.

See the [complete note reference](../src/notes/README.md).

## Layout and detail

| Setting | Values | Scope |
| --- | --- | --- |
| `sizes` | `auto` (default), `uniform`, `proportional` | Resource or view. |
| `compactness` | `0.1`–`1`, default `0.6` | Resource or view; larger values narrow gaps. |
| `detail` | `0`–`1`, default `1` | Initial value inside a view. |

`uniform` equalizes sibling minimum dimensions and weights. `proportional` gives
more space to more-connected resources. `auto` chooses uniform for equal
connection counts and proportional otherwise. Readable minimum sizes still apply.

```text
service backend "Backend" {
  sizes proportional
  compactness 0.8
  service api "API"
  service worker "Worker"
}
view overview "Overview" {
  include backend
  sizes auto
  compactness 0.6
  detail 0.75
}
```

Each container is laid out independently. Connected children use dependency
columns; first appearance in the connection list determines peer order.
Unconnected items use stable compact packing. Cycles are broken deterministically
for placement without reversing relationships.

Detail uses viewport width and zoom to compare children against a pixel budget.
`0` rolls groups up; `1` shows all non-manually-collapsed children. Measurements
use a stable full-detail baseline to avoid layout oscillation. Manual collapses
persist across zoom; expanding a rolled-up group returns to full detail.

## Editor and navigation

### Editing

| Control | Behavior |
| --- | --- |
| Source editor | Updates the preview after 300 ms; invalid input retains the last valid preview. |
| Ctrl/Cmd+Enter | Applies source immediately. |
| Tab | Inserts two spaces in the editor. |
| Format | Canonicalizes valid source and removes comments. |
| Import | Accepts `.strata`, `.txt`, or compatible JSON. |
| New | Downloads the previous source before loading a starter. |

### Canvas controls

| Action | Behavior |
| --- | --- |
| Select an item | Reveals its direct connections, endpoints, and related notes; dims unrelated content. |
| Select a group | Keeps its visible descendants readable; reveals only the group's own direct connections. |
| Click a note/mark | Focuses that specific note and attachment. |
| Double-click a group / Space on a focused group | Collapses or expands it. |
| Wheel/trackpad over the canvas | Zooms around the pointer, within 40–300%. |
| **Description** | Shows the selected item's description. Closing the popup dismisses it without clearing selection. |
| Empty canvas / Escape | Clears selection. |

Selection does not change view membership or expand collapsed groups. View,
zoom, detail, selection, and collapse state do not modify source.

### Connection visibility and collapse

Uncovered connections stay visible. Covered crossings/overlapping routes dim to
10% opacity, with bright ends fading into the body. Without selection, hovering
an item reveals its direct connections. Item/note focus takes precedence over
hover, including for items without connections.

Collapsed groups bundle external relationships into separate incoming/outgoing
trunks per side, branching toward external items. Parallel bundled relationships
show a count; tooltips retain their original labels. Internal connections hide
until expansion. Solid and dashed bundles remain distinct.

### Animations

Resources move and resize during view/detail/collapse changes. Selection opacity
changes ease smoothly; note geometry changes crossfade. New input interrupts the
current animation rather than queuing transitions.

Animations respect `prefers-reduced-motion`, including changes during playback.
Exports settle active animations before serialization.

## Save and export

### Browser source and SVG

The last valid server-mode source is saved in this browser's local storage.
Storage is not shared or synchronized. Export `.strata` for backups or Git.
SVG export captures the current view, collapse state, and note visibility.

### CLI

```sh
node cli/strata.mjs verify architecture.strata
node cli/strata.mjs build architecture.strata -o architecture.html
node cli/strata.mjs build architecture.strata --view overview -o overview.html
```

No prior build is needed. Existing output files are never overwritten. See
[CLI options](../cli/README.md) for JSON, stdin, and bundled icons.

### Offline HTML

Build the bundled distribution with `npm run build`, then open
`dist/standalone.html` directly in a browser. Export **Offline HTML** from the
server editor to create a self-contained file with your source, icons, all
resources/views, and presentation settings.

Offline HTML starts as a full-window viewer without the source sidebar, with
perspective selection in the toolbar. It needs no server, internet connection,
or adjacent files. Embedded source takes precedence over browser storage.
Re-export the HTML to keep in-memory changes; the browser does not overwrite the
original file automatically. Resources hidden by the active view are still
included in the exported source.

### JSON field reference

JSON imports use `resources`, `relations`, and `perspectives` arrays, plus a
`title`. Optional fields correspond to source options:

| Model location | Fields |
| --- | --- |
| Resource | `subheader`, `description`, `icon`, `noLargeIcon`, `dashed`, `sizes`, `compactness`, `notes`. |
| Relation | `from`, `to`, `label`, `dashed`, `notes`. |
| Perspective | `resources`, `relations`, `inheritGlobalRelations`, `description`, `sizes`, `compactness`, `detail`, `notes`. |
| Model | `notes` for global standalone notes. |
| Note | `number`, `text`, `fontSize`, `position` (item notes), `connector`. |

A note connector is `{"label": "Details", "dashed": true}`; omission or `null`
disables it. Boolean style options accept `true` or `false`. A perspective can
omit `resources` or use `null` to infer membership; setting
`inheritGlobalRelations: false` corresponds to `relations only`.

## Built-in example

[`src/example.strata`](../src/example.strata) is the authoritative source for the
illustrative retail order journey. It includes checkout, fulfillment/delivery,
returns/refunds, recovery, infrastructure, and overview perspectives, plus 12
notes demonstrating attachment types, view scope, mark positions, font sizes,
and optional annotation connectors.

The example reuses API gateway, PostgreSQL, Redis, and queue infrastructure.
Service boxes represent logical business responsibilities. It is an illustrative
design, not a reconstruction of Amazon's internal architecture. Physical
operations draw on Amazon's public [package journey](https://www.aboutamazon.com/news/operations/how-do-amazon-packages-get-delivered)
and [fulfillment overview](https://sell.amazon.com/fulfillment-by-amazon).
Payment capture at dispatch is a scenario assumption.

`npm run build` validates the source and generates `dist/example.js` and
`dist/standalone.html`. Existing browser-saved source remains intact; import the
example file to load the new sample. Do not hand-edit generated JavaScript.

## Embed the framework

Serve the `src` modules from a static HTTP server:

```html
<div id="architecture"></div>
<script type="module">
  import { parseStrata } from './language.js';
  import { StrataDiagram } from './framework.js';

  const model = parseStrata(`
    service api "API" {
      subheader "Handles requests"
      note 1 "Request validation"
    }
  `);
  const state = { selected: null, selectedNote: null, collapsed: new Set() };
  const diagram = new StrataDiagram(document.getElementById('architecture'), {
    onSelect(id) {
      state.selected = id; state.selectedNote = null; render();
    },
    onSelectNote(number) {
      state.selected = null; state.selectedNote = number; render();
    },
    onCollapse(id, isCollapsed) {
      if (isCollapsed) { state.collapsed.delete(id); }
      else { state.collapsed.add(id); }
      render();
    }
  });
  function render() {
    diagram.render(model, { ...state, perspective: 'all', showNotes: true });
  }
  render();
</script>
```

| API | Purpose |
| --- | --- |
| `parseStrata(source)` | Parses source into a validated model. |
| `formatStrata(model)` | Produces canonical source. |
| `validateModel(input)` | Validates external JSON. |
| `DiagramLayout(model).create(viewId, collapsed)` | Computes nodes, edges, and visible notes without rendering. |
| `diagram.finishAnimations()` | Settles active SVG motion. |
| `diagram.exportSvg()` | Settles motion and returns SVG markup. |

The embedding application owns navigation state and re-renders from injected
callbacks. `{ animate: false }` disables SVG motion; a `DiagramMotion` instance
can be injected. DOM output uses text nodes; source is never evaluated as code.

## Limits and development

### Model limits

| Resource | Limit |
| --- | --- |
| Source | 1 MB |
| Items | 300 |
| Global and view-local relationship declarations combined | 1,000 |
| Perspectives | 30 |
| Hierarchy depth | 12 levels |
| Notes | 1,000 |
| Note text | 1–5,000 characters |
| Subheaders / connection and annotation labels | 500 characters |

Routing avoids item interiors and group headers where possible, penalizes shared
segments, and uses underlays to separate crossings. Dense graphs and cycles may
still need crossings or shared channels; planar or optimal routing is not
guaranteed. Labels truncate or hide when space is insufficient; route tooltips
retain original relationship labels. Large diagrams may require zoom or collapse.

### Development commands

```sh
npm run check
npm test
npm run build
npm run build:pages
```

Generated artifacts live in ignored `dist/`. Tests/builds regenerate the example
and offline HTML. For hosting, see [GitHub Pages setup](../publishing/README.md).

### Source map

| Path | Responsibility |
| --- | --- |
| `src/language.js` | Tokenizer, parser, canonical formatter. |
| `src/framework.js` | Model validation, layout integration, SVG rendering. |
| `src/tiling/` | Measurement, allocation, packing, semantic detail. |
| `src/routing.js` | Connection ports, paths, and label placement. |
| `src/notes/` | Note validation, marks, blocks, connectors, focus, and tests. |
| `src/items/` | Subheaders and large-icon visibility. |
| `src/motion.js` | Interruptible transitions and animation clock. |
| `src/app.js` | Editor, browser persistence, navigation, exports. |
| `standalone/` | Offline HTML generation and source embedding. |
| `tests/` | Shared language, model, layout, and browser-support behavior checks. |
