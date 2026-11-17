# Connection endpoints

Configure symbols and labels in independent endpoint blocks:

```text
service api "API"
database db "Database"
api -> db "Query" {
  line: dashed
  start { shape: dot; label: "Caller" }
  end { shape: circle; label: "Store" }
}
```

Each block can contain `shape`, `label`, or both. Properties use `key: value`,
can appear in either order, and cannot repeat. The middle label can use the
connection header's quoted string or `label:` inside its block, not both.

```text
api -> db { start { shape: square } end { shape: arrow } }
api -> db { start { label: "Caller" } end { label: "Store" } }
api -> db { end { shape: none } }
```

| Shape | Symbol |
| --- | --- |
| `dot` | Filled circle |
| `circle` | Hollow circle |
| `arrow` | Filled arrowhead pointing toward its attachment |
| `asterisk` | Six-spoke asterisk |
| `square` | Filled square |
| `none` | No symbol |

Defaults: no start symbol, an end arrow, and empty endpoint labels. The Labels
control hides all three labels without hiding symbols. Endpoint labels sit beside
terminal segments, shrink or truncate as needed, and avoid resource bounds and
other labels. A label is omitted if neither side has room. Tooltips retain full
endpoint text. Labeled connections reserve additional vertical port space.

Symbols use the connection color and remain solid on dashed lines. Different
endpoint symbols or labels remain distinct during deduplication and collapse.
Options work on global and view-local connections and survive formatting, JSON,
SVG, and offline HTML exports.

The JSON fields are unchanged:

```json
{"from":"api","to":"db","startType":"dot","startLabel":"Caller","endType":"circle","endLabel":"Store"}
```

Labels accept at most 500 characters.

## Fading endpoints

Connections dimmed by an overlapping route retain bright terminal segments and
configured symbols in the idle view. Each endpoint fades into the 10%-opacity
body over up to 25.6 diagram units, following bends. Short-route fades are limited
to half the total length. Dashed endpoint strokes preserve the complete route's
dash phase. SVG and offline HTML retain the gradients.

The body and labels dim independently of endpoint overlays. Hover reveals direct
connections; moving away restores coverage and fading. Selection takes precedence
over hover. Related connections remain visible; unrelated ones stay dimmed.
