# Troubleshooting

## An older or smaller layout remains visible

Check all open dashboard tabs. A tab keeps the JavaScript class it loaded until it refreshes; toggling configuration does not reload the resource. Update HomeCall and restart HA, then refresh each tab. The integration updates the content-versioned URL for UI-managed resources automatically. For YAML-managed resources, keep the versionless bundled URL from the [migration guide](../../docs/card-migration.md). Remove obsolete HomeCall resource URLs; if duplicate migrated entries remain, they should resolve to the same bundled URL.

Judge geometry outside the editor: the preview and dashboard edit handles change available width. Hiding the picker cannot remove the need for recording footer clearance, so the size increase may be small.

## Missing card or custom element error

Confirm `homecall-card.js` is registered as a JavaScript **module**, the resource URL loads successfully, and the YAML type is `custom:homecall-card`. Install or update HomeCall, which includes both the backend routes and card. See the [migration guide](../../docs/card-migration.md) for old resource URLs and YAML-managed resources.

## Microphone access fails

Use HTTPS, allow microphone access for this HA origin, check the OS input device, and verify another app has not blocked capture. Start with a current Chromium or Safari/WebKit browser. Browser permission errors appear in the card status.

The AudioWorklet module is supplied by the integration. If the card cannot load the recorder, update HomeCall, restart HA and refresh the dashboard. Recording readiness follows the first input samples, not a fixed delay.

## Delayed playback or missing opening words

The button shows preparation progress immediately after a tap; speak when it turns red and the waveform starts. The card prepares its recorder code and a suspended audio context ahead of time, but microphone access starts only on tap. Browser or OS microphone startup can still take time. Diagnostics include `recorder_prepared_before_tap` to distinguish prepared starts from starts that still need to load the recorder.

Enable **Show diagnostics** under **Troubleshooting** in the card editor (`show_diagnostics: true` in YAML). It defaults to off. After sending, open the status icon, expand **Diagnostics**, and use **Copy diagnostics**. Copy refreshes first-fetch timings when the trace is still available. Browser upload-request time includes network transfer, server processing and response; it is not pure upload time. HA timings identify body read, validation, conversion, per-target service calls, and time from clip creation to first audio GET. Acceptance and retrieval do not prove audible playback. Traces expire after three minutes and contain no recorded audio or bearer links.

In HomeCall settings, expand the speaker and use its regular sound test, then copy the available diagnostics. A sound test checks delivery independently of microphone capture; there is no separate Playback timing test or padded-notes control in the current UI.

## No speakers or send rejected

Check the integration’s speaker selection and available allowed Alexa, DLNA, Sonos, Music Assistant, Google Cast or EchoMuse entities. DLNA requires a confirmed sound test. A custom default target cannot bypass that allowlist. An empty explicit target list leaves the action unavailable until speakers are selected.

## Request accepted but audio did not play

Read [integration troubleshooting](https://github.com/thomasgregg/homecall/blob/main/docs/troubleshooting.md). The card reports request acceptance and audio retrieval, not acoustic playback.

For an issue, provide the HA and HomeCall versions, browser/OS, card YAML with private entity names removed, card dimensions, whether the picker is visible, and reproduction steps. Avoid including recorded speech or receipt tokens.

## DLNA playback

Add the speaker in HomeCall settings through a successful sound test first. Check **Show in the card** and its HA availability. The integration chooses the delivery route for each configured entity. Connection and test failures are handled in the integration’s DLNA settings. Playback replaces current media. Optional Resume music after announcements is configured per speaker in the integration, not in the card.

## Other local speakers

Add Sonos, Music Assistant, Google Cast or EchoMuse players in the integration’s matching speaker section, select card visibility and save. Sound tests are optional. Check that the speaker, server or controller can reach Home Assistant’s local audio address. Select one route per physical speaker to avoid duplicate messages.

Google Cast replaces current playback without automatic restoration. EchoMuse uses ESPHome announcement support and delegates music handling to its controller; community message playback is reported, while installed firmware/controller versions and music continuation remain unverified. See the integration’s [Google Cast guide](https://github.com/thomasgregg/homecall/blob/main/docs/google-cast.md) and [EchoMuse guide](https://github.com/thomasgregg/homecall/blob/main/docs/echomuse.md).
