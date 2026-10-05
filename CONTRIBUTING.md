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
3. Check native setup and one actual Alexa announcement in HA.
4. Tag `v<version>` and push the tag. The release workflow validates and publishes the distribution asset.
5. Install the published asset through HACS or the manual instructions to verify packaging.

MIT is the project's license. Contributions are provided under that license.

The administrative settings UI has browser regression tests. Run `npm ci`, install matching browsers with `npx playwright install chromium webkit`, then run `npm run test:browser`. Chromium and WebKit fixtures verify the two speaker groups, test confirmation, failure handling and selection preservation. They use native-control stand-ins; real HA styling and audible playback still need device checks.
