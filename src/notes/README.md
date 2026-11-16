# Numbered notes

```text
note 1 "General architecture context"
service api "API" {
  note 2 "This item owns request validation"
}
database db "Database"
api -> db : "Query" dashed note 3 "Queries use a read replica"

view operations "Operations" {
  include api, db
  note 4 "This note appears only in Operations"
  db -> api note 5 "View-local connection note"
}
```

Notes work on items (including containers), connections, or independently at the
model/view level. Multiple notes can follow a connection. Numbers are explicitly
assigned positive safe integers, unique across the entire model. Up to 1,000 notes
are supported, each with nonempty text of at most 5,000 characters. Strings use
JSON escaping; `\n` creates a line break.

Item badges default to the top-left of their item; connection badges remain by their
connection. Each number has its own dashed circle. Blocks and badges are dim until their
item or connection is related to the selection and **Show notes** is enabled.
Selecting an item highlights its own notes, descendant notes when selecting a
group, and its direct connection notes. Unrelated badges and note text dim.

**Show notes** controls notebook blocks, numbered marks, and note connectors.
Unchecking it hides all three. The checkbox state persists in offline HTML.
Notes appear as ruled notebook blocks, sorted by number, with eight blocks per
row. Every block occupies one of eight equal columns, even in partially filled
rows; blocks never stretch to fill unused columns. Rows use the height of their tallest block; full text wraps inside each page. General notes appear in all
views; view notes appear only in their view. Attached notes follow visibility.
Collapsed descendants roll item badges up to their collapsed ancestor; bundled
connections retain every note. Internal connections hidden by collapse hide their
notes until expanded. Duplicate edges merge their notes. Multiple notes use individual circles stacked along their selected edge; hovering shows each
note's full text.

JSON uses an optional `notes: [{"number": 1, "text": "Context"}]` array on the
model, resources, relations, and perspectives. Formatting, source/JSON import,
SVG export, CLI builds, and offline HTML preserve notes. Note-only diagrams work
without resources. Note text is rendered as text, never evaluated as markup.


## Connect a note block to its mark

Connectors are optional per attached note:

```text
service api "API" {
  note 1 "Validates requests" connect : "Validation" dashed
  note 2 "Preserves request IDs" connect : "Logging" solid
  note 3 "No connector"
}
database db "Database"
api -> db note 4 "Uses a replica" connect dashed
```

Append `connect`, optionally `: "Label"`, then `dashed` or `solid`. The default
connector style is solid. This works for item notes and global/view-local
connection notes. General notes have no mark and reject `connect`.

JSON accepts `"connector": {"label": "Validation", "dashed": true}` on a note.
Omission or `null` disables the connector. Labels allow at most 500 characters;
`dashed` must be a boolean. Lines attach to the actual mark, including when
collapsed items collect several marks. Lines and labels use 25% opacity by default and 50% opacity when related to
the selected item. Unrelated connectors remain at 25%; connectors hide when
**Show notes** is unchecked. SVG and offline HTML preserve blocks,
labels, and line styles. Connectors are annotation lines and do not participate
in architecture relationship routing.

Selection changes note opacity only. Marks, blocks, connector lines, and labels
keep their normal theme colors; selection does not apply an accent color.


## Note font size

Append `fontSize` with any positive finite size in SVG pixels, including decimals:

```text
note 1 "Small general note" fontSize 12.5
service api "API" {
  note 2 "Larger explanation" fontSize 28
  note 3 "Large connected note" fontSize 40 connect : "Details" dashed
}
```

The default is 14. `fontSize` can appear before or after `connect`. JSON uses
`"fontSize": 28` on the note. Text wrapping, ruled line spacing, and block heights
follow the chosen size; blocks widen when needed to fit individual characters.
Numbered marks and connector labels retain their existing sizes. Source, SVG,
and offline exports preserve the chosen size.


## Animation

Notebook blocks, numbered marks, and connectors share the diagram animation
clock. They fade in on initial load and when appearing, fade out when removed,
and crossfade when content or geometry changes. Selection opacity changes fade
smoothly. Reduced-motion preferences and disabled animation apply the final
state immediately. SVG export settles pending animations before serialization.


## Focus one note

Click a numbered mark or notebook block to focus that specific note and its
attached item or connection. Other notes on the same item also dim. Connection
notes keep their connection endpoints visible; standalone notes dim all diagram
items. Collapsed item notes focus their visible collapsed owner. Marks and blocks
also support Enter and Space. Marks and blocks are available when **Show notes** is enabled. Click empty canvas or press Escape to clear note focus; selecting an
item returns to normal item selection.


## Item mark position

Item and container notes accept a `position` option; the default is `top-left`:

```text
service api "API" {
  note 1 "Default top-left mark"
  note 2 "Mark on the right" position right
  note 3 "Mark below the item" position bottom-left connect : "Details" dashed
}
```

Positions: `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`,
`bottom-left`, and `left`. JSON uses `"position": "top-right"` on an item note.
The option can appear before or after `fontSize` and `connect`.

Marks sit just outside the chosen edge or corner. Multiple marks sharing a
position stack along that edge, then outward. Collapsed descendant marks use
their chosen position on the visible collapsed item. Note connectors follow the
actual mark position. SVG bounds include outer marks, and exports preserve the
setting. General and connection notes do not accept item mark positions.
