# Security policy

## Reporting a vulnerability

Report a security problem in letsauth.eu or in this repository privately, by either route:

- a [private security advisory](https://github.com/letsauthlab/letsauth/security/advisories/new) on
  GitHub, or
- email to `letsauth@janbrennenstuhl.eu`.

Please do not open a public issue for it. Include what you found, where, and how to reproduce it.
This is a one-person project, so please allow a few days for a reply. Once a fix is out, you are
credited in the advisory unless you ask not to be.

The same contact is published at
[`/.well-known/security.txt`](https://letsauth.eu/.well-known/security.txt) (RFC 9116). Renew its
`Expires` date before it passes.

## Scope

In scope: the website at letsauth.eu, its build and deploy workflows, and the scanner code in this
repository.

Out of scope: the MCP servers, authorization servers and products listed in the atlases. Report
problems in those to their vendors. A wrong cell in the atlas is not a security issue; correct it
through the [contribution guide](https://letsauth.eu/contribute/).

## Supported versions

The site is deployed continuously from `main`. Only `main` receives fixes.
