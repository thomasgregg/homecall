# Changelog

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
