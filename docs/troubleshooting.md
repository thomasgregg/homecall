# Troubleshooting

| Symptom                                  | Check                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| HomeCall is missing from Add integration | Folder must be `custom_components/homecall`; restart HA after installation and inspect logs                       |
| No Echo devices                          | Configure built-in Alexa Devices; check enabled `notify.*_speak` entities and the HomeCall allowlist              |
| Audio conversion failed                  | `ffmpeg` must be callable in HA's environment and include `libmp3lame`; check HA logs and executable availability |
| Alexa accepted but no audio fetch        | Public HTTPS origin, trusted certificate, remote access availability, and reverse-proxy authentication            |
| Audio fetched but not heard              | Speaker volume, Alexa account/region support, device availability, and Amazon service behavior                    |
| Microphone will not start                | Open HA through HTTPS and check browser microphone permissions and OS input selection                             |
| Settings say no system address           | Enable Nabu Casa remote access or configure an external HTTPS address; alternatively provide your own origin      |
| Device selection is rejected             | Targets must be enabled, available Alexa speak entities or tested DLNA renderers selected for the card            |

First confirm Alexa Devices can send a simple announcement independently of HomeCall. Then test one short recording on one known speaker. Do not share bearer tokens, receipt URLs, recordings, or your public HA address in a public issue.

Include HA version, install method, card version, browser/OS, selected mode, and sanitized errors in a bug report. Use the repository issue template.

## DLNA sound test

- **No speakers found:** configure HA’s DLNA Digital Media Renderer integration; check the entity is enabled and supports media playback. Cast or DLNA server integrations are not renderer entities.
- **Test accepted but no sound:** check speaker volume and the local audio address. Try a reachable HTTP IP address in Connection settings. Confirming a test before the speaker downloads it is rejected; play the test again if the receipt expired.
- **Speaker disappears from the card:** check its availability, tested state and Show in the card setting. Re-added or renamed entities may need a new test.
- **Music does not resume:** enable Resume music after announcements for that speaker. Restoration needs a reusable media URL and playback-completion events. A device without seeking restarts at the beginning; queues and streaming sessions may not be restorable.
