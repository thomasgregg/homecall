# Changelog

## 1.1.2

- Use Available speakers as the section heading, reserving Add speaker for the action.
- Explain when all detected speakers are already added without suggesting another integration is needed.

## 1.1.1

- Refine DLNA settings with native HA list rows, separate added-speaker and sound-test sections, and Refresh.
- Show registered offline renderers even when HA clears their advertised capabilities.
- Distinguish offline speakers from missing DLNA discovery and prevent testing offline candidates.
- Add offline-to-online settings refresh coverage.

## 1.1.0

- Add an optional per-speaker setting to restore interrupted DLNA tracks and seek positions where supported.

- Add generic DLNA renderer discovery, local MP3 delivery and a test-before-add flow.
- Split setup and settings into Alexa speakers and DLNA speakers; support DLNA-only installations.
- Keep DLNA test status separate from card visibility and require explicit sound confirmation.
- Add Chromium/WebKit setup tests and mixed-platform delivery coverage.

## 1.0.0

Initial public release of the HomeCall integration as an independent repository.

- Consistent HomeCall naming and separate installation/distribution.
- English and German UI.
- Automated behavior checks and documented development workflow.
- Authenticated audio delivery, allowed devices, native settings, and expiring MP3 links.
