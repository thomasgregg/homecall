# Architecture and testing

## Source and distribution

`src/homecall-card.js` owns the custom element, native editor, recording lifecycle, and translations. `src/layout.js` contains deterministic geometry and recipient popover bounds. `scripts/build.mjs` bundles these into `custom_components/homecall/frontend/homecall-card.js` in the parent integration repository. The integration serves this self-contained module at `/homecall-assets/homecall-card.js` and registers it with Lovelace. Its build version comes from the integration manifest.

The checked-in bundle is generated; edit source, run `npm run build`, and commit source and bundle together. CI rebuilds and fails if they diverge.

## Audio lifecycle

The browser captures mono floating-point samples with an AudioWorklet, writes a PCM WAV payload locally, and sends it only when the user taps Send. The integration serves the recorder protocol v1 module at `/homecall-assets/homecall-recorder-worklet.js`. The recorder and card ship in the same integration release. Readiness acknowledges the first input quantum, including silence. Ordered chunks retain those samples, and stop flushes the partial final buffer before acknowledging completion. The processor enforces 60 seconds by sample count. Discard and disconnect stop capture immediately and invalidate asynchronous work using session tokens.

Microphone startup does not wait for a fresh status request. The card freezes the loaded recipient selection; the upload endpoint validates current availability and authorization. Diagnostics record browser durations separately from HA durations, so no timestamps are compared across machines. A separate diagnostic ID allows the originating HA user to retrieve stage timings without disclosing the audio bearer token.

While visible and ready, the card prepares a suspended audio context and loads the recorder module without requesting microphone access. A tap immediately shows preparation progress, resumes that context on the user gesture and requests a fresh microphone stream. Successful recording completion stops every microphone track and suspends the reusable context. Hiding or removing the card closes it; a final flush already in progress finishes before releasing capture. Cancellation during startup disposes its context so late work cannot resume a new recording. Diagnostics identify whether the recorder was prepared before the tap. Browser microphone acquisition still has unavoidable startup latency; speech before input samples arrive cannot be recovered.

Capture requests 48 kHz to match HA's accepted WAV format and keep a full minute below the upload size limit. Unexpected track termination or audio-context interruption releases capture and rejects the incomplete recording. The backend rechecks recipients after encoding and uses a lifecycle generation to prevent pending uploads or tests from sending or retaining new audio across unload/reload.

The backend owns encoding, allowed recipients, and delivery links for Alexa, DLNA, Sonos, Music Assistant, Google Cast and EchoMuse. The card uploads one recording with the selected entity IDs; it does not implement speaker protocols. The frontend never stores an Amazon credential or adds credentials to audio links.

## Test layers

1. Unit tests load the source in an isolated JavaScript VM and exercise session cancellation, immediate startup feedback, recorder preparation and cleanup, automatic reset, and selection retention.
2. Geometry tests cover card sizes, measured footer widths, and 72 popover containment scenarios.
3. Playwright loads the distributed bundle in Chromium and WebKit with controlled stand-ins for Home Assistant elements. Tests exercise the real mounted custom element and its `setConfig` rebuild, plus full-halo gaps, card-edge insets, and fixed geometry across phases. Browser-window resize tests use a fluid card width and the real ResizeObserver: widening, narrowing, rapid successive changes, the 200px control boundary, and the 172px regression case. They cover English/German and speaker selection on/off during idle, preparation, and recording, using the production countdown renderer. Additional checks cover full-size width and height changes, returning from compact layouts, two-line caption clearance, balanced top/bottom spacing, and the visible speaker/countdown group across one-row widths and states.
4. Hardware acceptance checks use an actual HA instance and devices on the affected playback routes. Native component styling and hardware playback cannot be proven by the stand-in browser fixture.

Playwright retains failure traces locally under `card/test-results/`; the current integration CI reports results in its job logs. The mock fixture never requests the microphone and never contacts Amazon.
