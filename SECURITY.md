# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through
[GitHub security advisories](https://github.com/astrona-io/perses-plugin-kubernetes/security/advisories/new)
("Report a vulnerability" on the repository's Security tab).

Include the plugin and Perses versions, what you found, and how to reproduce it. We will acknowledge
the report, keep you updated on the fix, and credit you in the advisory unless you prefer otherwise.

What counts: any way to make a Perses instance using this plugin, with the default allow-list and
`deploy/rbac.yaml`, send a request to the API server other than a GET on a list endpoint, or read a
Secret, a token, logs, or anything through `exec`, `attach`, `portforward`, `proxy` or `watch`.

## Supported versions

Only the latest release receives security fixes.
