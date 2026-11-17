# Suppress the large tile icon

Add `large-icon: false` inside an item or container block:

```text
service api "API" {
  subheader: "Validates incoming requests"
  icon: "svgs/solid/server.svg"
  large-icon: false
}
```

This disables the large decorative icon that otherwise appears when a leaf or
collapsed group has enough space. The small header icon remains visible. The
option also suppresses the generated type glyph when no custom icon is set.

The default is to allow large icons. JSON uses optional `"noLargeIcon": true` or
`false` on a resource; other values are rejected. The option applies to its item,
not descendants. It does not change layout or card size. Formatting, source/JSON
import, SVG export, CLI builds, and offline HTML preserve the setting.
