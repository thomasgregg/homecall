# Contributing to HomeCall Card

The card is part of HomeCall. Follow the [integration contribution and release checklist](../CONTRIBUTING.md). Edit source under `card/src/`; do not edit the generated integration bundle directly.

From the integration repository root, install both package lockfiles with `npm ci` and `npm ci --prefix card`. Run `npm run build:card`, `npm run format:card:check`, `npm run test:card`, and `npm run test:card:browser`. The settings and recorder suites also run in the parent repository. The integration release workflow publishes the card; there is no separate card release.

Browser tests use native-control stand-ins. Check real Home Assistant rendering for UI changes and actual speakers for playback changes. On this Mac, run Playwright outside the Codex sandbox as required by the workspace instructions. Never include credentials or real recordings in fixtures.
