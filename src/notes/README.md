# Numbered notes

Notes can be standalone, attached to an item/connection, or scoped to a view.

```text
note 1 "General explanation"
service api "API" {
  note 2 "Keep request IDs." {
    position: top-right
    font-size: 18
    connector { label: "Retry contract"; line: dashed }
  }
}
database db "Database"
api -> db "Query" {
  note 3 "Read-only." { connector {} }
}
view checkout "Checkout" {
  include: [api, db]
  note 4 "Checkout-only detail." { on: api; position: left }
}
```

## Properties

- `on: ID` attaches a document/view note to an existing item. It is unavailable
  inside item and connection notes, which already have a target.
- `position: top-left` places an item mark. Values: `top-left`, `top`,
  `top-right`, `right`, `bottom-right`, `bottom`, `bottom-left`, `left`.
  Default: `top-left`. Only item attachments accept positions.
- `font-size: 12.5` sets positive finite text size in SVG pixels. Default: 14.
- `connector {}` enables an unlabeled solid annotation line.
- `connector { label: "Details"; line: dashed }` adds a label and dashed line.
  Connector `line` is `solid` or `dashed`; default is `solid`.

Omit `connector` for just the mark and note. Unattached notes cannot have
connectors or mark positions. Properties and connector blocks can appear in any
order. Duplicates and unknown properties are errors.

Numbers must be unique positive safe integers across the entire diagram.
At most 1,000 notes are allowed; each text contains 1–5,000 characters. Connector
labels are limited to 500 characters. Strings use JSON escapes; `\n` inserts a
line break. Text is rendered as text, not HTML.

## Scope and visibility

Document-level standalone notes appear across views. Item and connection notes
follow visible targets. View notes appear only in that view. A view note with
`on: api` includes the item and its ancestor context without replacing its global
notes. Repeat a matching connection in a view with an attached note to add
view-specific explanation; identical connections merge their notes.

Collapsed groups collect visible descendant item marks. Internal connection
notes disappear with their hidden connections. Marks stack along the selected
edge and then outward; annotation connectors follow them. Notebook blocks wrap
after eight columns and grow with text wrapping and font size.

Notes, marks, and connectors start dimmed. Select an item to reveal applicable
notes. Select a mark or note block to focus one explanation. Enter/Space activates
notes; Escape clears focus. Show notes toggles blocks, marks, and connectors
together. Notes participate in motion and respect reduced-motion preferences.
Annotation connectors use the default theme color when idle. Selecting their
item or their own note/mark applies the item's accent; unrelated connectors keep
the default color. Connection-note connectors use the selected endpoint's color,
or the source item's color when the note itself is selected. Hover alone does
not change connection colors.
Marks, blocks, and annotation connectors follow their visible item's entry timing.
Repositioned notes on existing items fade in immediately during layout changes.

## JSON

The JSON model fields remain unchanged:

```json
{
  "number": 1,
  "text": "Details",
  "resource": "api",
  "position": "top-right",
  "fontSize": 18,
  "connector": {"label": "Why", "dashed": true}
}
```

`resource` is available on document/view notes. Item and connection note arrays
already supply the attachment. Use `connector: null` or omit it for no line.
Source, JSON, SVG, and standalone HTML exports retain the note settings.
