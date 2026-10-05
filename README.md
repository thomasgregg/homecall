![HomeCall — your voice across your home](https://raw.githubusercontent.com/thomasgregg/homecall/main/docs/assets/hero-compact.png)

<p align="center">
<a href="https://github.com/thomasgregg/homecall/actions/workflows/ci.yml"><img src="https://github.com/thomasgregg/homecall/actions/workflows/ci.yml/badge.svg" alt="Tests"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
<a href="https://hacs.xyz"><img src="https://img.shields.io/badge/HACS-custom_repository-41BDF5" alt="HACS custom repository"></a>
</p>

**Record a message in Home Assistant. Hear your own voice on your speakers.**

HomeCall turns microphone recordings into short speaker announcements. It handles authenticated uploads, audio conversion, speakers shown in the card, and temporary delivery links. The separately installed [HomeCall Card](https://github.com/thomasgregg/homecall-card) provides the recording interface.

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

Overview and Music Assistant setup in Home Assistant.

[![HomeCall settings overview and Music Assistant speaker setup](docs/assets/ui-configuration.svg)](docs/assets/ui-configuration.svg)

Full-size: [overview](docs/assets/ui-overview.png) · [Music Assistant](docs/assets/ui-music-assistant.png).

The separately installed [HomeCall Card](https://github.com/thomasgregg/homecall-card#screenshots) provides the recording interface, with a live waveform, countdown, and speaker picker.

[![HomeCall Card recording a real microphone waveform with speaker selection enabled](docs/assets/ui-card-recording.png)](https://github.com/thomasgregg/homecall-card#screenshots)

## Speaker compatibility

**HomeCall supports Alexa/Echo, compatible DLNA speakers, Music Assistant players, Google Cast devices, Sonos through Home Assistant’s Sonos integration, and EchoMuse Dots through ESPHome.** Use Alexa through Home Assistant’s Alexa Devices integration, DLNA through DLNA Digital Media Renderer, Sonos through the Sonos integration, and Music Assistant players through the Music Assistant integration. You can combine these platforms.

DLNA speakers must pass a sound test before they can appear in the card. JBL Charge 5 Wi-Fi has been checked for basic MP3 playback; other renderers require their own test. Optional **Resume music after announcements** can restore the interrupted media item and seek where supported. It does not restore playlists, queues, or streaming-service sessions. See [DLNA configuration and limitations](docs/configuration.md#dlna-speakers).

Ideas and contributions for other speaker platforms are welcome. [Open an issue](https://github.com/thomasgregg/homecall/issues) to discuss support.

🟢 **Verified** on the noted setup · 🟠 **Unverified or conditional** · 🔴 **Unsupported or failed**

| Protocol / integration | Announcement playback | Music continuation | Tested hardware / scope |
| --- | --- | --- | --- |
| Alexa Devices | 🟢 Recorded voice announcements verified. | 🟢 TuneIn radio resumed after Alexa SSML soundbank clips. | Echo Show with Deutschlandfunk/TuneIn and soundbank clips. HomeCall-recording resume and other sources/models untested. |
| DLNA | 🟢 MP3 playback verified. | 🟠 Optional current-item restoration and seek where supported; hardware restoration unverified. No playlist/session restoration. | JBL Charge 5 Wi-Fi; other renderers require the sound test. |
| Sonos | 🟠 Implemented using native `announce: true`; hardware playback unverified. | 🟠 Delegated to Sonos; not hardware-verified. | Simulated discovery, setup and service-call tests only. |
| Music Assistant | 🟢 MP3 test chime verified through AirPlay 2; other providers unverified. | 🟢 Ducking, continuation and volume restoration verified with MA-managed music through AirPlay 2. | JBL Charge 5 Wi-Fi, MA 2.10.5. Other providers, groups and full pause/resume untested. |
| EchoMuse (ESPHome) | 🟠 Implemented with `announce: true`; hardware playback unverified. | 🟠 Delegated to EchoMuse; hardware continuation unverified. | Automated discovery, selection and delivery tests only. |
| Google Cast | 🟢 HomeCall MP3 test chime verified. | 🔴 No automatic restoration. Phone-started YouTube Music remained stopped in our test. | JBL Charge 5 Wi-Fi; Nest Mini, Nest Hub and groups still need hardware tests. |

Results apply to the tested setup, not every model or firmware version. The DLNA, MA and Cast hardware checks used generated MP3s; microphone recordings through these routes still need separate verification. DLNA requires a downloaded sound test and audible confirmation before adding a speaker. The other integrations offer optional sound tests.


The Alexa resume test used soundbank audio through the same Speak/SSML mechanism as HomeCall, with audible confirmation that the station resumed automatically. It did not test restoration after a HomeCall-hosted recorded MP3.

## Which setup should I use?

| Use case | Recommended route | What to expect |
| --- | --- | --- |
| Streaming music or playlists should continue after messages | **Music Assistant**, with music started through MA and announcements sent to its MA entity. | MA owns the queue and handles announcements. Our AirPlay 2 test passed; test your chosen provider. MA supports many [music services](https://www.music-assistant.io/music-providers/), subject to provider and account requirements. |
| Occasional messages on Nest or another Cast speaker, with music interruption acceptable | **Google Cast**. | Simple local MP3 delivery, no MA server required. Current playback is replaced and does not automatically return. Nest hardware still needs testing. |
| Keep casting YouTube Music directly from a phone and preserve its session | 🔴 No verified HomeCall route for an audio-only Cast speaker. For dependable queue control, start music through **MA** instead. | Direct Cast interrupted our phone session; reopening the receiver did not restore it. |
| Existing Echo speakers | **Alexa Devices**. | Recorded voice playback is verified; Amazon must reach the public HTTPS audio URL. TuneIn radio resumed in the Echo Show soundbank test; recorded-MP3 restoration and other sources still need verification. |
| Existing Sonos system without MA | **Direct Sonos**. | Uses Sonos’s native announcement support; audible playback and restoration still need a hardware test. If MA manages the music, use the MA entity. |
| Basic local audio renderer without MA | **DLNA**. | Validate with the sound test. Optional resume handles a reusable current item where supported, rather than streaming-service sessions or full queues. |

Choose one HomeCall target per physical speaker. When MA manages the music, use its entity and hide the corresponding direct Cast/DLNA/Sonos entry from the card to avoid duplicate announcements. For MA groups, consult its [announcement group behavior](https://www.music-assistant.io/integration/announcements/#group-behaviour).

## Before you start

You need Home Assistant **2026.9 or newer** and FFmpeg with MP3 encoding. For Alexa, use the built-in [Alexa Devices integration](https://www.home-assistant.io/integrations/alexa_devices/) with working `notify.*_speak` entities. Amazon must be able to reach your Home Assistant instance over public HTTPS; Nabu Casa remote access or your own public HTTPS address can provide that connection. Open the recording dashboard through HTTPS and allow microphone access in your browser.

For DLNA, configure the built-in [DLNA Digital Media Renderer integration](https://www.home-assistant.io/integrations/dlna_dmr/) and ensure the speaker can reach HA’s local audio address. A public HTTPS address is not needed for DLNA delivery. The browser still needs HTTPS for microphone access.

For Sonos, configure Home Assistant’s [Sonos integration](https://www.home-assistant.io/integrations/sonos/), then choose speakers under **Sonos speakers**. A sound test is available in each speaker row and is optional. HomeCall uses `announce: true` and leaves music restoration to Sonos. Simulated discovery, onboarding, and delivery tests pass; physical Sonos playback has not yet been verified. Older hardware and S1 firmware may have announcement limitations.

For Music Assistant, install and start the [Music Assistant server](https://www.music-assistant.io/), connect your speakers, and configure its [Home Assistant integration](https://www.home-assistant.io/integrations/music_assistant/), then open **HomeCall → Configure → Music Assistant speakers**, add players, select visibility, and save. HomeCall sends recorded MP3s through `music_assistant.play_announcement`; Music Assistant handles playback restoration. Choose the MA entity rather than the underlying DLNA/Sonos entity when music is managed by MA. The JBL Charge 5 Wi-Fi / AirPlay 2 test confirmed audible chime playback, music ducking and volume restoration. Playback behavior depends on the player and protocol; see [Music Assistant configuration and tested scope](docs/configuration.md#music-assistant-announcements).

For Google Cast or Nest, configure HA’s Google Cast integration and add devices under **HomeCall → Configure → Google Cast speakers**. Direct playback interrupts music without automatic restoration. See the [Google Cast guide](docs/google-cast.md) for setup, network requirements, test results and music-continuation options.

HomeCall is a community project. It is not affiliated with Amazon or Home Assistant. Account, region, and Alexa service behavior can affect delivery; validate an announcement with your own devices before relying on it.

For EchoMuse, connect your Dots through Home Assistant’s ESPHome integration, then open **HomeCall → Configure → EchoMuse speakers**, add a Dot, enable visibility and play the sound test. Music Assistant and a public audio address are not required. The EchoMuse controller must reach Home Assistant’s local audio address and any ESPHome transcoding proxy URL. See [EchoMuse setup and limitations](docs/echomuse.md).

## Install

### HACS

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=thomasgregg&repository=homecall&category=integration)

With HACS installed, click the button to open this custom repository in your Home Assistant instance. Add it when prompted, then choose **Download**. Install the integration and card separately.

1. In HACS, open **Custom repositories**.
2. Add `https://github.com/thomasgregg/homecall` as an **Integration**.
3. Download HomeCall and restart Home Assistant.
4. Open **Settings → Devices & services → Add integration → HomeCall**.
5. Choose **Alexa speakers**, **DLNA speakers**, **Sonos speakers** or **Music Assistant speakers** or **Google Cast speakers**. For Alexa, configure the public HTTPS address and speaker selection. For DLNA, finish setup, then open **Configure → DLNA speakers → Available speakers**, press **Test** beside an online speaker, then confirm **Yes, add speaker** if you heard it.
6. Install [HomeCall Card](https://github.com/thomasgregg/homecall-card) separately.

### Manual

Copy [`custom_components/homecall`](custom_components/homecall) into `<config>/custom_components/homecall`, restart Home Assistant, and follow steps 4–6 above. Do not place the dashboard card inside the integration directory.

## Use

Add HomeCall Card to your dashboard. Tap the microphone to record. In HomeCall Card 1.1.0, the timer counts down from **1:00** and the recording ring fills clockwise. At **0:00**, recording stops and the outlined Send icon appears; nothing is sent automatically. Tap **Send** to announce to the selected speakers, or send earlier while recording. **Discard** stops recording and clears the local audio. Configure speakers shown in the card and the delivery address from the integration's settings page.

An accepted request means the target’s Home Assistant service call completed successfully. An audio-fetch receipt means a client fetched the temporary audio URL. Neither receipt proves a speaker audibly played the message.

## How it works

```mermaid
flowchart TD
    Card[HomeCall Card] -->|Authenticated mono WAV + selected targets| API[HomeCall API]
    API --> Validate[Validate audio and allowed targets]
    Validate --> Encode[FFmpeg: encode one MP3]
    Encode --> Store[In-memory clip: random token, 3-minute expiry]
    Store --> Route{Selected targets}
    Route -->|Alexa| Notify[Alexa Devices: notify.send_message]
    Notify -->|Public HTTPS audio URL| Amazon[Amazon Alexa service]
    Route -->|Tested DLNA| Play[DLNA DMR: media_player.play_media]
    Play -->|Local audio URL| Speaker[DLNA renderer]
    Route -->|Sonos| SonosService[Sonos: media_player.play_media announce]
    SonosService -->|Local audio URL| SonosPlayer[Sonos native announcement]
    Route -->|Music Assistant| MAService[music_assistant.play_announcement]
    MAService -->|Local audio URL| MAPlayer[Music Assistant managed player]
    Amazon -->|Fetch MP3| Audio[Token-protected audio endpoint]
    Speaker -->|Fetch MP3| Audio
    SonosPlayer -->|Fetch MP3| Audio
    MAPlayer -->|Fetch MP3| Audio
    Route -->|Google Cast| CastService[Cast: media_player.play_media]
    CastService -->|Local audio URL| CastPlayer[Google Cast device]
    CastPlayer -->|Fetch MP3| Audio
    Store -.->|Clip bytes| Audio
    Audio -->|Increment clip fetch count| Receipt[Receipt status]
    Card -->|Authenticated receipt polling| Receipt
    API -->|Per-target service acceptance + receipt| Card
    Speaker -.->|Playback state via HA| Resume[Optional resume manager]
    Resume -.->|Restore media after completion; seek if supported| Speaker
```

Alexa uses the public HTTPS delivery address; DLNA, Sonos, Music Assistant and Google Cast use the local address for the same in-memory clip and expiring token. Sonos and Music Assistant manage their announcement playback and restoration; HomeCall offers its own optional restoration only for DLNA. The card is installed separately and communicates only with HomeCall’s authenticated API. Music restoration depends on renderer capabilities and playback-state events; it is not guaranteed by a successful sound test.

## Documentation

| Guide                                      | Covers                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| [Configuration](docs/configuration.md)     | Public address, speakers shown in the card, and changing settings |
| [Google Cast / Nest](docs/google-cast.md) | Cast setup, network requirements, test results and music continuation |
| [API and architecture](docs/api.md)        | Endpoints, limits, audio lifecycle, and module responsibilities   |
| [Troubleshooting](docs/troubleshooting.md) | Missing devices, microphone access, conversion, and delivery      |
| [Privacy and security](SECURITY.md)        | Authentication, audio access, retention, and reporting            |
| [Contributing](CONTRIBUTING.md)            | Development setup, test commands, and release checks              |
| [Changelog](CHANGELOG.md)                  | Public version history                                            |

## Development

```sh
python3.14 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
# Install ffmpeg and ffprobe with your operating system's package manager.
ruff check .
ruff format --check .
pytest --cov=custom_components.homecall --cov-report=term-missing
```

Tests import real Home Assistant modules and exercise WAV parsing, real FFmpeg conversion, HTTP handler behavior, settings permissions, device filtering, expiring tokens, and configuration flows. Service calls are mocked so tests do not contact Amazon or announce to real speakers. Audible Alexa/DLNA playback and DLNA music restoration remain hardware acceptance checks.

Licensed under [MIT](LICENSE). Built and maintained by [Thomas Gregg](https://github.com/thomasgregg).
