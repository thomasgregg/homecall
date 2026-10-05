# Troubleshooting

| Symptom                                  | Check                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| HomeCall is missing from Add integration | Folder must be `custom_components/homecall`; restart HA after installation and inspect logs                                                     |
| No Alexa devices                         | Configure built-in Alexa Devices; check enabled `notify.*_speak` entities and the HomeCall allowlist                                            |
| Audio conversion failed                  | `ffmpeg` must be callable in HA's environment and include `libmp3lame`; check HA logs and executable availability                               |
| Alexa accepted but no audio fetch        | Public HTTPS origin, trusted certificate, remote access availability, and reverse-proxy authentication                                          |
| Audio fetched but not heard              | Speaker volume, device availability and the selected playback integration; a download does not prove audible playback                           |
| Microphone will not start                | Open HA through HTTPS and check browser microphone permissions and OS input selection                                                           |
| Settings say no system address           | Enable Nabu Casa remote access or configure an external HTTPS address; alternatively provide your own origin                                    |
| Device selection is rejected             | Targets must be enabled and available, allowed in HomeCall, and explicitly selected for local routes; DLNA also requires a confirmed sound test |

First confirm the selected playback integration works independently of HomeCall. For Alexa, test a simple Alexa Devices announcement. Then test one short recording on one known speaker. Do not share bearer tokens, receipt URLs, recordings, or your public HA address in a public issue.

Include HA version, install method, card version, browser/OS, selected mode, and sanitized errors in a bug report. Use the repository issue template.

## DLNA sound test

- **No speakers found:** configure HA’s DLNA Digital Media Renderer integration; check the entity is enabled and supports media playback. Cast or DLNA server integrations are not renderer entities.
- **Test accepted but no sound:** check speaker volume and the local audio address. Try a reachable HTTP IP address in Connection settings. Confirming a test before the speaker downloads it is rejected; play the test again if the receipt expired.
- **Speaker disappears from the card:** check its availability, tested state and Show in the card setting. Re-added or renamed entities may need a new test.
- **Music does not resume:** enable Resume music after announcements for that speaker. Restoration needs a reusable media URL and playback-completion events. A device without seeking restarts at the beginning; queues and streaming sessions may not be restorable.

## Music Assistant

- **No players found:** install/start the Music Assistant server, configure its speaker providers, then add its Home Assistant integration. Ensure the relevant player is enabled and exposed to HA.
- **The same speaker appears twice:** DLNA/Sonos/Cast and Music Assistant entities are different delivery routes for one device. Use the Music Assistant entity when its server manages your music; hide the direct route from the card.
- **Music plays but announcements fail:** check Music Assistant can retrieve HomeCall's local MP3 address, and test `music_assistant.play_announcement` independently. Check player volume and availability.
- **Music lowers instead of pausing:** native announcement support may duck or overlay music. JBL Charge 5 Wi-Fi / AirPlay 2 was tested with audible ducking and subsequent volume restoration. Other players may pause/resume instead.
- **Player connection fails:** power on the speaker and confirm it is on the same reachable network as the Music Assistant server. Discovery alone does not prove a connection is working; inspect the player/provider logs.

## Sonos, Google Cast and EchoMuse

- **Listed in settings but missing from the card:** add the speaker, select its visibility checkbox, save, and check HA availability. These routes require explicit selection; Alexa’s all-speaker option does not include them.
- **Accepted but no audio retrieval:** check the local audio origin is reachable by the speaker, Music Assistant server or EchoMuse controller. A LAN IP can avoid `.local` resolution problems. Browser microphone access still requires HTTPS.
- **Sonos announcements fail:** check HA can reach the speaker’s announcement port (TCP 1443) and that its hardware/firmware supports announcements. See [Sonos configuration](configuration.md#sonos-announcements).
- **Cast music stays stopped:** current playback is replaced; HomeCall has no automatic Cast restoration. See [Google Cast / Nest](google-cast.md) for tested behavior and setup.
- **EchoMuse is not discovered:** check the ESPHome device’s manufacturer is `EchoMuse` and its online media player exposes playback and announcement capabilities. See [EchoMuse setup](echomuse.md) for controller networking, firmware and playback limits.

A public HTTPS delivery address is needed for Alexa, not for local-only setups. Choose one entity per physical speaker to avoid duplicate announcements across providers.
