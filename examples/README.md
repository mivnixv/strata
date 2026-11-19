# Workflow examples

Fictional architectures with nested services, bundled icons, focused views,
asynchronous handoffs, and explicit recovery paths. Arrows describe dependencies
and workflow intent; Strata does not execute these workflows.

| Example | Workflow | Views |
| --- | --- | --- |
| [Language tour](language-tour.strata) | Type defaults, overrides, inline blocks, endpoint symbols, notes, view scopes, and vertical dispatch | Overview, focused, vertical |
| [Vertical connections](vertical-connections.strata) | Automatic downward, upward, and two-way connections between container headers and their children | Overview, roundtrip |
| [Subscription lifecycle](subscription-lifecycle.strata) | Enrollment, payment callbacks, tenant activation, renewal, cancellation, and compensation | Enrollment, renewal, recovery, overview, vertical dispatch |
| [Data pipeline](data-pipeline.strata) | Event admission, immutable archiving, enrichment, quality gates, publication, late arrivals, and replay | Pipeline, corrections, failures, consumption, overview, vertical dispatch |
| [Release delivery](release-delivery.strata) | Tested and signed artifacts, approval, compatible migrations, canary promotion, and rollback | Build, rollout, rollback, overview, vertical dispatch |

Import any `.strata` file into the [browser builder](https://mivnixv.github.io/strata/),
or validate it from a checkout:

```sh
npm run cli -- verify examples/subscription-lifecycle.strata
npm run cli -- verify examples/data-pipeline.strata
npm run cli -- verify examples/release-delivery.strata
```

Every `icon` path is relative to the repository's bundled [`icons/`](../icons/)
directory. No external images or custom icon directories are required.
