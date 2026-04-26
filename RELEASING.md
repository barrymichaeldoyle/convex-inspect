# Releasing

## First Release

`convex-inspect@0.1.0` was published directly without a changeset because the package had not been released before.

## From `0.1.1` Onward

For every user-facing change:

```bash
pnpm changeset
```

Use these defaults:

- `patch`: bug fixes, styling fixes, small UX improvements, docs-affecting API clarifications
- `minor`: new features, new exported APIs, meaningful capability expansions
- `major`: breaking API changes, renamed exports, changed default runtime behavior requiring consumer changes

Automated flow:

- add a changeset in the feature/fix PR
- merge to `main`
- the release workflow opens or updates a `Version Packages` PR
- merge that PR to publish to npm automatically
- npm publishing is configured for trusted publishing via GitHub Actions

Local/manual flow if needed:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm version-packages
pnpm release
```

## Notes

- Keep the package version in `packages/core/package.json` as the source of truth.
- Prefer one changeset per merged change or feature.
- Do not create a changeset for docs-only changes unless they accompany a package change worth publishing.
- The trusted publisher configuration on npm must exactly match the GitHub repository and workflow filename.
