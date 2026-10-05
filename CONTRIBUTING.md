# Contributing

Open an issue before a substantial behavior or architecture change. Include the concrete problem, expected result, and a minimal reproduction. Keep pull requests focused and add a regression test for a fixed bug.

## Setup and checks

Follow the development commands in [README](README.md). Python 3.14 and FFmpeg/ffprobe are required; tests import pinned Home Assistant modules.

Run `ruff check .`, `ruff format --check .`, and `pytest --cov=custom_components.homecall --cov-report=term-missing`.

## Reviewing behavior

Describe what changes for the user and what you tested. For UI changes, include idle and recording screenshots at the smallest supported card size, a normal size, and with the picker on and off. Check hover areas, timer/dot, border insets, and equal icon-only top/bottom spacing together. A passing helper test does not replace a native Home Assistant visual check.

Never include real credentials, recordings, delivery URLs, or personal dashboard screenshots in fixtures. Service-boundary fakes must fail loudly when unsupported methods are used.

## Release checklist

1. Update the version in `custom_components/homecall/manifest.json` and `pyproject.toml` and add a changelog entry.
2. Run all checks locally and confirm CI passes.
3. Check native setup and actual playback on the affected speaker routes in HA. Record hardware checks performed and any unverified routes in the release validation.
4. Tag `v<version>` and push the tag. The release workflow validates and publishes the distribution asset.
5. Install the published asset through HACS or the manual instructions to verify packaging.

MIT is the project's license. Contributions are provided under that license.

The administrative settings UI has browser regression tests. Run `npm ci`, install matching browsers with `npx playwright install chromium webkit`, then run `npm run test:browser`. Chromium and WebKit fixtures verify the six speaker groups, test confirmation, failure handling and selection preservation. They use native-control stand-ins; real HA styling and audible playback still need device checks.

## Integration UI conventions

Use Home Assistant components for controls: `ha-form` with native selectors, `ha-button`, `ha-checkbox`, `ha-alert`, and HA list components. Let components inherit their default theme colours, typography, icon sizing, and header styles. Use theme variables for supporting text; never hardcode colours or restyle control internals. Custom CSS should handle layout and spacing only. Primary actions use the native brand variant; secondary actions use plain brand buttons. Check long names and narrow screens before releasing.

## Release note format

Use this format for every release in both HomeCall repositories. Titles are `v<version> — <short summary>`; update `RELEASE_TITLE.txt` with that summary before tagging. Notes always contain these sections, in this order:

1. **Changes** — the version's changelog entry, describing user-visible behavior.
2. **Installation** — HACS and manual asset instructions, including the separate card/integration installation.
3. **Validation** — checks actually performed and any material validation limits. Never invent historical test results.
4. **Full changelog** — a link comparing the previous published release with this tag, or the initial tag's commits.

The release workflow generates notes with `scripts/release-notes.py`. Do not replace them with GitHub's generated changelog-only notes. If editing release notes afterward, preserve this structure and record any additional validation accurately.
