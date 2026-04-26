# convex-panel

Development panel for Convex apps.

## Workspace

- `packages/core`: published package
- `apps/example-react`: local example app

## Local Development

```bash
pnpm install
pnpm dev:example-react
```

## Release

Changesets is configured for versioning and publishing.

```bash
pnpm changeset
pnpm version-packages
pnpm release
```
