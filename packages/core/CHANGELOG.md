# convex-inspect

## 0.2.1

### Patch Changes

- Render the Convex panel inside a Shadow DOM so host app styles do not leak into the UI.

## 0.2.0

### Minor Changes

- Improve the `ConvexPanel` UX and harden the runtime behavior for real app usage.
  - add explicit runtime controls via the `enabled` prop plus `setConvexInspectEnabled` and `resetConvexInspectEnabled`
  - make the lazy React entry and event logging respect dev/prod behavior more reliably
  - fix query logging so a changed query reference creates a new event even when the args stay the same
  - improve panel UX with collapsible settings and filters, hover copy actions, and clearer focus states
  - restore and lock down keyboard accessibility for expandable rows and hidden detail actions
