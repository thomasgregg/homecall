# Changelog

## 1.8.1

- Bound upload body reads and each speaker delivery service call to 30 seconds. Slow or stalled uploads return HTTP 408; timed-out deliveries are reported as rejected while successful peers retain their results. Release the shared send lock after timeout so subsequent messages and sound tests can proceed.
- Filter status speaker metadata by the requesting user's Home Assistant entity-read permissions. Require read/control permissions before consuming an upload and recheck them after encoding; preserve administrator access and HomeCall's configured speaker allowlist.
- Add 12 security regression cases covering stalled and trickling uploads, cancellation, delivery timeout and retry, sound-test cleanup, restricted status access, denied sends, permitted non-admin sends, and permissions revoked during encoding.
- Keep the existing card protocol and speaker delivery routes. No HomeCall Card update is required for these fixes.

## 1.8.0

- Add an optional global two-tone chime before recorded messages, off by default, with a direct Google Cast exception on by default. Keep one playback operation per recipient and disable Music Assistant's extra pre-announcement cue.
- Bundle the selected CC0 Freesound chime locally. Preserve full-length voice after the cue, expiry/privacy of both audio variants, and DLNA restoration duration. Direct Cast exclusion does not apply to MA players or groups; hardware verification remains pending.

- Remove the temporary four-note Playback timing test and its leading-silence variant from settings and the speaker-test API. Preserve the normal speaker sound test and private opt-in diagnostics.

- Clean up settings with native HA rows, aligned selection controls, padded notices, native diagnostics expansion and clearer test actions. Hide selection and Save on empty lists while preserving pending removals.

## 1.7.0

- Serve the AudioWorklet recorder used by HomeCall Card 1.2.0, with first-sample readiness, ordered capture and a complete final-buffer flush. Update both components, restart HA, then refresh the dashboard.
- Add short-lived, owner-scoped diagnostics for WAV validation, MP3 conversion, per-speaker service calls and first audio retrieval. Copied diagnostics contain no recorded audio, audio bearer token or speaker URL.
- Add optional four-note playback timing tests and an explicitly separate variant with two seconds of leading silence. Normal messages receive no added silence, chime or fixed delay.
- Recheck speaker availability and selection after encoding, and prevent pending uploads or tests from retaining or sending new audio after integration unload/reload.
- Preserve existing Alexa, DLNA, Sonos, Music Assistant, Cast and EchoMuse delivery routes. Automated checks pass; the reported EchoMuse/MA clipping and startup delay still need retesting on affected hardware.

## 1.6.0

- Add direct EchoMuse speaker discovery through ESPHome, setup, optional sound tests, explicit card visibility and local recorded-message announcements with `announce: true`. Music Assistant is not required.
- Keep offline EchoMuse speakers listed and require playback and announcement capabilities for online devices. Leave music interruption and continuation to EchoMuse.
- Give Connection its own overview section, remove the redundant Ready/device-count section and keep speaker connectors grouped together.
- Keep hardware-verification notes in documentation rather than settings and setup text.
- Add English/German guidance and simulated backend and Chromium/WebKit coverage. EchoMuse audible playback and music continuation remain hardware-unverified.

## 1.5.0

- Add direct Google Cast discovery, setup and a speaker section in the existing HomeCall settings page, with English/German text, optional sound tests and explicit card visibility.
- Deliver recorded MP3s over the local audio URL through `media_player.play_media`. Keep Cast separate from Alexa automatic selection and DLNA music restoration.
- Verify audible direct-Cast test-chime playback on a JBL Charge 5 Wi-Fi after enabling Google Cast in the speaker app. Phone-started YouTube Music remained stopped after interruption; receiver relaunch did not restore it. Nest devices, groups and microphone recordings through Cast remain unverified.
- Document the earlier Echo Show/TuneIn native radio-resume test with Alexa soundbank clips, separately from unverified HomeCall-recording restoration.
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
