# Contributing

Thanks for helping. Bug reports, fixes and small focused features are welcome. For anything larger,
open an issue first so we can agree on the approach.

This plugin reads a Kubernetes API server. A change that widens what it can reach (a new path in the
default allow-list, a new verb in `deploy/rbac.yaml`, a new resource) needs a line in
[`docs/DECISIONS.md`](docs/DECISIONS.md) explaining why it is safe.

## Setup

- Node 22 or later
- [`percli`](https://github.com/perses/perses/releases/tag/v0.55.1) v0.55.1
- [`cue`](https://cuelang.org/docs/introduction/installation/) on `PATH` (v0.17.1 tested)
- Go (for the allow-list test in `test/allowlist/`)

```bash
npm ci
```

## Build and check

```bash
npm run format:check            # oxfmt
npm run lint                    # oxlint
npm run type-check              # tsc
npm test                        # vitest: model, client, queries, variable, editors, allow-list
(cd test/allowlist && go test)  # the default allow-list with Go's regexp engine, as the proxy uses
cue mod tidy --check
percli plugin test-schemas      # CUE schemas against schemas/**/tests/{valid,invalid}
npm run build                   # module-federation bundle in dist/
percli plugin build             # writes Kubernetes-<version>.tar.gz
```

CI runs all of them on every pull request. Please run them locally first.

## Try it in Perses

The `dev/` stack runs a kind cluster with Perses, this plugin, the honeycomb panel and a few broken
workloads: see "Try it locally" in the README. It is also where the README screenshots come from;
retake them after a visible change. `dev/proxy-check.sh` checks that the running proxy refuses what it
must refuse.

## Releasing

1. Set the version in `package.json` and `package-lock.json` (`npm version <X.Y.Z> --no-git-tag-version`),
   move the `Unreleased` entries in `CHANGELOG.md` under it, and merge that to `main`.
2. Push a tag `v<X.Y.Z>` on that commit. A prerelease tag (`v<X.Y.Z>-rc.1`) works the same way and is
   published as a GitHub prerelease.
3. The `release` workflow checks that the tag matches `package.json`, builds `Kubernetes-<version>.tar.gz`
   with `percli plugin build`, attaches it and its `.sha256` to the GitHub release, and pushes
   `ghcr.io/astrona-io/perses-plugin-kubernetes:<tag>` for linux/amd64 and linux/arm64, with build
   provenance attestations for both.
4. Write the release notes on the GitHub release: the workflow leaves them empty.

## Pull requests

- Keep each pull request to one change, and describe what you checked.
- Add a line to `CHANGELOG.md` under an `Unreleased` heading.
- Sign off your commits (`git commit -s`) to certify the
  [Developer Certificate of Origin](https://developercertificate.org/).

By contributing you agree that your contribution is licensed under Apache-2.0, as the project is.
