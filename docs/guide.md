# Strata

A dependency-free framework for layered architecture diagrams, with a small declarative language and a live browser preview. Architecture is defined entirely in text. The canvas is for exploration.

## Retail order example

`src/example.strata` is the source of truth for the bundled Amazon-style physical-product scenario. `npm run build` validates it and generates `dist/example.js` plus the offline HTML. Edit the pseudo-language file to update the example; do not hand-edit the generated JavaScript.

The scenario follows one pair of wireless headphones through checkout, inventory reservation, payment authorization, atomic order/outbox persistence, asynchronous fulfillment, pick/pack, capture and dispatch, delivery updates, and an optional return/refund. Focused perspectives cover checkout, fulfillment/delivery, returns/refunds, failure recovery, infrastructure dependencies, and the whole system.

Reused components are the **existing example's** API gateway, PostgreSQL, Redis, and event queue. Added service boxes are logical business responsibilities, not claims about deployed infrastructure. Redis holds ephemeral carts/read caches; PostgreSQL owns authoritative stock and order/payment state. The outbox relay publishes committed events to the existing broker. Consumers and payment operations deduplicate retries. No extra cache, database, broker or dead-letter service is invented.

The physical fulfillment journey is based on Amazon's public [package journey](https://www.aboutamazon.com/news/operations/how-do-amazon-packages-get-delivered) and [Fulfillment by Amazon overview](https://sell.amazon.com/fulfillment-by-amazon). Warehouse and carrier boxes represent external physical operations. Software boundaries, order states, outbox usage, and infrastructure mappings are our illustrative design, not a reconstruction of Amazon's internal systems. Capture at dispatch is a scenario assumption for this physical-item example; payment, split-shipment, return and refund behavior varies by item, seller and policy.

Existing browser-saved models remain intact. Use **Load example** to switch to the new sample; the previous source is downloaded first. The offline distribution opens the new scenario directly.

## Fully offline, single-file HTML

To validate an input file and generate its standalone diagram from the terminal:

```sh
node cli/strata.mjs verify architecture.strata
node cli/strata.mjs build architecture.strata -o architecture.html
```

No prior build is needed. See [CLI options](../cli/README.md) for JSON, stdin,
initial views, and custom icon directories.

Run `npm run build`, then open `dist/standalone.html` directly in a modern browser. It includes the complete source editor, language parser, SVG renderer, styles, example model, and help. It needs no server, Node.js, build tools, internet connection, CDN, or adjacent files.

Click **Offline HTML** to export the current source and navigation state into a new `architecture.html`. The exported file supports editing, perspectives, selection, collapse/expand, zoom, import, SVG export, and further offline HTML exports. Embedded source takes precedence over browser storage, so opening a shared export always starts with the diagram it contains. To keep later edits in the HTML file, export it again; browsers cannot overwrite a file just by editing its contents in memory.

To regenerate the standalone distribution after changing framework code:

```sh
npm run build
```

The normal HTTP editor fetches its bundled HTML template only when exporting. Exported files use their own embedded document and do not fetch it. Exports contain all perspectives and all model resources, including resources hidden by the active view.

## Run the development workspace

To publish the full builder on GitHub Pages, see [publishing instructions](../publishing/README.md).
`npm run build:pages` prepares the complete editor and assets in `dist/pages/`.

Requires Node.js 20.11 or newer. No dependency installation is needed; the development command builds the offline HTML automatically.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Run `npm test` for the parser and layout tests, or `npm run check` for syntax checks.

## Define a model

Save this as `architecture.strata` and import it, or paste it into the editor:

```text
diagram "My system"

app web "Web application"

service platform "Application platform" {
  description "Our core application"
  service api "API"
  database db "PostgreSQL"
}

web -> api : "HTTPS"
api -> db : "SQL"

view overview "System overview" {
  include web, platform
}

view data "Data dependencies" {
  include api, db
}
```

- One statement per line. Whitespace and indentation do not define hierarchy; braces do.
- Resource declarations: `TYPE ID "Display name"`, optionally followed by `{` to contain descriptions or nested resources.
- Types: `app`, `service`, `database`, `infrastructure`, `external`. `app` declares an app node.
- IDs: start with a letter or underscore; contain letters, digits, underscores, dots or hyphens. IDs must be unique.
- Strings: double-quoted, with JSON-style escapes (`\"`, `\n`, etc.).
- Descriptions: `description "Text"` inside a resource or view block. View descriptions appear above the diagram; use `\n` inside the quoted string for paragraphs.
- Relationships: `source -> target : "label"`. Outside a view they are global; inside a view they are local to that perspective. Labels are optional; references can precede declarations.
- Views: `view ID "Display name" { ... }`. The body can contain local relationships, an optional `include id1, id2` list, an explanation, and the optional `relations only` directive.
- Explicitly including a group includes its descendants. Local relationship endpoints are always included, with their context ancestors and without unrelated siblings. When `include` is omitted, local endpoints determine membership; a view with no local relationships infers membership from its inherited globals.
- With no view declarations, a system overview is generated automatically.
- Comments start with `#` outside quoted strings.
- Closing braces occupy their own line. Inline blocks and semicolons are unsupported.

## Global and perspective relationships

```text
app web "Web"
service api "API"
database db "PostgreSQL"

# Shared across applicable perspectives.
api -> db : "SQL"

view checkout "Checkout" {
  # Adds relationships only in this perspective.
  web -> api : "Place order"
  api -> db : "Write order"
}

view audit "Audit" {
  # Optional: show this view's relationships without inherited globals.
  relations only
  api -> db : "Write audit record"
}

view storage "Storage" {
  # Existing include-based definitions continue to work.
  include api, db
}
```

Global relationships are inherited by default when both endpoints participate in the view. Local relationships do not appear in another perspective. An identical `(from, to, label)` inherited and local edge is drawn once; differently labeled relationships remain distinct. Local edges and `include` can be combined. An empty `include` line explicitly selects no additional resources, while local endpoints still participate.

The normalized JSON shape has `relations` at the model level and optional `relations` on each perspective. A perspective can omit `resources` (or use `null`) to infer membership and set `inheritGlobalRelations: false` for the same behavior as `relations only`. Old JSON with explicit resource lists remains supported. The limit is 1,000 total relationship declarations across global and local scopes.

The retail example demonstrates both modes: Returns & refunds adds a local inspection-result relationship, while Failures & recovery defines a focused local-only graph without an `include` list.

## Browser behavior

The editor updates the preview after 300 ms. Invalid source shows a diagnostic and retains the last valid preview. `Ctrl/Cmd+Enter` updates immediately; Tab inserts two spaces. Format canonicalizes valid source, removing comments.

Select a resource to highlight its incoming/outgoing connections and their endpoints while dimming unrelated cards, arrows, and labels. Context groups remain visible. Selecting a group highlights only its own direct connections, without highlighting its children or their connections. Collapsed groups use visible rolled-up connections. Click empty canvas space, close the inspector, or press Escape to clear selection. Selecting another resource switches the focus. Double-click a group to collapse/expand it; Space does the same on a focused resource. Collapsed groups bundle external relationships into at most one incoming trunk and one outgoing trunk per side, branching to each external item on that side. Incoming and outgoing trunks use separate ports, including when both are on the same side. Facing ports line up on aligned collapsed cards, producing two straight parallel lines for opposite directions when the space between them is clear. Parallel relationships between the same visible endpoints become a single branch with a relationship count; hovering lists the original connections. Internal relationships are hidden until the group is expanded. Perspectives, zoom, selection and collapsed state are presentation-only and never change your source.

The last valid source is saved in localStorage in this browser. Export `.strata` for backups and version control. Import accepts `.strata`, `.txt`, and compatible JSON models. Export SVG captures the current perspective and collapsed state. New and Load example download the previous source before replacing it. Browser storage is not shared or synchronized.

## Animated navigation

Perspective changes and collapse/expand move shared resources and resize their groups over 420 ms. Entering/leaving resources fade around their parent context, and connection paths move between routed positions. Selection highlighting and dimming ease over 180 ms; zoom eases over 280 ms. New input interrupts an animation at its displayed state rather than waiting for a queue of transitions.

Animations respect `prefers-reduced-motion`, including changes while a transition is running. Embedders can disable SVG motion with `new StrataDiagram(element, { animate: false })` or inject a `DiagramMotion` instance. `finishAnimations()` immediately settles the current scene; SVG and offline HTML exports call it before serialization to avoid capturing intermediate geometry or disappearing resources. Exported HTML retains all interactive animation behavior without external libraries.

## Embed the framework

Serve the `src` modules from any static HTTP server:

```html
<div id="architecture"></div>
<script type="module">
  import { parseStrata } from './language.js';
  import { StrataDiagram } from './framework.js';

  const source = `
    diagram "Example"
    app web "Web"
    service api "API"
    web -> api : "HTTPS"
  `;

  const model = parseStrata(source);
  const diagram = new StrataDiagram(document.getElementById('architecture'), {
    onSelect(id) { console.log('Selected:', id); },
    onCollapse(id) { console.log('Toggle group:', id); }
  });

  diagram.render(model, {
    perspective: 'all',
    collapsed: new Set(),
    selected: null,
    showLabels: true
  });

  // diagram.exportSvg() returns standalone SVG markup.
</script>
```

`parseStrata(source)` returns a validated model. `formatStrata(model)` emits canonical source. `validateModel(input)` validates external JSON. `DiagramLayout(model).create(viewId, collapsed)` returns renderer-independent node and edge geometry.

The callbacks are dependency-injected. An embedding application owns navigation state and re-renders when it changes. DOM output uses text nodes; source is never evaluated as JavaScript or HTML.

## Boundaries

Supports 300 resources, 1,000 total global/perspective relationships, 30 perspectives, 12 hierarchy levels and 1 MB source. The layout is deterministic: dependency layers arrange resources from left to right, including within nested groups. Dedicated ports and obstacle-aware orthogonal paths keep arrows clear of resource cards and group headers. Routing penalizes shared segments, and canvas-colored underlays distinguish perpendicular crossings. Labels are placed in clear space; when there is insufficient room, the full relationship remains available in the arrow tooltip and resource inspector. Cycles and dense graphs can still require crossings or shared channels; arbitrary graphs are not guaranteed to be planar. The router does not guarantee an optimal layout. Large models may require scrolling or collapsing groups. Browser UI uses optional Google Fonts with local font fallbacks; parser and renderer require no external libraries.

## Files

Generated files live only in `dist/`, which is ignored by Git. A fresh checkout regenerates them with `npm run build`, `npm run dev`, or `npm test`.

- `src/language.js`: tokenizer, parser and canonical source formatter.
- `src/framework.js`: validation, hierarchical layout and SVG renderer.
- `src/routing.js`: dependency ordering, connection ports, orthogonal routing and label placement.
- `src/motion.js`: interruptible animation clock, keyed SVG transitions and route interpolation.
- `src/app.js`: source editor and read-only diagram navigation.
- `src/example.strata`: authoritative example source.
- `dist/example.js`: generated, validated example model.
- `standalone/offline-export.js`: safe source embedding for single-file HTML exports.
- `standalone/build-offline.mjs`: dependency-free bundler; removes external font imports and inlines all modules and CSS.
- `dist/standalone.html`: complete offline application and example diagram.
- `tests/`: boundary validation, language round trips, layout invariants, and offline export checks.

## Weighted hierarchical tiles

Each container is laid out independently. Bottom-up sizing counts relationships in the active perspective, reserves readable minimum tile sizes and routing space, and sums descendant weights. Top-down allocation fills parent rectangles with weighted columns and child tiles. Connected children use topological columns; first appearance in the relation list determines peer order. Unconnected children use stable compact packing. Cycles are broken deterministically for placement without reversing model relationships.

```text
app backend "Backend" {
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

- `sizes`: `proportional` gives more space to more-connected resources; `uniform` equalizes sibling minimum dimensions and weights; `auto` chooses uniform for equal connection counts and proportional otherwise. Minimum readable sizes constrain proportions.
- `compactness`: 0.1–1; higher values narrow tile/routing gaps. Resource settings override view defaults for that container's children.
- `detail`: view initial value from 0–1. The toolbar changes presentation only. At 0, containers roll up; at 1, all non-manually-collapsed children are shown. Intermediate values compare child rectangles against a screen-pixel budget, using viewport width and zoom. Measurements use a stable full-detail baseline, so relayout cannot trigger expand/collapse oscillation.

Detail transitions reuse the interruptible SVG animation engine. Manual collapses persist across zoom. Expanding a rolled-up group returns to full detail. Offline exports preserve the view, detail, zoom, and manual collapsed state.

Implementation lives in `src/tiling/`: `engine.js` orchestrates measurement/allocation, `packing.js` chooses compact arrangements, `allocation.js` distributes rectangles, `options.js` validates controls, and `semantic.js` computes pixel-budget rollup. Routing remains obstacle-aware and preserves bundled collapsed connections.

Scroll over the canvas to zoom around the pointer (40–300%). Mouse wheels and trackpads are supported; editor/page scrolling outside the canvas is unchanged. Wheel input is coalesced once per animation frame.

### Item icons

Use a file path relative to `icons/` as an icon ID:

```strata
external payments "Payments" {
  icon "brands/brands_s/stripe_icon.svg"
}
```

Icons replace the header glyph and the large, dimmed tile icon. Expanded parents show only the header icon. Offline HTML embeds the icons referenced by the exported source; offline edits can reuse those IDs. Export reports missing icon files.

Offline HTML opens as a full-window diagram viewer without the source sidebar. Perspective selection remains in the top toolbar.
