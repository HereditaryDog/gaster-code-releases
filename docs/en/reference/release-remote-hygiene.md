# Release Remote Hygiene

The source checkout may keep several remotes:

- `origin`: private source repository and authoritative source tags.
- `public-releases`: release-only public repository for updater assets.
- `colleague`: build-quota fork used for remote package builds.

Do not fetch all remotes with tags from the source checkout. The release-only
repository has a different commit history, so matching tag names can point to
different objects.

## Safe Fetching

Use no-tags fetches for source work:

```bash
git fetch origin --prune --no-tags
git fetch --all --prune --no-tags
```

For local clones that keep `public-releases` or `colleague` as extra remotes,
disable automatic tag import and skip them during fetch-all:

```bash
git config remote.public-releases.tagOpt --no-tags
git config remote.colleague.tagOpt --no-tags
git config remote.public-releases.skipFetchAll true
git config remote.colleague.skipFetchAll true
```

Inspect release-only tags without importing them:

```bash
git ls-remote --tags public-releases
```

## Release Pushes

The release script creates one version tag. Push only that tag with `main`:

```bash
git push origin main vX.Y.Z
```

Avoid `git push origin main --tags`; the source clone can contain tags from
multiple histories after manual maintenance.

## Colleague Fork Sync

Before using the colleague fork for package builds, sync its `main` from
`origin/main`. Prefer a backup branch plus an exact lease:

```bash
git push colleague <old-colleague-main>:refs/heads/backup/main-before-origin-sync-YYYY-MM-DD
git push --force-with-lease=refs/heads/main:<old-colleague-main> \
  colleague origin/main:refs/heads/main
```

Push only the source release tags required for that build:

```bash
git push colleague refs/tags/vX.Y.Z:refs/tags/vX.Y.Z
```

Never push all local tags to the colleague fork.

## Do Not Do This

```bash
git fetch --all --prune --tags
git push colleague --tags
git push --mirror colleague
git push --force public-releases refs/tags/vX.Y.Z
```

Do not rewrite `public-releases` tags from the source checkout. That repository
is a different release-only history.
