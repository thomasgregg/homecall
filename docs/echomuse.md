# EchoMuse speakers

HomeCall can send recorded messages directly to EchoMuse Dots through Home Assistant’s ESPHome integration. Music Assistant is not required. Recording still uses the microphone in the HomeCall Card’s browser.

## Setup

1. Set up EchoMuse and connect each Dot to Home Assistant through ESPHome.
2. Open HomeCall → Configure → EchoMuse speakers.
3. Add the Dot and enable its visibility in the card, then save.
4. Play the optional sound test and verify you hear it. Send a real microphone recording next.

Discovery uses the device manufacturer `EchoMuse`, rather than the entity name. Online players must advertise both playback and announcement support. Disabled entities are excluded. Unavailable or unknown players remain listed but cannot receive messages. EchoMuse speakers require explicit selection even when all Alexa speakers are enabled.

## Delivery

HomeCall serves the recorded MP3 at a random, three-minute local audio URL and calls `media_player.play_media` with `media_content_type: audio/mpeg` and `announce: true`. EchoMuse manages music interruption and continuation; HomeCall’s optional DLNA restoration is not used.

Home Assistant may transcode the MP3 through its ESPHome audio proxy to EchoMuse’s advertised format. The EchoMuse controller must reach both the configured HomeCall local audio address and any HA-generated proxy address. Check Docker networking, VLAN rules, DNS and certificate validity when a command is accepted but nothing plays. No public audio URL or Amazon account is needed for this route. Browser recording still requires a secure context and microphone permission.

## Verification and limits

Support is implemented but has not been verified on physical EchoMuse hardware. The implementation was checked against EchoMuse’s current main-branch announcement code; older installed releases may differ. Check the player’s announcement capability and run the sound test.

Service acceptance does not confirm audible playback or completion. Audio retrieval is tracked separately and can reflect a proxy fetch. Multiple speakers receive commands concurrently; synchronized playback is not promised. The media-player service provides no completion acknowledgement, so successive announcements may overlap. Music restoration, Assist activity, mute behavior, ringing timers and controller reconnects require hardware testing. EchoMuse documents an announcement collision with a ringing timer.

Before claiming hardware verification, test short and 60-second recordings, music continuation, overlapping messages, Assist responses, timer alarms, offline devices and reconnects on the actual installed controller/firmware versions.
