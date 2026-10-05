# Configuration

## Connection

Choose **Use Home Assistant address** to use the Nabu Casa remote domain when present, otherwise the configured external HTTPS address. HomeCall evaluates that address when creating delivery links, so changes to the system address take effect without reconfiguring HomeCall.

Choose **Own HTTPS address** to provide another publicly reachable HTTPS origin. Use an origin such as `https://ha.example.com` or `https://ha.example.com:8443`; credentials, path prefixes, query strings, and fragments are rejected. A trailing slash is normalized. The URL validator checks syntax, not reachability or certificate validity.

Alexa needs to fetch `/api/homecall/audio/<token>.mp3` from this address. An extra reverse-proxy login screen prevents retrieval. Avoid changing the security of your whole Home Assistant instance to accommodate audio: the integration already exposes only the temporary token-protected audio endpoint without HA authentication.

## Speaker groups

HomeCall has four separate groups: **Alexa speakers**, **DLNA speakers**, **Sonos speakers**, and **Music Assistant speakers**. You can combine them; Alexa Devices is not required for local-only setups.

### Alexa speakers

All groups reuse the same **Your speakers** and **Available speakers** cards. Press **Add** beside an available Alexa, Sonos or Music Assistant speaker to move it into your list. **Remove** moves it back to the available list. Adding and removing Alexa/Sonos/Music Assistant speakers remains pending until **Save changes**. Each added speaker has a checkbox. **Select all** checks or clears the speakers currently listed and shows a partial-selection state when only some are checked. Press **Save changes** once for the page. Saving this list uses the current selection; speakers discovered later are not automatically added. Editing Alexa selection preserves the separate DLNA selection. Alexa does not require the DLNA sound test.

### DLNA speakers

1. Configure the speaker through Home Assistant’s **DLNA Digital Media Renderer** integration.
2. Open **HomeCall → Configure → DLNA speakers → Available speakers**.
3. Select **Test** beside an online speaker. Progress, errors, and confirmation appear under that row.
4. Confirm **Yes, add speaker** only if you heard it.

The test plays a three-second chime at the current speaker volume and replaces any current playback. HomeCall requires both a download of the test audio and your audible confirmation before adding the speaker. An accepted service call alone is insufficient. Failed, expired and offline tests never add a device.

Added speakers have a checkbox controlling visibility in the card. Unchecking hides the speaker without discarding the successful test. Expand the speaker row to use **Remove**. DLNA rows also offer **Resume music after announcements**; Sonos handles restoration through native announcement mode. Visibility and resume edits remain pending until **Save changes** at the bottom of the page; refreshing discovery preserves pending edits. A successful DLNA test registers the speaker immediately. Removing it remains pending until **Save changes**. **Remove** discards the test and visibility; re-adding requires a new test. New DLNA speakers never enter the card automatically.

Local discovery uses the `dlna_dmr`, `sonos` and `music_assistant` entity platforms and `PLAY_MEDIA` capability, not manufacturer names. Direct Cast entities are excluded; Music Assistant may itself manage Cast playback. Passing the test confirms basic MP3 playback, not music resumption or every announcement scenario.

### Local audio address

DLNA uses HA’s local address automatically. If the speaker cannot resolve that address, set **Connection → Local address for DLNA / Sonos / Music Assistant (optional)** to an address it can reach, for example `http://192.168.1.2:8123`. [HA recommends HTTP and an IP address for DLNA playback](https://www.home-assistant.io/integrations/dlna_dmr/#playing-media). Do not disable TLS or authentication on your HA instance; use an existing reachable listener. Changing the address may require testing speakers again.

Alexa continues to use the public HTTPS address. Mixed announcements share one encoded clip but use the appropriate delivery address for each route. Both links retain the same random token and three-minute expiry.

## Change settings

Open **Settings → Devices & services → HomeCall → Configure**. The native HomeCall settings panel controls connection and devices. Only Home Assistant administrators can read or write integration settings; authenticated users can use the recording card and permitted speakers.

No YAML entry is required. HomeCall supports one configuration entry per instance.

## Resume music after announcements

Each added DLNA speaker has an optional **Resume music after announcements** setting, off by default. It remembers the current media URL, playback position and playing/paused state. After an announcement has actually played and finished, it restarts that media and seeks to the saved position if the speaker supports seeking. Without seeking support it restarts at the beginning. Paused media is restored to paused when the device advertises pause support; idle players are never started.

Changing tracks, pausing the announcement, going offline, an early stop, or disabling the setting cancels pending restoration. Back-to-back announcements retain the original track. Pending work is cancelled on integration unload; a restart does not restore previously interrupted music. No volume changes are made.

This restores one media item, not a playlist, queue or streaming-service session. Expiring media URLs may no longer play. Missing playback-completion events cause restoration to time out rather than interrupt potentially active audio. A stop from another app that reports exactly the same state as natural completion may be indistinguishable from completion.

JBL Charge 5 Wi-Fi was checked with local MP3s: replay after interruption and a seek to five seconds succeeded in HA. This does not prove restoration of Spotify or other streaming sessions, or the complete HomeCall flow on the installed instance.

### Sonos announcements

Sonos speakers appear in **Available speakers**. Press **Add**, then select which speakers appear in the card; the sound test is optional. Alexa uses the same speaker screen with an optional sound test. HomeCall sends MP3 URLs through `media_player.play_media` with `announce: true`. Sonos handles the music overlay and volume restoration; the DLNA resume checkbox is therefore hidden for Sonos. Legacy settings/API keys retain their DLNA names for compatibility.

The speaker must reach Home Assistant’s local audio address. Home Assistant must also reach TCP port 1443 on the Sonos speaker for announcements. Older hardware and S1 firmware may not fully support overlays; see [Home Assistant’s Sonos documentation](https://www.home-assistant.io/integrations/sonos/). Discovery, onboarding and service calls are covered by simulated tests; audible Sonos playback and restoration have not been verified on hardware.

All five speaker groups use the same expandable speaker rows, visibility checkboxes, Select all and Save changes. Expand any online speaker to play a sound test. Alexa, Sonos, Music Assistant and Google Cast tests do not add or select speakers and need no confirmation; DLNA onboarding still requires a downloaded test and audible confirmation. Testing produces audible sound and can interrupt playback. Only DLNA offers the HomeCall resume setting.

### Music Assistant announcements

Install and start the Music Assistant server (available as a Home Assistant app), configure a player provider, and add the discovered Music Assistant integration under **Settings → Devices & services**. The server manages music and speaker connections; the HA integration exposes the player entities and announcement service. HomeCall does not install the server for you. You can choose Music Assistant during initial HomeCall setup without a public Alexa address. Open **HomeCall → Configure → Music Assistant speakers**, press **Add** beside a player, choose visibility, and **Save changes**. A sound test is optional and does not add or select the player. Refresh preserves pending selections.

HomeCall calls `music_assistant.play_announcement` with the recording URL and no pre-announcement chime. Music Assistant manages pausing/restoring its playback or uses native announcement support where available. The HomeCall DLNA resume option is hidden. See [Music Assistant announcements](https://www.music-assistant.io/integration/announcements/).

The Music Assistant server and players must be able to retrieve HomeCall's temporary MP3 URL from Home Assistant's local address. Set the optional local address in Connection settings if needed. Select the Music Assistant entity for MA-managed playback; avoid selecting both it and the underlying Sonos/DLNA entity for the same speaker. For groups, select one group target rather than also selecting its members, since MA can announce to the whole group.

On 5 October 2026, Music Assistant 2.10.5 with a JBL Charge 5 Wi-Fi using AirPlay 2 passed an audible test: while Music Assistant played a music track, HomeCall's test chime was heard, music volume lowered during the chime, then returned to its previous level. The same queue item continued. This verifies ducking and volume restoration on that setup, rather than a complete pause/resume. The test used HomeCall's generated MP3 chime, not a microphone recording. Groups, other models/protocols and full pause/resume still need hardware tests.

The same physical speaker can appear in both **DLNA speakers** and **Music Assistant speakers** because these are separate HA entities with different delivery methods. For music managed by Music Assistant, select its entity and hide the underlying DLNA/Sonos entry from the card to avoid sending twice. The configuration sections remain separate.

Discovery, selection, sound-test routing and delivery are also covered by simulated backend and browser tests. Service acceptance alone does not confirm audible playback or restoration.

## Google Cast speakers

Set up Google Cast in Home Assistant, then open HomeCall Configure → Google Cast speakers. Add discovered devices, set card visibility and save. Optional sound tests use the same delivery path as recordings. Google Cast devices must be explicitly selected; Alexa’s automatic all-speaker setting never includes them.

The device must reach the local audio address. Under Connection, an explicit LAN IP address and port can avoid `.local` name-resolution problems. A public Alexa address is not required. Direct Cast playback interrupts existing music and does not restore it. Actual Nest playback, groups and startup delays require physical-device testing.

On 5 October 2026, a JBL Charge 5 Wi-Fi played HomeCall’s generated MP3 test chime over direct Cast after Google Cast was enabled in JBL One. During iPhone-started YouTube Music casting, the chime played but music stayed stopped. Reopening the YouTube Music receiver and sending Play did not restore the track. Microphone recordings through Cast, Nest devices, groups and Music Assistant over Cast remain unverified. See the README [protocol compatibility table](../README.md#speaker-compatibility) and [setup recommendations](../README.md#which-setup-should-i-use).
