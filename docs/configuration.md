# Configuration

## Connection

Choose **Use Home Assistant address** to use the Nabu Casa remote domain when present, otherwise the configured external HTTPS address. HomeCall evaluates that address when creating delivery links, so changes to the system address take effect without reconfiguring HomeCall.

Choose **Own HTTPS address** to provide another publicly reachable HTTPS origin. Use an origin such as `https://ha.example.com` or `https://ha.example.com:8443`; credentials, path prefixes, query strings, and fragments are rejected. A trailing slash is normalized. The URL validator checks syntax, not reachability or certificate validity.

Alexa needs to fetch `/api/homecall/audio/<token>.mp3` from this address. An extra reverse-proxy login screen prevents retrieval. Avoid changing the security of your whole Home Assistant instance to accommodate audio: the integration already exposes only the temporary token-protected audio endpoint without HA authentication.

Local-only setups do not require a public Alexa HTTPS address. The browser still needs HTTPS for microphone capture. Local audio retrieval uses a reachable HTTP/HTTPS origin configured separately below.

## Speaker groups

HomeCall has six separate groups: **Alexa speakers**, **DLNA speakers**, **Sonos speakers**, **Music Assistant speakers**, **Google Cast speakers**, and **EchoMuse speakers**. Connection settings have their own section above the grouped speaker connectors. You can combine them; Alexa Devices is not required for local-only setups.

Speaker rows show the Home Assistant name and area, when assigned. HomeCall adds the entity ID when speakers still share a name and area or share a name with no area assigned. The card and its editor also use these details.

All groups use **Your speakers** and **Available speakers**. Press **Add** beside an available Alexa, Sonos, Music Assistant, Google Cast or EchoMuse speaker to move it into your list. **Remove** moves it back to the available list. Each added speaker has a checkbox that controls whether it appears in the card. **Select all** checks or clears the speakers currently listed and shows a partial-selection state when only some are checked. Select **Save** to apply additions, removals, and visibility changes. Editing Alexa selection preserves the separate DLNA selection. Alexa sound tests are optional.

### DLNA speakers

1. Configure the speaker through Home Assistant’s **DLNA Digital Media Renderer** integration.
2. Open **HomeCall → Configure → DLNA speakers → Available speakers**.
3. Select **Test** beside an online speaker. Progress, errors, and confirmation appear under that row.
4. Confirm **Yes, add speaker** only if you heard it.

The test plays the announcement chime when enabled, followed by a three-second tone at the current speaker volume. It replaces any current playback. HomeCall requires both a download of the test audio and your audible confirmation before adding the speaker. An accepted service call alone is insufficient. Failed, expired and offline tests never add a device.

Added speakers have a checkbox controlling visibility in the card. Unchecking hides the speaker without discarding the successful test. Expand the speaker row to use **Remove**. DLNA rows also offer **Resume music after announcements**. Select **Save** to apply pending visibility, removal, and resume edits. Refreshing discovery preserves pending edits. Confirming a successful DLNA test registers the speaker immediately. Saving a removal discards the test and visibility. Re-adding requires a new test.

Local discovery recognizes the `dlna_dmr`, `sonos`, `music_assistant` and `cast` entity platforms. EchoMuse players use the `esphome` platform and device manufacturer `EchoMuse`. Online local players need `PLAY_MEDIA`; EchoMuse also needs `MEDIA_ANNOUNCE`. Disabled entities are excluded. Unavailable or unknown players remain discoverable but cannot receive recordings. Passing the test confirms basic MP3 playback, not music resumption or every announcement scenario.

### Local audio address

DLNA, Sonos, Music Assistant, Google Cast and EchoMuse use HA’s local address automatically. If the speaker cannot resolve that address, set **Connection → Local address for DLNA / Sonos / Music Assistant / Cast / EchoMuse (optional)** to an address it can reach, for example `http://192.168.1.2:8123`. [HA recommends HTTP and an IP address for DLNA playback](https://www.home-assistant.io/integrations/dlna_dmr/#playing-media). Do not disable TLS or authentication on your HA instance; use an existing reachable listener. Changing the address may require testing speakers again.

Alexa uses the public HTTPS address. Each recipient gets a link for its route and its audio variant. Chimed and voice-only variants have separate tokens, each expiring after three minutes.

## Change settings

Open **Settings → Devices & services → HomeCall → Configure**. The native HomeCall settings panel controls connection and devices. Only Home Assistant administrators can read or write integration settings; authenticated users can use the recording card and permitted speakers.

No YAML entry is required. HomeCall supports one configuration entry per instance.

## Announcement chime

1. Open **HomeCall → Configure → Announcements** and enable **Play a chime before messages**. The setting is off by default.
2. Under **Chime sound**, select **Pick media** and choose a readable MP3 from Home Assistant's **My media**. The file may be up to 10 seconds and 2 MiB. The default media folder and any folders configured in `homeassistant.media_dirs` are available through the picker. See [Home Assistant's media setup guide](https://www.home-assistant.io/integrations/media_source/#using-custom-or-additional-media-folders).
3. Select **Save**. Starting with **v1.12.0-beta.3**, expand an online speaker and select **Test** to hear the saved chime followed by a three-second tone. With the chime off or skipped for that route, **Test** plays the tone alone.

The row shows the selected filename. Use **Change** to select a different file, or **Use built-in chime** to restore the two-tone sound, then select **Save**. Turning chimes off remembers your selection. If your selected file is moved, deleted, or becomes unreadable, HomeCall uses the built-in chime and shows a warning in Announcements settings.

**Skip the chime on direct Google Cast speakers** is on by default. It applies to the **Google Cast** speaker list. Music Assistant players, including those using a Cast output, follow the HomeCall chime setting. HomeCall disables Music Assistant’s own pre-announcement cue. A Cast device can still play its connection sound when opening a receiver session.

HomeCall combines the cue and the complete recording in one clip. Mixed sends can use both that clip and a voice-only variant. DLNA restoration uses the total playback duration, including the cue. See the [compatibility table](../README.md#speaker-compatibility) for verified playback. The built-in sound is [2-tone chime by mpaol2023](https://freesound.org/people/mpaol2023/sounds/370176/), licensed CC0.

## Custom announcement volume (beta)

In **HomeCall → Configure → Sonos speakers** or **Music Assistant speakers**, expand an eligible speaker under **Your speakers**. **Custom announcement volume** starts off, so the player uses its normal announcement volume. Turning it on reveals a slider from **1%** to **100%** and a read-only percentage. The initial level is **25%**. **Test** sends the current slider level before saving. Its diagnostics show the requested percentage. Select **Save** to use that level for future announcements. HomeCall remembers the percentage when you turn the switch off and clears it if you remove the speaker and save.

- **Sonos:** The direct speaker must report S2 software and have a connected AudioClip client. HomeCall uses AudioClip for an override. If the clip is refused, HomeCall reports the speaker as skipped.
- **Music Assistant:** The player must support volume adjustment and be standalone. Group and stereo-pair targets and players currently participating in a group use their own volume settings. See [Music Assistant volume setup](#music-assistant-volume-setup) for the required player setting. Whether the player applies the request also depends on its output protocol and volume control. Music Assistant handles interruption, temporary unmuting, and restoration.
- Offline Sonos and Music Assistant rows show the volume switch with a prompt to reconnect. Enabling it requires a reachability and support check. A saved override remains available to turn off if the speaker is disconnected or grouped. If a reachable speaker can no longer use its override, HomeCall reports the affected speaker and continues with the other eligible recipients. A delivery timeout can mean a clip is still playing.

The level applies to the whole announcement, including the HomeCall chime. Percentage scales differ by device. Audible adjustment was verified on the JBL setup below. Direct Sonos playback with the override and music restoration with the override still need hardware testing.

### Music Assistant volume setup

On Music Assistant 2.10.13, **Do not adjust volume** ignores the level HomeCall requests. Configure each eligible player you want to use with HomeCall’s slider. [Music Assistant 2.10.13 volume handling](https://github.com/music-assistant/server/blob/2.10.13/music_assistant/controllers/players/announcements.py#L268-L320)

1. In **Music Assistant → Settings → Players**, open the player you selected in HomeCall and find **Announcements**.
2. Set **Volume strategy for Announcements** to **Relative volume increase** and **Volume for Announcements** to **0**. This adds zero to the current volume for announcements that use the player’s default, subject to its limits.
3. Review the **Minimum Volume level for Announcements** and **Maximum Volume level for Announcements**. Music Assistant clamps HomeCall’s requested percentage to this range. With limits of **15%** and **75%**, an **83%** request plays at **75%** if the player applies the override.
4. Select **Save** in Music Assistant. If the volume still sounds the same, reopen the player settings and check that the strategy and **0** were saved.
5. In **HomeCall → Configure → Music Assistant speakers**, expand the same player, enable **Custom announcement volume**, and use **Test** at two levels within the limits, such as **20%** and **35%**. You can compare them before saving the HomeCall setting.

An audible volume difference was confirmed on a JBL Charge 5 Wi-Fi using AirPlay 2 with Music Assistant 2.10.13 and HomeCall v1.12.0-beta.3.

## Resume music after announcements

Each added DLNA speaker has an optional **Resume music after announcements** setting, off by default. It remembers the current media URL, playback position and playing/paused state. After an announcement has actually played and finished, it restarts that media and seeks to the saved position if the speaker supports seeking. Without seeking support it restarts at the beginning. Paused media is restored to paused when the device advertises pause support; idle players are never started.

Changing tracks, pausing the announcement, going offline, an early stop, or disabling the setting cancels pending restoration. Back-to-back announcements retain the original track. Pending work is cancelled on integration unload; a restart does not restore previously interrupted music. No volume changes are made.

This restores one media item, not a playlist, queue or streaming-service session. Expiring media URLs may no longer play. Missing playback-completion events cause restoration to time out rather than interrupt potentially active audio. A stop from another app that reports exactly the same state as natural completion may be indistinguishable from completion.

JBL Charge 5 Wi-Fi was checked with local MP3s: replay after interruption and a seek to five seconds succeeded in HA. This does not prove restoration of Spotify or other streaming sessions, or the complete HomeCall flow on the installed instance.

## Sonos announcements

Sonos speakers appear in **Available speakers**. Press **Add**, select which speakers appear in the card, and select **Save**. The sound test is optional. HomeCall normally sends MP3 URLs through `media_player.play_media` with `announce: true`. Eligible Sonos S2 speakers use AudioClip when [custom announcement volume](#custom-announcement-volume-beta) is enabled. Sonos handles the music overlay and volume restoration.

The speaker must reach Home Assistant’s local audio address. Home Assistant must also reach TCP port 1443 on the Sonos speaker for announcements. Older hardware and S1 firmware may not fully support overlays; see [Home Assistant’s Sonos documentation](https://www.home-assistant.io/integrations/sonos/). Discovery, onboarding and service calls are covered by simulated tests; audible Sonos playback and restoration have not been verified on hardware.

Expand an online speaker to play a sound test. The test can interrupt playback. Sound tests are optional for Alexa, Sonos, Music Assistant, Google Cast, and EchoMuse. DLNA onboarding requires both a download and audible confirmation.

## Music Assistant announcements

Install and start the Music Assistant server (available as a Home Assistant app), configure a player provider, and add the discovered Music Assistant integration under **Settings → Devices & services**. The server manages music and speaker connections. The HA integration exposes the player entities and announcement service. You can choose Music Assistant during initial HomeCall setup without a public Alexa address. Open **HomeCall → Configure → Music Assistant speakers**, press **Add** beside a player, choose visibility, and select **Save**. Refresh preserves pending selections.

HomeCall calls `music_assistant.play_announcement` with its audio URL and disables Music Assistant’s own pre-announcement cue. Music Assistant manages pausing and restoring its playback or uses native announcement support where available. [Music Assistant announcements](https://www.music-assistant.io/integration/announcements/)

For per-speaker volume, follow [Music Assistant volume setup](#music-assistant-volume-setup) before using **Custom announcement volume** in HomeCall.

The Music Assistant server and players must be able to retrieve HomeCall's temporary MP3 URL from Home Assistant's local address. Set the optional local address in Connection settings if needed. Select the Music Assistant entity for MA-managed playback; avoid selecting both it and the underlying Sonos/DLNA/Cast entity for the same speaker. For groups, select one group target rather than also selecting its members, since MA can announce to the whole group.

On 5 October 2026, Music Assistant 2.10.5 with a JBL Charge 5 Wi-Fi using AirPlay 2 passed an audible test: while Music Assistant played a music track, HomeCall's test chime was heard, music volume lowered during the chime, then returned to its previous level. The same queue item continued. This verifies ducking and volume restoration on that setup, rather than a complete pause/resume. The test used HomeCall's generated MP3 chime, not a microphone recording. On 6 October, the user also confirmed the new optional two-tone chime followed by their recorded voice through Music Assistant. This confirms combined-audio playback on their tested MA setup; the current MA version and route were not recorded separately. A [Reddit user](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe579qq/) also reported Sync Group message playback, with abrupt music transitions and track-position behavior. Other models/protocols, combined-audio group playback and full pause/resume still need hardware tests.

The same physical speaker can appear in both **DLNA speakers** and **Music Assistant speakers** because these are separate HA entities with different delivery methods. For music managed by Music Assistant, select its entity and hide the underlying DLNA/Sonos/Cast entry from the card to avoid sending twice. The configuration sections remain separate.

Discovery, selection, sound-test routing and delivery are also covered by simulated backend and browser tests. Service acceptance alone does not confirm audible playback or restoration.

## Google Cast speakers

Set up Google Cast in Home Assistant, then open HomeCall Configure → Google Cast speakers. Add discovered devices, set card visibility and save. Optional sound tests use the same delivery path as recordings. Google Cast devices must be explicitly selected; Alexa’s automatic all-speaker setting never includes them.

The device must reach the local audio address. Under Connection, an explicit LAN IP address and port can avoid `.local` name-resolution problems. A public Alexa address is not required. Direct Cast playback interrupts existing music and does not restore it. Actual Nest playback, groups and startup delays require physical-device testing.

On 5 October 2026, a JBL Charge 5 Wi-Fi played HomeCall’s generated MP3 test chime over direct Cast after Google Cast was enabled in JBL One. During iPhone-started YouTube Music casting, the chime played but music stayed stopped. Reopening the YouTube Music receiver and sending Play did not restore the track. A [Reddit user](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe3tau1/) reported successful Nest message playback; their model was unspecified. The new combined chime/recording, specific Nest models, Cast groups and Music Assistant over Cast still need verification. See the README [protocol compatibility table](../README.md#speaker-compatibility) and [setup recommendations](../README.md#which-setup-should-i-use).

For detailed setup, network troubleshooting, hardware findings and recovery options, see the [Google Cast / Nest guide](google-cast.md).

## EchoMuse speakers

Connect EchoMuse Dots through ESPHome in Home Assistant, then add and select them under **EchoMuse speakers**. Sound tests are optional. HomeCall uses local `media_player.play_media` announcements and delegates music handling to EchoMuse. A [Reddit user](https://www.reddit.com/r/homeassistant/comments/1wycu0s/comment/pe7g2wf/) confirmed recorded message playback and that the opening-cutoff fix worked on their EchoMuse Dots. The new optional chime and music continuation remain unverified on that route. See [EchoMuse setup and limitations](echomuse.md).
