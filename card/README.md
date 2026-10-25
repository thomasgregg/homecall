# HomeCall Card source

HomeCall Card is bundled with the HomeCall integration from version 1.9.0. Its user guide, screenshots, configuration options and sizing examples live in the [main README's Dashboard card section](https://github.com/thomasgregg/homecall#dashboard-card). That link opens the repository README rather than GitHub's file viewer.

Install and update **HomeCall**. There is no separate card installation or release. For existing standalone installations, follow the [migration guide](../docs/card-migration.md). The card and integration share the version in `custom_components/homecall/manifest.json`.

## Source and build

- `src/homecall-card.js`: recording card, native editor and translations.
- `src/layout.js`: layout geometry and recipient popover bounds.
- `scripts/build.mjs`: build into `custom_components/homecall/frontend/homecall-card.js` in the integration repository.
- `tests/`: unit, geometry, distribution and browser checks.

The integration serves the bundle at `/homecall-assets/homecall-card.js` and registers it for UI-managed dashboard resources. YAML-managed resources use the documented module entry in the migration guide.

## Development

Use Node.js 22 or newer. From the **integration repository root**:

```sh
npm ci
npm ci --prefix card
npm run build:card
npm run format:card:check
npm run test:recorder
npm run test:card
npx playwright install chromium webkit
npm run test:browser
npm run test:card:browser
```

Edit source and commit the generated bundle with it. CI verifies a clean rebuild. On the documented Mac development environment, run browser tests outside the Codex sandbox as required by the workspace instructions.

Browser tests use stand-ins for native Home Assistant controls and simulated microphone input. They do not establish real HA styling, browser microphone permission behavior or audible speaker playback. Check those on a real installation when changing the relevant behavior.

## Further reading

- [User guide and screenshots](https://github.com/thomasgregg/homecall#dashboard-card)
- [Layout and recording states](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture and testing](docs/architecture.md)
- [Contributing and releases](../CONTRIBUTING.md)
- [Security and privacy](../SECURITY.md)
- [Changelog](../CHANGELOG.md)

Licensed under [MIT](LICENSE).
