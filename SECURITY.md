# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include the affected version or commit, steps to reproduce, and the impact you observed. You should get an acknowledgement within a few working days.

## Supported versions

Only the latest commit on `main` receives fixes.

## Deployment scope

Flipbook is designed to run **locally**. By default the Compose file binds the app to `127.0.0.1` only. If you expose it to a network, you are responsible for:

- serving it over HTTPS and setting `COOKIE_SECURE=true` and `PUBLIC_URL`
- restricting who can reach it
- protecting the `flipbook-data` volume and any backups, which contain account data, uploads and the event-signing secret

The security model is described in [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md).
