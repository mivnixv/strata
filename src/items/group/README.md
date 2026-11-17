# Groups

Use `group` for an item intended to contain other items without assigning it a
specific architectural role:

```text
group backend "Backend" {
  service api "API"
  database db "Database"
}
```

JSON resources use `"type": "group"`; children reference the group's ID through
`parent`. Groups use a neutral theme color and support the same options,
connections, nesting, views, and collapse behavior as other items.

An empty group is valid and renders as an ordinary item. As with other types,
nesting children makes it a container.
