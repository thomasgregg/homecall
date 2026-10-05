# Configuration

## Connection

Choose **Use Home Assistant address** to use the Nabu Casa remote domain when present, otherwise the configured external HTTPS address. HomeCall evaluates that address when creating delivery links, so changes to the system address take effect without reconfiguring HomeCall.

Choose **Own HTTPS address** to provide another publicly reachable HTTPS origin. Use an origin such as `https://ha.example.com` or `https://ha.example.com:8443`; credentials, path prefixes, query strings, and fragments are rejected. A trailing slash is normalized. The URL validator checks syntax, not reachability or certificate validity.

Alexa needs to fetch `/api/homecall/audio/<token>.mp3` from this address. An extra reverse-proxy login screen prevents retrieval. Avoid changing the security of your whole Home Assistant instance to accommodate audio: the integration already exposes only the temporary token-protected audio endpoint without HA authentication.

## Speaker groups

HomeCall starts with two groups: **Alexa speakers** and **DLNA speakers**. You can use either or both; Alexa Devices is not a mandatory dependency for DLNA-only setups.

### Alexa speakers

Each speaker has a checkbox. **Select all** checks or clears the speakers currently listed and shows a partial-selection state when only some are checked. Press **Save changes** once for the page. Saving this list uses the current selection; speakers discovered later are not automatically added. Editing Alexa selection preserves the separate DLNA selection. Alexa does not require the DLNA sound test.

### DLNA speakers

1. Configure the speaker through Home Assistant’s **DLNA Digital Media Renderer** integration.
2. Open **HomeCall → Configure → DLNA speakers → Available speakers**.
3. Select **Test** beside an online speaker. Progress, errors, and confirmation appear under that row.
4. Confirm **Yes, add speaker** only if you heard it.

The test plays a three-second chime at the current speaker volume and replaces any current playback. HomeCall requires both a download of the test audio and your audible confirmation before adding the speaker. An accepted service call alone is insufficient. Failed, expired and offline tests never add a device.

Added speakers have a checkbox controlling visibility in the card. Unchecking hides the speaker without discarding the successful test. Expand the speaker row to edit **Resume music after announcements** or use **Remove**. Visibility and resume edits remain pending until **Save changes** at the bottom of the page; refreshing discovery preserves pending edits. Adding and removing speakers take effect immediately. **Remove** discards the test and visibility; re-adding requires a new test. New DLNA speakers never enter the card automatically.

Discovery uses the `dlna_dmr` entity platform and `PLAY_MEDIA` capability, not manufacturer names. Cast entities for the same physical device are excluded. Passing the test confirms basic MP3 playback, not music resumption or every announcement scenario.

### Local audio address

DLNA uses HA’s local address automatically. If the speaker cannot resolve that address, set **Connection → Local address for DLNA** to an address it can reach, for example `http://192.168.1.2:8123`. [HA recommends HTTP and an IP address for DLNA playback](https://www.home-assistant.io/integrations/dlna_dmr/#playing-media). Do not disable TLS or authentication on your HA instance; use an existing reachable listener. Changing the address may require testing speakers again.

Alexa continues to use the public HTTPS address. Mixed announcements share one encoded clip but use the appropriate delivery address for each route. Both links retain the same random token and three-minute expiry.

## Change settings

Open **Settings → Devices & services → HomeCall → Configure**. The native HomeCall settings panel controls connection and devices. Only Home Assistant administrators can read or write integration settings; authenticated users can use the recording card and permitted speakers.

No YAML entry is required. HomeCall supports one configuration entry per instance.

## Resume music after announcements

Each added DLNA speaker has an optional **Resume music after announcements** setting, off by default. It remembers the current media URL, playback position and playing/paused state. After an announcement has actually played and finished, it restarts that media and seeks to the saved position if the speaker supports seeking. Without seeking support it restarts at the beginning. Paused media is restored to paused when the device advertises pause support; idle players are never started.

Changing tracks, pausing the announcement, going offline, an early stop, or disabling the setting cancels pending restoration. Back-to-back announcements retain the original track. Pending work is cancelled on integration unload; a restart does not restore previously interrupted music. No volume changes are made.

This restores one media item, not a playlist, queue or streaming-service session. Expiring media URLs may no longer play. Missing playback-completion events cause restoration to time out rather than interrupt potentially active audio. A stop from another app that reports exactly the same state as natural completion may be indistinguishable from completion.

JBL Charge 5 Wi-Fi was checked with local MP3s: replay after interruption and a seek to five seconds succeeded in HA. This does not prove restoration of Spotify or other streaming sessions, or the complete HomeCall flow on the installed instance.
