# Dashed connections

Append `dashed` to a relationship, after its optional label:

```text
service api "API"
infrastructure queue "Queue"
service worker "Worker"

api -> queue : "Publish event" dashed
queue -> worker dashed
worker -> api : "Synchronous request"
```

The default is solid. The option works for global and view-local relationships.
JSON models use `"dashed": true`; omission or `false` means solid. Other values
are rejected.

Formatting, SVG export, CLI generation, and standalone HTML preserve the style.
Dashed and solid edges remain distinct even with the same endpoints and label.
Collapsed groups bundle edges separately by style. Selection and dimming retain
both styles. This is a visual hint; it does not change workflow execution or
relationship direction.
