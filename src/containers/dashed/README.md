# Dashed container borders

Add `dashed` inside a resource block:

```text
service platform "Platform" {
  dashed
  service api "API"
}
```

Borders default to solid. JSON accepts optional `"dashed": true` or `false` on a
resource and rejects other values. The style also works on leaf items and remains
visible on collapsed groups, selected items, and exports. It does not change
layout, hierarchy, or connection styles.
