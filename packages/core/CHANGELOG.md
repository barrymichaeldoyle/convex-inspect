# convex-inspect

## 0.3.0

### Minor Changes

- Add three features to make the panel actually useful for debugging:
  - **Search**: a search input above the event list filters rows by function name (case-insensitive substring). Combines with the existing type filter.
  - **Structured error rendering**: errors thrown from mutations and actions now capture the message, optional `data` (for `ConvexError`s), and the stack trace. The panel renders the message prominently in red, shows `data` as JSON, and hides the stack behind a toggle.
  - **Group consecutive identical calls**: when the same function is invoked back-to-back with the same args and the same terminal status, the rows are merged into a single row with an `×N` count badge. The unread-count badge on the closed FAB now sums occurrences instead of distinct rows, so it still reflects "how many calls happened" even when grouping is active.

## 0.2.2

### Patch Changes

- Polish the `ConvexPanel` rendering so the UI feels stable and consistent.
  - give the panel a fixed default height so it no longer shrinks when the first event is logged
  - reserve scrollbar gutter and pin row line-height to integer pixels to avoid sub-pixel layout shifts as events stream in
  - fade new event rows in so they don't pop or fight with the auto-scroll
  - color the `query` / `mutation` / `action` filter buttons to match their event-type badges, including an active state that uses the type's tint and border

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
