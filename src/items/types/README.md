# Custom item types

Declare style defaults at document level; use the type like any built-in item:

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

`color` controls item borders, accents, neutral-icon tint, and selected connection colors.
`background` sets the fill. All colors
are quoted six-digit hex values. `icon`, `line`, `large-icon`, and `subheader`
have the same meaning on type declarations and individual items.

Item settings override defaults. Formatting preserves inheritance instead of
copying defaults into items. Clear an inherited icon with `icon: null`; an empty
string clears a subheader. Defaults apply to the item's own type, including its
collapsed form, not its descendants.

Types can be declared before or after their items. Built-in types can also have
defaults, such as `type service { large-icon: false }`. Custom types without a
color use the theme's muted color. All types support nesting, notes, connections,
views, and collapse.

Names start with a letter or underscore, then letters, digits, underscores, dots,
or hyphens; maximum length is 100. Structural keywords (`diagram`, `type`, `view`,
`note`, `layout`, `start`, `end`, `connector`), literal names (`true`, `false`,
`null`), and `__proto__`, `prototype`, `constructor` are reserved. Duplicate type
names and unknown styles are rejected. At most 100 definitions are allowed.

The JSON model schema is unchanged. Definitions use a top-level array:

```json
{
  "title": "System",
  "types": [{"name": "queue", "color": "#e6b86a", "dashed": true, "noLargeIcon": true}],
  "resources": [{"id": "jobs", "name": "Jobs", "type": "queue"}],
  "relations": [],
  "perspectives": [{"id": "all", "name": "All"}]
}
```

Browser exports and CLI builds embed inherited icons. See
[the full grammar](../../dsl/README.md) for property scopes and JSON mappings.
