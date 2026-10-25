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

### Diagnose missing opening audio

Expand the configured Dot and use its regular sound test to check the MP3/ESPHome delivery path independently of microphone capture. The current settings UI has no separate note-sequence or leading-silence diagnostic controls. Normal recordings receive no diagnostic padding or fixed startup delay; the optional announcement chime is configured separately under Announcements.

Speak only when the card shows it is recording. The current card sends directly and has no local recording-review step. Copy **Diagnostics** after the test or send, and include the installed EchoMuse controller/firmware versions. Fetch counts can reflect HA's transcoding proxy, so they do not establish audible playback. EchoMuse's own `primeWait`, underrun and playback-completion logs can identify the next stage.

A [Reddit user](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe7g2wf/) confirmed recorded message playback on their physical EchoMuse Dots and that the opening-cutoff fix worked. Their installed firmware/controller versions were not specified. This does not verify the new optional chime, music continuation or the Music Assistant/SendSpin route. The implementation was checked against EchoMuse’s current main-branch announcement code; older installed releases may differ. Check the player’s announcement capability and run the sound test.

Service acceptance does not confirm audible playback or completion. Audio retrieval is tracked separately and can reflect a proxy fetch. Multiple speakers receive commands concurrently; synchronized playback is not promised. The media-player service provides no completion acknowledgement, so successive announcements may overlap. Music restoration, Assist activity, mute behavior, ringing timers and controller reconnects require hardware testing. EchoMuse documents an announcement collision with a ringing timer.

For broader hardware coverage, test short and 60-second recordings, music continuation, overlapping messages, Assist responses, timer alarms, offline devices and reconnects on the actual installed controller/firmware versions.
