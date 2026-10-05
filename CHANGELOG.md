# Changelog

## 1.5.0

- Add direct Google Cast discovery, setup and a speaker section in the existing HomeCall settings page, with English/German text, optional sound tests and explicit card visibility.
- Deliver recorded MP3s over the local audio URL through `media_player.play_media`. Keep Cast separate from Alexa automatic selection and DLNA music restoration.
- Verify audible direct-Cast test-chime playback on a JBL Charge 5 Wi-Fi after enabling Google Cast in the speaker app. Phone-started YouTube Music remained stopped after interruption; receiver relaunch did not restore it. Nest devices, groups and microphone recordings through Cast remain unverified.
- Add simulated backend and Chromium/WebKit settings tests, a protocol-based compatibility table and recommendations for announcements, music continuation and Music Assistant setups. Direct Cast music restoration is not implemented.

## 1.4.0

- Add Music Assistant setup, player discovery and a separate speaker settings page. Send recordings through `music_assistant.play_announcement` and let Music Assistant manage music interruption and restoration.
- Verify audible HomeCall test-chime playback on a JBL Charge 5 Wi-Fi through Music Assistant 2.10.5 and AirPlay 2: music lowered during the announcement and returned to its previous volume afterward. Full pause/resume, microphone recordings through this route, groups and other protocols remain unverified on hardware.
- Allow Alexa, Sonos and Music Assistant speakers to be added directly, with optional sound tests. Keep downloaded-test and audible-confirmation requirements for DLNA onboarding.
- Save speaker additions, removals and visibility together; preserve pending selections across discovery refreshes. Keep separate speaker sections for each integration.
- Document Music Assistant installation, duplicate physical-speaker entries, delivery selection and playback limits.

## 1.3.0

- Add Sonos discovery and native announcement delivery with `announce: true`; let Sonos handle music restoration.
- Give DLNA and Sonos separate settings entries using one shared speaker screen and sound-test flow. Preserve existing selections and require audible test confirmation before adding speakers.
- Use matching speaker icons and leave a gap between Refresh and empty-list information.
- Add a README compatibility table distinguishing tested Alexa delivery, basic DLNA playback on JBL Charge 5 Wi-Fi, and Sonos awaiting hardware testing.
- Cover Sonos discovery, onboarding, delivery, platform filtering and selection preservation with simulated backend and browser checks.

## 1.2.4

- Add real Home Assistant setup screenshots and a compact README banner.
- Add Hassfest validation for submission to the HACS default repository list.
- Integration runtime behavior is unchanged.

## 1.2.3

- Display the existing banner through a standard Markdown image and PNG export for HACS compatibility.
- Preserve the original banner artwork and application behavior.

## 1.2.2

- Fix the README banner in HACS by using an absolute public image URL.
- Documentation-only change; recording and integration behavior are unchanged.

## 1.2.1

- Clarify the card’s 60-second countdown, automatic recording stop, and explicit Send action in the usage guide.
- Documentation release alongside HomeCall Card 1.1.0; integration runtime behavior is unchanged.

## 1.2.0

- Use matching compact Alexa and DLNA speaker lists with Select all and one page-level Save changes action.
- Keep DLNA resume settings in native expandable speaker rows and test progress, confirmation, and failures under the tested candidate.
- Remove repeated speaker icons, the separate Alexa selection-mode section, and the sound-interruption note.
- Save DLNA visibility and resume settings together; preserve pending changes through discovery refresh and speaker registration.
- Reuse HA cards, list rows, checkboxes, expansion panels, buttons, and alerts with theme-aware styling and English/German labels.
- Place Refresh above the expanded discovery list; use normal-weight headings and consistent secondary actions.
- Update DLNA setup instructions, playback limitations, and the architecture diagram for both delivery routes.

## 1.1.4

- Let native HA headers, icons, and controls inherit default theme styling; remove unused custom row styles.
- Document UI conventions and guard against hardcoded colours and native control replacements.

## 1.1.3

- Use the native HA dropdown for speaker selection and an info alert with separated confirmation actions.

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
