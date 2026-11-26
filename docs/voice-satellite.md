# Voice Satellite speakers

HomeCall can send recorded messages to browser kiosks and tablets running [Voice Satellite](https://github.com/jxlarrea/voice-satellite-card-integration). Each kiosk plays the message through the Voice Satellite card in its own browser. Any browser or kiosk app that runs the card can receive messages, for example a Windows kiosk running HA WinKiosk or an Android tablet.

## Setup

1. Install Voice Satellite, add a satellite for each kiosk, and open a dashboard with the Voice Satellite card on that kiosk.
2. Open HomeCall → Configure → Voice Satellite speakers.
3. Add the kiosk, enable its visibility in the card, then save.
4. Play the sound test, then send a real microphone recording.

Discovery lists each Voice Satellite `assist_satellite` entity whose device also has its Voice Satellite media player enabled. The speaker name is the satellite's device name. Disabled entities are excluded. A kiosk is unavailable while no browser has its Voice Satellite card open. Unavailable kiosks remain listed but cannot receive messages. Voice Satellite speakers require explicit selection even when all Alexa speakers are enabled.

If a saved kiosk no longer appears in discovery, HomeCall shows its entity ID and marks it offline. Its settings are kept if the entity returns. Use **Remove** to clear a kiosk you no longer use.

## Delivery

HomeCall calls `media_player.play_media` on the kiosk's Voice Satellite media player with `media_content_type: audio/mpeg` and `announce: true`. This is the same route `tts.speak` and Chime TTS use to reach the kiosk. The optional HomeCall chime is part of the clip.

The clip is passed as a root-relative path. The Voice Satellite card signs it and fetches it from the address the kiosk already uses to open Home Assistant, so it works whether the kiosk uses HTTP or HTTPS. HomeCall's **Local address** setting is not used for this route.

HomeCall does not use `assist_satellite.announce`. For that action, Home Assistant builds an absolute URL from its internal URL. When the internal URL is `http://…` and the kiosk opens Home Assistant over HTTPS, the browser blocks the audio: the satellite shows the announcement but plays nothing.

The message replaces anything playing on the kiosk's media player and plays at that player's volume. Voice Satellite does not resume the previous media afterwards. There is no on-screen announcement, and the kiosk's screensaver or display sleep is not changed.

Users who are not administrators need read and control access to both the satellite and its media player.

## Recording on the kiosk

The HomeCall Card can also run on the kiosk to record messages. Browser recording needs a secure context (HTTPS or `localhost`) and microphone permission. HA WinKiosk grants microphone permission to the page when its microphone setting is on.

## Verification and limits

This route was built against Voice Satellite 2026.9.13. Discovery, selection, sound tests and delivery are covered by simulated backend and browser tests. On 25 November 2026, the user confirmed recorded message playback on their HA WinKiosk tablets. The tablets open Home Assistant over HTTPS while its internal URL is HTTP. Installed HA, Voice Satellite and HA WinKiosk versions were not recorded. An earlier development build that used `assist_satellite.announce` showed the announcement on the same tablets but played no audio.

The optional chime, other kiosk apps and Android tablets have not been verified. Acceptance means the media player accepted the command. A fetch count means the kiosk's browser downloaded the clip. Neither confirms audible playback. Autoplay restrictions, a muted satellite media player and the kiosk's output device can still prevent sound.
