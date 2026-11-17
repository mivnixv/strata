# Strata DSL

Strata describes items, connections, views, and notes. Declarations use readable
headers; configuration uses `key: value`. Named blocks group related settings.
There is one grammar for built-in types, custom types, and item overrides.

```text
diagram "System"

type queue {
  color: "#e6b86a"
  icon: "svgs/solid/server.svg"
  line: dashed
  large-icon: false
}

group backend "Backend" {
  layout { sizes: uniform; compactness: 0.8 }
  service api "API"
  queue jobs "Jobs"
}

api -> jobs "Publish" {
  start { shape: dot; label: "Producer" }
  end { shape: circle; label: "Inbox" }
  note 1 "Consumers handle redelivery." {
    connector { label: "Delivery"; line: dashed }
  }
}

view work "Work" {
  include: [backend]
  relations: inherit
  note 2 "Preserve request IDs." { on: api; position: top-right }
}
```

## Lexical rules

- Newlines or semicolons separate scalar properties and leaf declarations.
- Blocks can be multiline or inline. Closing braces delimit blocks; a separator
  after a closing brace is optional.
- `#` starts a comment outside strings. Comments end at the next newline.
- Strings are double-quoted and use JSON escapes; `\n` embeds a line break.
- Booleans are `true` or `false`; `null` clears an inherited icon.
- Numbers use JSON notation, including negatives, decimals, and exponents. Model
  validation enforces each property's allowed range.
- IDs and type names match `[A-Za-z_][\w.-]*`. IDs are global, including inside
  containers. Quoted strings are never treated as IDs or enums.
- Enums are bare words, such as `solid`, `dashed`, or `uniform`.
- Lists use brackets and commas. Lists can span lines and have a trailing comma.
- Forward references are supported for item IDs and type names.
- Property and block order is free. Duplicate properties or named blocks in one
  scope are errors. Duplicate resource IDs, type names, view IDs, and note
  numbers are also errors.

## Grammar

```ebnf
document   = (diagram | type | item | connection | view | note)*
diagram    = 'diagram' STRING
type       = 'type' TYPE '{' style* '}'
item       = TYPE ID STRING ('{' (style | description | layout | item | connection | note)* '}')?
connection = ID '->' ID STRING? ('{' (label | line | start | end | note)* '}')?
view       = 'view' ID STRING '{' (description | include | relations | detail | layout | connection | note)* '}'
note       = 'note' NUMBER STRING ('{' (on | position | font-size | connector)* '}')?
property   = KEY ':' VALUE
layout     = 'layout' '{' (sizes | compactness)* '}'
start      = 'start' '{' (shape | label)* '}'
end        = 'end' '{' (shape | label)* '}'
connector  = 'connector' '{' (label | line)* '}'
```

`style`, `description`, `label`, `line`, `include`, `relations`, `detail`, `on`,
`position`, `font-size`, `sizes`, `compactness`, and `shape` above are properties.
Connections nested in an item block are global connections, using global IDs;
canonical formatting moves them to the document's connection section.

## Properties by scope

| Scope | Properties / named blocks |
| --- | --- |
| Type defaults | `color`, `background`, `icon`, `line`, `large-icon`, `subheader` |
| Item | All type properties, `description`, `layout`, nested items/connections/notes |
| Connection | `label`, `line`, `start`, `end`, attached notes |
| Endpoint | `shape`, `label` |
| View | `description`, `include`, `relations`, `detail`, `layout`, local connections/notes |
| Note | `on`, `position`, `font-size`, `connector` |
| Note connector | `label`, `line` |
| Layout | `sizes`, `compactness` |

`on` is available only on notes declared at document or view level. `position`
requires an item attachment. `connector` requires an item or connection attachment.
A connection's middle label can use its header string or `label:` in its block,
not both. Wrong-scope and unknown properties are rejected.

## Values and defaults

| Property | Values | Default |
| --- | --- | --- |
| `color`, `background` | Quoted six-digit hex color | Current theme |
| `icon` | Quoted bundled icon path or `null` | Type glyph/default icon |
| `line` | `solid`, `dashed` | `solid` |
| `large-icon` | `true`, `false` | `true` |
| `subheader`, `description`, `label` | Quoted string | Empty |
| Endpoint `shape` | `dot`, `circle`, `arrow`, `asterisk`, `square`, `none` | Start `none`, end `arrow` |
| `include` | List of IDs | Infer view membership |
| `relations` | `inherit`, `local` | `inherit` |
| `detail` | Number 0–1 | 1 |
| `sizes` | `auto`, `uniform`, `proportional` | `auto` |
| `compactness` | Number 0.1–1 | 0.6 |
| `on` | Existing item ID | Note's declaration scope |
| `position` | `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`, `bottom-left`, `left` | `top-left` for item notes |
| `font-size` | Positive finite number | 14 |

`color` controls item borders, accents, neutral-icon tint, and connection colors.
Selected connections blend their source and target colors. Idle connections and
their endpoint symbols use the theme's default connection color.
Type defaults apply to items of that type, not descendants of another type.
Explicit item properties take precedence. Use `icon: null`, `subheader: ""`,
`large-icon: true`, or `line: solid` to override inherited settings.

## Formatting and JSON

`parseStrata` produces the existing validated JSON model. DSL names are mapped
to model fields: `large-icon` → inverted
`noLargeIcon`, `line` → `dashed`, and `font-size` → `fontSize`. Endpoint blocks
map to `startType`, `startLabel`, `endType`, and `endLabel`. `relations: local`
maps to `inheritGlobalRelations: false`.

`formatStrata` emits canonical multiline syntax. It preserves inheritance and
explicit empty overrides, omits ordinary defaults, and discards source comments.
Formatting is idempotent. JSON model import remains supported; the JSON schema
is unchanged. Previous DSL syntax is intentionally unsupported.

## Implementation

The lexer records token line/column locations. The parser uses an explicit scope
stack bounded by the model's hierarchy depth plus note/connector scopes; no
source is evaluated. Model, type, note, byte, and relationship limits still apply.
Both parser and formatter accept an injected model validator for focused tests.
