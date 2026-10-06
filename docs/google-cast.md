# Google Cast / Nest

[Back to HomeCall](../README.md) · [General configuration](configuration.md)

## Setup

Configure Home Assistant’s [Google Cast integration](https://www.home-assistant.io/integrations/cast/), then open **HomeCall → Configure → Google Cast speakers**. Add your Nest Mini, Nest Hub or other Cast device, choose whether it appears in the card, and save. Expand the added device to play the optional sound test.

## Audio delivery

HomeCall sends the recorded MP3 directly through `media_player.play_media`. The Cast device must be able to reach Home Assistant’s local audio URL. If necessary, set **Connection → Local address** to a LAN IP address and port, for example `http://192.168.1.2:8123`. Cast devices can have trouble resolving `.local` names; HTTPS must have a certificate the device trusts. The browser still needs HTTPS for microphone recording.

## Playback limits and verified results

Direct Cast playback interrupts existing media and does not restore it automatically. A JBL Charge 5 Wi-Fi played HomeCall’s test chime after Google Cast was enabled in JBL One. A second test interrupted iPhone-started YouTube Music: the chime was audible, but music remained stopped. Reopening the YouTube Music receiver and sending Play did not recover the track. A Nest Hub may replace its current screen while receiving media. Service acceptance and an audio download do not prove audible playback. A [Reddit user](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe3tau1/) reported successful message playback on Nest hardware, with no specific model supplied. The new combined chime/recording and Cast groups remain unverified.

## Additional hardware test findings

- Direct Cast produced no audible chime while Google Cast was disabled in JBL One. Enabling it resolved announcement playback.
- With iPhone YouTube Music confirmed playing through Cast, HomeCall’s chime was audible but music stayed stopped. HA reported the Cast entity off afterward.
- Reopening YouTube Music’s receiver and sending Play left it idle without the previous track. The receiver-launch service also returned an error; this did not establish a working recovery method.
- The Onkyo TX-NR696 was discovered but offline, so it has no playback result.
- MA over Cast, specific Nest models, Cast groups and the new combined chime/recording still need hardware verification. The Reddit Nest message-playback report does not establish these results.


## Music continuation: possible routes

These are possible recovery routes, not additional passing hardware tests:

| Route | Feasibility / next check |
| --- | --- |
| Music Assistant owns the music queue and uses its Google Cast provider | **Best next hardware test.** MA documents both [Google Cast support](https://www.music-assistant.io/player-support/google-cast/) and [restoration of MA-managed music after announcements](https://www.music-assistant.io/integration/announcements/). Start a track using MA over Cast, send HomeCall through the MA entity, and verify the track, position, volume and next queue item. The successful AirPlay test does not verify this route. |
| Direct Cast playing a reusable HTTP audio URL or radio stream | **Plausible HomeCall enhancement, not implemented or tested.** Snapshot the URL, type, position and volume before the announcement, then reload it afterward; buffered audio could resume at its saved position and live radio would reconnect. HA documents Cast URL playback and `extra.current_time` in [play_media](https://www.home-assistant.io/actions/media_player.play_media/). This would restore an item, not an arbitrary phone app’s session or playlist. |
| Phone-started YouTube Music on an audio-only Cast speaker | **No working generic recovery found.** [Google Home Resume](https://github.com/TheFes/Google-Home-Resume#youtube-music-resume) requires music started by the custom Ytube Music Player integration for its music-player recovery path. Its [known limitations](https://github.com/TheFes/Google-Home-Resume#known-limitations) restrict ordinary YouTube/YouTube Music recovery to the current item on devices with a screen. Our JBL receiver-relaunch experiment also failed. |
| Add `announce: true` or enqueue to direct Cast delivery | **Not an established fix.** [HA’s play_media documentation](https://www.home-assistant.io/actions/media_player.play_media/) requires announcement support in the player implementation. [PyChromecast’s media controller](https://github.com/home-assistant-libs/pychromecast/blob/master/pychromecast/controllers/media.py) starts the default receiver for generic media, so enqueue alone does not demonstrate preservation of a YouTube Music receiver’s session. |

When testing the MA route, select the MA entity for announcements and avoid selecting both it and the underlying Cast entity for the same physical device. Music must be managed by MA for the documented restoration path. Group announcement behavior has separate limitations described in the MA documentation.

