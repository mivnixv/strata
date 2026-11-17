# Item subheaders

Item cards do not display automatic type names. Add an optional subheader inside
an item or container block:

```text
service platform "Commerce" {
  subheader: "Checkout and fulfillment"
  service api "API" {
    subheader: "Validates incoming requests"
  }
}
```

Subheaders appear below the title on leaf items and expanded/collapsed groups.
They shrink or truncate to fit available width. Omission or an empty string
renders no subheader on an expanded item. A collapsed group without a custom
subheader retains its component-count summary.

JSON uses an optional `"subheader": "Validates incoming requests"` on a resource.
Values must be strings of at most 500 characters. Subheaders are text, never
markup. Formatting, JSON import, SVG export, CLI builds, and offline HTML preserve
the text. Resource types still determine icons, colors, and the type legend.
