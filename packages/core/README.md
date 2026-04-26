# convex-panel

Devtools panel for Convex during development.

## Install

```bash
pnpm add convex-panel
```

## React Usage

```tsx
import { ConvexPanel, useAction, useMutation, useQuery } from "convex-panel/react";
```

Render the panel in your app:

```tsx
<ConvexPanel />
```

`convex-panel/react` is intended for development use. The panel UI does not render in production.

## Package

- Tracks Convex queries, mutations, and actions
- Expand rows to inspect args, results, and errors
- Keyboard accessible event list
- Copy controls for JSON blocks

## Local Development

```bash
pnpm install
pnpm dev:example-react
```
