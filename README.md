![HomeCall — Your voice. Every room.](https://raw.githubusercontent.com/thomasgregg/homecall/main/docs/assets/hero-compact.png)

<p align="center">
<a href="https://github.com/thomasgregg/homecall/actions/workflows/ci.yml"><img src="https://github.com/thomasgregg/homecall/actions/workflows/ci.yml/badge.svg" alt="Tests"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
<a href="https://hacs.xyz"><img src="https://img.shields.io/badge/HACS-custom_repository-41BDF5" alt="HACS custom repository"></a>
</p>

**Your voice. Every room.**

Call everyone to dinner, send a quick reminder, or announce that guests have arrived—in your own voice. Record with [HomeCall Card](#dashboard-card) in your Home Assistant dashboard, choose your speakers, and send. The HomeCall integration handles delivery.

Install **HomeCall** to get the integration and dashboard card together.

![HomeCall Card recording a message alongside the HomeCall integration settings](docs/assets/intro-screenshots.png)

## Contents

- [Why HomeCall](#why-homecall)
- [Screenshots](#screenshots)
- [Speaker compatibility](#speaker-compatibility)
- [Which setup should I use?](#which-setup-should-i-use)
- [Before you start](#before-you-start)
- [Install](#install)
  - [HACS](#hacs)
  - [Manual installation](#manual)
- [Use](#use)
- [Dashboard card](#dashboard-card)
- [How it works](#how-it-works)
- [Documentation](#documentation)
- [Development](#development)

## Why HomeCall

- **Original voice:** send recorded audio rather than synthesized speech.
- **One room or many:** announce to selected Alexa, DLNA, Sonos, Music Assistant, Google Cast or EchoMuse speakers.
- **Native setup:** configure the public address and speakers shown in the card through Home Assistant.
- **Short-lived audio:** recordings are held in memory and delivery links expire after three minutes.
- **Clear feedback:** distinguish request acceptance from audio retrieval.
- **English and German:** setup and settings follow the Home Assistant language.

## Screenshots

Overview and expanded DLNA speaker options in the HomeCall integration.

[![HomeCall settings overview and expanded DLNA speaker options](docs/assets/ui-configuration.svg)](docs/assets/ui-configuration.svg)

The bundled [HomeCall Card](#card-screenshots) provides the recording interface, with a live waveform, countdown, and speaker picker.

[![HomeCall Card recording a real microphone waveform with speaker selection enabled](docs/assets/ui-card-recording.png)](#card-screenshots)

## Speaker compatibility

**HomeCall supports Alexa/Echo, compatible DLNA speakers, Music Assistant players, Google Cast devices, Sonos through Home Assistant’s Sonos integration, and EchoMuse Dots through ESPHome.** Use Alexa through Home Assistant’s Alexa Devices integration, DLNA through DLNA Digital Media Renderer, Sonos through the Sonos integration, and Music Assistant players through the Music Assistant integration. You can combine these platforms.

DLNA speakers must pass a sound test before they can appear in the card. JBL Charge 5 Wi-Fi has been checked for basic MP3 playback; other renderers require their own test. Optional **Resume music after announcements** can restore the interrupted media item and seek where supported. It does not restore playlists, queues, or streaming-service sessions. See [DLNA configuration and limitations](docs/configuration.md#dlna-speakers).

Ideas and contributions for other speaker platforms are welcome. [Open an issue](https://github.com/thomasgregg/homecall/issues) to discuss support.

🟢 **Verified** on the noted setup · 🟠 **Unverified or conditional** · 🔴 **Unsupported or failed**

<table>
  <tr>
    <th valign="top">Protocol / integration</th>
    <th valign="top">Announcement playback</th>
    <th valign="top">Optional announcement chime</th>
    <th valign="top">Music continuation</th>
    <th valign="top">Tested hardware / scope</th>
  </tr>
  <tr>
    <td valign="top">Alexa Devices</td>
    <td valign="top">🟢 Recorded voice announcements verified.</td>
    <td valign="top">🟢 Optional chime confirmed by the user on their Alexa setup.</td>
    <td valign="top">🟢 TuneIn radio resumed after Alexa SSML soundbank clips.</td>
    <td valign="top">Echo Show with Deutschlandfunk/TuneIn and soundbank clips. HomeCall-recording resume and other sources/models untested.</td>
  </tr>
  <tr>
    <td valign="top">DLNA</td>
    <td valign="top">🟢 MP3 playback verified; recorded voice verification pending.</td>
    <td valign="top">🟠 Combined chime and recording implemented; hardware verification pending.</td>
    <td valign="top">🟠 Optional current-item restoration and seek where supported; hardware restoration unverified. No playlist/session restoration.</td>
    <td valign="top">JBL Charge 5 Wi-Fi; other renderers require the sound test.</td>
  </tr>
  <tr>
    <td valign="top">Sonos</td>
    <td valign="top">🟠 Implemented using native <code>announce: true</code>; direct Sonos hardware playback unverified.</td>
    <td valign="top">🟠 Combined chime and recording implemented; hardware verification pending.</td>
    <td valign="top">🟠 Delegated to Sonos; not hardware-verified.</td>
    <td valign="top">Simulated discovery, setup and service-call tests only. The community Sonos One SL test used Music Assistant, not this direct route.</td>
  </tr>
  <tr>
    <td valign="top">Music Assistant</td>
    <td valign="top">🟢 Recorded voice with the optional chime confirmed by the user on their tested MA setup. Community playback confirmed on Sonos One SL with MA 2.10.6. Separate Sync Group playback reported on Reddit.</td>
    <td valign="top">🟢 Combined two-tone chime and recording confirmed by the user. MA's additional pre-announcement cue is disabled. A Sonos One SL user reports the chime volume is good, but the recording is too loud. Other providers/groups need verification.</td>
    <td valign="top">🟢 Ducking, continuation and volume restoration verified with MA-managed music through AirPlay 2. A Sonos One SL user on MA 2.10.6 also confirms MA-managed music resumed at its previous volume. 🟠 A Reddit Sync Group report describes abrupt transitions and track-position behavior.</td>
    <td valign="top">Earlier ducking test: JBL Charge 5 Wi-Fi, AirPlay 2, MA 2.10.5. New combined-audio confirmation: user's MA setup. Community test: Sonos One SL, MA 2.10.6; playback, chime and restoration of MA-managed music confirmed (Sonos firmware/protocol unspecified). Reddit Sync Group models/protocols unspecified; full pause/resume unverified.</td>
  </tr>
  <tr>
    <td valign="top">EchoMuse (ESPHome)</td>
    <td valign="top">🟢 Recorded message playback and opening-cutoff fix confirmed by a Reddit user.</td>
    <td valign="top">🟠 Combined chime and recording implemented; hardware verification pending.</td>
    <td valign="top">🟠 Delegated to EchoMuse; hardware continuation unverified.</td>
    <td valign="top">User's EchoMuse Dots; installed firmware/controller versions unspecified. Music Assistant/SendSpin route not verified.</td>
  </tr>
  <tr>
    <td valign="top">Google Cast</td>
    <td valign="top">🟢 MP3 test playback verified on JBL; message playback reported by a Reddit Nest user.</td>
    <td valign="top">🟠 Skipped by default on direct Cast. Combined chime and recording available when the exception is disabled; hardware verification pending. Cast's native connection cue may still play.</td>
    <td valign="top">🔴 No automatic restoration. Phone-started YouTube Music remained stopped in our test.</td>
    <td valign="top">JBL Charge 5 Wi-Fi; Reddit Nest model unspecified. Specific Nest models and Cast groups need further tests.</td>
  </tr>
</table>

Results apply to the tested setup, not every model or firmware version. The optional announcement chime column refers to the new two-tone cue combined with a recording, not the standalone speaker sound test. The latest Music Assistant combined-audio test and Alexa optional-chime playback were confirmed by the user on 6 October 2026. The Alexa chime test does not establish music restoration. Reddit reports confirm limited EchoMuse and Nest message playback; they do not verify the new chime on those routes. The Sonos report was clarified as Sonos One SL through Music Assistant 2.10.6, with chime playback and restoration of MA-managed music at its previous volume confirmed. It does not verify the direct Sonos route; the recording was reported too loud. DLNA requires a downloaded sound test and audible confirmation before adding a speaker. The other integrations offer optional sound tests.

User reports: [Music Assistant Sync Group](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe579qq/), [EchoMuse cutoff fix](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe7g2wf/), [Nest playback](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe3tau1/).

The Alexa resume test used soundbank audio through the same Speak/SSML mechanism as HomeCall, with audible confirmation that the station resumed automatically. It did not test restoration after a HomeCall-hosted recorded MP3.

## Which setup should I use?

| Use case                                                                                | Recommended route                                                                                                               | What to expect                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Streaming music or playlists should continue after messages                             | **Music Assistant**, with music started through MA and announcements sent to its MA entity.                                     | MA owns the queue and handles announcements. Our AirPlay 2 test passed; test your chosen provider. MA supports many [music services](https://www.music-assistant.io/music-providers/), subject to provider and account requirements.                                           |
| Occasional messages on Nest or another Cast speaker, with music interruption acceptable | **Google Cast**.                                                                                                                | Simple local MP3 delivery, no MA server required. Current playback is replaced and does not automatically return. Specific Nest models and Cast groups require further tests.                                                                                                  |
| Keep casting YouTube Music directly from a phone and preserve its session               | 🔴 No verified HomeCall route for an audio-only Cast speaker. For dependable queue control, start music through **MA** instead. | Direct Cast interrupted our phone session; reopening the receiver did not restore it.                                                                                                                                                                                          |
| Existing Echo speakers                                                                  | **Alexa Devices**.                                                                                                              | Recorded voice playback is verified; Amazon must reach the public HTTPS audio URL. TuneIn radio resumed in the Echo Show soundbank test; recorded-MP3 restoration and other sources still need verification.                                                                   |
| EchoMuse-flashed Dots                                                                   | **EchoMuse (ESPHome)**.                                                                                                         | Local announcement delivery without Music Assistant or Amazon’s Alexa service. Requires an EchoMuse controller and compatible ESPHome firmware; community message playback is reported, while installed firmware/controller versions and music continuation need verification. |
| Existing Sonos system without MA                                                        | **Sonos**.                                                                                                                      | Uses Sonos’s native announcement support; direct playback, optional chime and music restoration still need a hardware test. If MA manages the music, use the MA entity.                                                                                                        |
| Basic local audio renderer without MA                                                   | **DLNA**.                                                                                                                       | Validate with the sound test. Optional resume handles a reusable current item where supported, rather than streaming-service sessions or full queues.                                                                                                                          |

Choose one HomeCall target per physical speaker. When MA manages the music, use its entity and hide the corresponding direct Cast/DLNA/Sonos entry from the card to avoid duplicate announcements. For MA groups, consult its [announcement group behavior](https://www.music-assistant.io/integration/announcements/#group-behaviour).

## Before you start

You need Home Assistant **2026.9 or newer** and FFmpeg with MP3 encoding. For Alexa, use the built-in [Alexa Devices integration](https://www.home-assistant.io/integrations/alexa_devices/) with working `notify.*_speak` entities. Amazon must be able to reach your Home Assistant instance over public HTTPS; Nabu Casa remote access or your own public HTTPS address can provide that connection. Open the recording dashboard through HTTPS and allow microphone access in your browser.

For DLNA, configure the built-in [DLNA Digital Media Renderer integration](https://www.home-assistant.io/integrations/dlna_dmr/) and ensure the speaker can reach HA’s local audio address. A public HTTPS address is not needed for DLNA delivery. The browser still needs HTTPS for microphone access.

For Sonos, configure Home Assistant’s [Sonos integration](https://www.home-assistant.io/integrations/sonos/), then choose speakers under **Sonos speakers**. A sound test is available in each speaker row and is optional. HomeCall uses `announce: true` and leaves music restoration to Sonos. Direct Sonos playback, optional chime and music restoration remain hardware-unverified. The community Sonos One SL report used Music Assistant 2.10.6, rather than this route. Simulated discovery, onboarding, and delivery tests pass. Older hardware and S1 firmware may have announcement limitations.

For Music Assistant, install and start the [Music Assistant server](https://www.music-assistant.io/), connect your speakers, and configure its [Home Assistant integration](https://www.home-assistant.io/integrations/music_assistant/), then open **HomeCall → Configure → Music Assistant speakers**, add players, select visibility, and save. HomeCall sends recorded MP3s through `music_assistant.play_announcement`; Music Assistant handles playback restoration. Choose the MA entity rather than the underlying DLNA/Sonos entity when music is managed by MA. The JBL Charge 5 Wi-Fi / AirPlay 2 test confirmed audible chime playback, music ducking and volume restoration. A community test on Sonos One SL with MA 2.10.6 confirmed announcement and chime playback, plus resumption of MA-managed music at its previous volume; the recording was reported too loud. Playback behavior depends on the player and protocol; see [Music Assistant configuration and tested scope](docs/configuration.md#music-assistant-announcements).

For Google Cast or Nest, configure HA’s Google Cast integration and add devices under **HomeCall → Configure → Google Cast speakers**. Direct playback interrupts music without automatic restoration. See the [Google Cast guide](docs/google-cast.md) for setup, network requirements, test results and music-continuation options.

HomeCall is a community project. It is not affiliated with Amazon or Home Assistant. Account, region, and Alexa service behavior can affect delivery; validate an announcement with your own devices before relying on it.

For EchoMuse, connect your Dots through Home Assistant’s ESPHome integration, then open **HomeCall → Configure → EchoMuse speakers**, add a Dot, enable visibility and play the sound test. Music Assistant and a public audio address are not required. The EchoMuse controller must reach Home Assistant’s local audio address and any ESPHome transcoding proxy URL. See [EchoMuse setup and limitations](docs/echomuse.md).

## Install

From **HomeCall 1.9.0**, the dashboard card ships with the integration. Update HomeCall, restart Home Assistant, then refresh every dashboard tab or reset the Companion app's frontend cache. Existing users should follow the [bundled-card migration guide](docs/card-migration.md).

### HACS

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=thomasgregg&repository=homecall&category=integration)

With HACS installed, click the button to open this custom repository in your Home Assistant instance. Add it when prompted, then choose **Download**. The dashboard card is included.

1. In HACS, open **Custom repositories**.
2. Add `https://github.com/thomasgregg/homecall` as an **Integration**.
3. Download HomeCall and restart Home Assistant.
4. Open **Settings → Devices & services → Add integration → HomeCall**.
5. Choose **Alexa speakers**, **DLNA speakers**, **Music Assistant**, **Google Cast speakers** or **EchoMuse speakers** in the setup menu. For Alexa, configure the public HTTPS address and speaker selection. For direct Sonos without Alexa, finish the local-only setup through **DLNA speakers**, then add your devices under **Configure → Sonos speakers**. For DLNA, open **Configure → DLNA speakers → Available speakers**, press **Test** beside an online speaker, then confirm **Yes, add speaker** if you heard it.
6. Refresh the dashboard and add **HomeCall** from the card picker. UI-managed dashboard resources are registered automatically; see the [migration guide](docs/card-migration.md) for YAML-managed resources.

### Manual

Download `homecall.zip` from the [latest release](https://github.com/thomasgregg/homecall/releases/latest) and extract its contents into `<config>/custom_components/homecall`. Alternatively, copy [`custom_components/homecall`](custom_components/homecall) from the repository to that location. Restart Home Assistant and follow steps 4–6 above. The bundled card is already included; no separate JavaScript download or npm build on Home Assistant is needed.

## Use

Add HomeCall Card to your dashboard. Tap the microphone to record. The timer counts down from **1:00** and the recording ring fills clockwise. At **0:00**, recording stops and the outlined Send icon appears; nothing is sent automatically. Tap **Send** to announce to the selected speakers, or send earlier while recording. **Discard** stops recording and clears the local audio. Configure speakers shown in the card and the delivery address from the integration's settings page.

An accepted request means the target’s Home Assistant service call completed successfully. An audio-fetch receipt means a client fetched the temporary audio URL. Neither receipt proves a speaker audibly played the message.

## Dashboard card

HomeCall includes its recording card. Install or update **HomeCall**, restart Home Assistant, and refresh the dashboard. UI-managed resources register automatically. Keep existing `type: custom:homecall-card` configurations; do not install the legacy HACS dashboard repository. See the [migration guide](docs/card-migration.md) for existing separate installations and YAML-managed resources.

Use Home Assistant **2026.9 or newer** and open the dashboard through a trusted **HTTPS** address with microphone permission. Ordinary HTTP LAN addresses cannot capture microphone audio. Local speaker delivery can still use HTTP; a public HTTPS delivery address is required only for Alexa.

### Card screenshots

These screenshots were captured in Home Assistant using the card editor's preview and microphone audio. Available width and saved layout settings can change the displayed size.

![HomeCall Card ready and recording](card/docs/assets/ui-states.png)

![HomeCall Card in a compact dashboard row and with the speaker picker open](card/docs/assets/ui-layouts.png)

![HomeCall Card configuration and layout editor](card/docs/assets/ui-editor-combined.png)

### Recording and delivery

1. Choose speakers, if the picker is visible.
2. Tap the blue microphone and allow browser microphone access.
3. A spinner immediately replaces the microphone while it prepares. Speak when the red microphone, recording dot, and ring appear. The timer starts only once microphone samples arrive; larger cards also show **Speak now**. The outer ring fills clockwise while the timer counts down from **1:00**.
4. Tap **Send**, or use **Discard** to start again.

At **0:00**, recording stops automatically and the button switches to a smaller outlined Send icon. It never sends automatically. Press **Send** or **Discard**; larger cards also show “Limit reached - ready to send.” After a fully accepted send, the card returns to ready after five seconds and preserves speaker selection. Partial failures stay visible for review. An audio-fetch receipt confirms retrieval, not audible playback.

Unavailable or missing default recipients produce an amber warning, even with diagnostics off. The card sends the recording to the available speakers. Open the warning for details: before sending, it lists the speakers that will be skipped; afterward, it shows how many accepted the announcement and which were skipped. Partial delivery keeps the microphone action: one tap starts a fresh recording. It never resends the previous audio. A failed send shows **Retry**. Warnings and errors stay until you act on them; opened details close when clicking outside or pressing Escape.

The speaker picker uses Home Assistant's native list controls. The second line shows the integration and availability, so two routes for the same physical speaker can be distinguished. Choose one route per physical speaker to avoid duplicate announcements. **Select all** chooses the currently available routes and clears the pending skipped-recipient warning. A recovered route is not automatically reselected.

Tapping Send finishes capture and sends directly. There is no local recording-review step; an older saved `preview_before_send` option is ignored.

### Card configuration

| Option                   | Type         | Default                                              | Meaning                                                                                                                                                                    |
| ------------------------ | ------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                   | string       | Required                                             | `custom:homecall-card`                                                                                                                                                     |
| `show_speaker_selection` | boolean      | `true`                                               | Show the recipient picker                                                                                                                                                  |
| `default_targets`        | string array | Integration defaults, otherwise all allowed speakers | Initial selection, using allowed Alexa `notify.*_speak` or configured DLNA, Sonos, Music Assistant, Google Cast or EchoMuse `media_player.*` entity IDs; `[]` selects none |
| `show_diagnostics`       | boolean      | `false`                                              | Optional timing details under Troubleshooting in the editor; delivery warnings and errors remain available when off                                                        |
| `grid_options`           | object       | 6 columns × 1 row                                    | Standard Home Assistant sections sizing                                                                                                                                    |

```yaml
type: custom:homecall-card
show_speaker_selection: false
default_targets:
  - notify.kitchen_speak
  - notify.living_room_speak
grid_options:
  columns: 6
  rows: 1
```

Defaults never bypass the integration's allowlist. Hiding the picker also hides the ability to change rooms in the card, so verify the default targets before hiding it.

### Card sizing

In a **Sections** dashboard, HomeCall defaults to **6 columns × 1 row** (half a section wide). The minimum supported height is **56px**. Set the size in the card editor's **Layout** tab, or use `grid_options` as above. Existing cards keep their saved dimensions until you resize them.

At **1 row**, the microphone and discard icon sit at the card's middle height. The speaker icon is centered on its own until the countdown appears; then the visible icon and countdown form a centered group with a clear gap between them. When the speaker picker is hidden, the countdown and recording dot sit at middle height. The waveform leaves space around the side controls. Speaker selection and longer status messages open in popovers outside the short card.

At **2 rows or more**, the card retains its taller layout, with the picker above and recording controls below. The text speaker selector uses a slimmer touch area. The main action scales to the available space; captions appear when there is enough room, with balanced bottom spacing and clearance for two lines. These layouts use the same Home Assistant icons, fonts, controls, and theme colors.

The circle keeps the same diameter through preparation and recording for a given card size. It scales with the actual available space, so the editor preview and dashboard can differ when their widths differ. Two-row cards retain footer clearance through the 200px width boundary; window resizing preserves timer and discard alignment.

Columns control width and rows control height. For example, use `columns: 12` and `rows: 3` for a larger card. Actual width depends on the dashboard and screen size. Masonry dashboards do not use `grid_options`; use a Sections view for the explicit 6 × 1 layout.

### Optional announcement chime

Enable **Play a chime before messages** under **HomeCall → Configure → Announcements** to play the bundled two-tone cue before your recording. It is off by default. **Skip the chime on direct Google Cast speakers** is on by default; turn it off to include the cue on those direct routes. Music Assistant targets still receive the HomeCall chime, while MA's own additional pre-announcement cue is disabled. Native Cast connection sounds may still play.

The card uploads one recording; the integration combines the cue and voice when needed. Speaker sound tests are unchanged. Verified routes and remaining hardware limits are listed in [Speaker compatibility](#speaker-compatibility).

For more detail, see [layout and recording states](card/docs/configuration.md) and [card troubleshooting](card/docs/troubleshooting.md). Developers can find the card source and checks in [card/](card/).

## How it works

```mermaid
flowchart TD
    Card[HomeCall Card] -->|Authenticated mono 16-bit PCM WAV + selected targets| API[HomeCall send API]
    API --> Validate[Validate WAV, size and allowed online targets]
    Validate --> Encode[FFmpeg: voice MP3 + optional chime-and-voice MP3]
    Encode --> Store[In-memory variants: separate random tokens, 3-minute expiry]
    Store --> Route{Revalidated targets: concurrent service calls}
    Route -->|Alexa| Notify[Alexa Devices: notify.send_message]
    Notify -->|SSML with public HTTPS audio URL| Amazon[Amazon Alexa service]
    Route -->|Tested DLNA| Play[DLNA DMR: media_player.play_media]
    Play -->|Local audio URL; type music| Speaker[DLNA renderer]
    Route -->|Sonos| SonosService["Sonos: media_player.play_media<br/>announce: true"]
    SonosService -->|Local audio URL; type music| SonosPlayer[Sonos native announcement]
    Route -->|Music Assistant| MAService["music_assistant.play_announcement<br/>use_pre_announce: false"]
    MAService -->|Local audio URL| MAPlayer[Music Assistant managed player]
    Amazon -->|Fetch MP3| Audio[Token-only audio endpoint: no HA login]
    Speaker -->|Fetch MP3| Audio
    SonosPlayer -->|Fetch MP3| Audio
    MAPlayer -->|Fetch MP3 directly or through provider| Audio
    Route -->|Google Cast| CastService[Cast: media_player.play_media]
    CastService -->|Local audio URL; type audio/mpeg| CastPlayer[Google Cast device: direct playback]
    CastPlayer -->|Fetch MP3| Audio
    Route -->|EchoMuse| EchoService["ESPHome: media_player.play_media<br/>announce: true; type audio/mpeg"]
    EchoService -->|Audio URL over ESPHome API| EchoController[EchoMuse controller]
    EchoController -->|Fetch MP3 directly when no proxy is used| Audio
    EchoController -->|Fetch transcoded audio when needed| Proxy[HA ESPHome audio proxy]
    Proxy -->|Fetch source MP3| Audio
    EchoController -->|Decoded audio stream| EchoDot[EchoMuse Dot]
    Store -.->|Clip bytes| Audio
    Audio -->|Count non-HEAD fetches across variants| Receipt[Status API: aggregate fetch count and diagnostics]
    Card -->|Authenticated receipt or diagnostic polling| Receipt
    API -->|Per-target service acceptance, receipt and diagnostics| Card
    Play -.->|If resume enabled: snapshot before service call| Resume[Optional DLNA resume manager]
    Speaker -.->|Playback state events via HA| Resume
    Resume -.->|Attempt previous-item restoration after detected completion| Speaker
```

The voice-only MP3 is always encoded. When the optional HomeCall chime is enabled for any selected target, a second MP3 contains the chime followed by the voice; Google Cast skips this chime by default. Each variant has its own expiring token, and HomeCall selects the variant per target. Music Assistant's own pre-announcement is disabled. Both variants contribute to the same announcement's aggregate fetch count.

Alexa uses the public HTTPS delivery address; DLNA, Sonos, Music Assistant, Google Cast and EchoMuse use the local address. The audio endpoint requires possession of the random token URL rather than a Home Assistant login. Tokens expire three minutes after clip creation. The bundled card uses authenticated upload and status APIs.

Sonos, Music Assistant and EchoMuse receive native announcement commands; playback continuation is delegated to their integration, provider or firmware and is not guaranteed by HomeCall. Direct Google Cast playback replaces the current media without HomeCall restoration. For EchoMuse, Home Assistant sends the URL through ESPHome to the controller, which decodes audio and streams it to the Dot. When Home Assistant uses its ESPHome transcoding proxy, the controller fetches the proxy URL and the proxy fetches HomeCall's source MP3. The controller must be able to reach the URL it receives; see [EchoMuse delivery](docs/echomuse.md#delivery) and [ESPHome audio proxy support](https://esphome.io/components/media_player/speaker/).

HomeCall's resume manager is used only for DLNA speakers with resume enabled. Before delivery, it captures reusable current media, position and playing/paused state. It attempts restoration only after matching playback events indicate that the announcement started and finished. User interruption, changed media, unavailable players or missing completion events cancel the attempt. It restores the previous item, seeks if supported, and restores a paused state where supported; it does not reconstruct a full queue or streaming-service session.

Service calls are dispatched concurrently, without synchronized playback or a completion acknowledgement. Acceptance means the Home Assistant service call completed successfully. A fetch count means the audio endpoint served a non-HEAD request, possibly from a proxy; it does not prove audible playback, identify every successful speaker, or confirm restoration. Route-specific hardware verification and limitations are listed in the compatibility table above.

## Documentation

| Guide                                      | Covers                                                                |
| ------------------------------------------ | --------------------------------------------------------------------- |
| [Configuration](docs/configuration.md)     | Public address, speakers shown in the card, and changing settings     |
| [EchoMuse](docs/echomuse.md)               | ESPHome setup, audio delivery and playback limitations                |
| [Google Cast / Nest](docs/google-cast.md)  | Cast setup, network requirements, test results and music continuation |
| [API and architecture](docs/api.md)        | Endpoints, limits, audio lifecycle, and module responsibilities       |
| [Troubleshooting](docs/troubleshooting.md) | Missing devices, microphone access, conversion, and delivery          |
| [Privacy and security](SECURITY.md)        | Authentication, audio access, retention, and reporting                |
| [Contributing](CONTRIBUTING.md)            | Development setup, test commands, and release checks                  |
| [Changelog](CHANGELOG.md)                  | Public version history                                                |

## Development

```sh
python3.14 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
# Install ffmpeg and ffprobe with your operating system's package manager.
ruff check .
ruff format --check .
pytest --cov=custom_components.homecall --cov-report=term-missing
npm ci
npm ci --prefix card
npm run build:card
npm run test:recorder
npm run test:card
npx playwright install chromium webkit
npm run test:browser
npm run test:card:browser
```

Tests import real Home Assistant modules and exercise WAV parsing, real FFmpeg conversion, HTTP handler behavior, settings permissions, device filtering, expiring tokens, and configuration flows. Service calls are mocked so tests do not contact Amazon or announce to real speakers. Audible playback and music handling require route-specific hardware acceptance checks; see the compatibility table for the checks actually performed.

Licensed under [MIT](LICENSE). Built and maintained by [Thomas Gregg](https://github.com/thomasgregg).
