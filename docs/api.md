# Architecture and API

## Modules

| Module                          | Responsibility                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| `__init__.py`                   | Entry setup, route registration, native settings panel, unload           |
| `const.py`                      | Domain, size and expiry limits, HTTPS-origin validation                  |
| `audio.py`                      | Mono PCM WAV validation and FFmpeg MP3 encoding                          |
| `helpers.py`                    | Device discovery, effective settings, allowed targets                    |
| `views.py`                      | HTTP endpoints and announcement delivery                                 |
| `resume.py`                     | Per-speaker playback snapshots, completion tracking, guarded restoration |
| `config_flow.py`                | Native setup and options flows                                           |
| `frontend/homecall-settings.js` | Native administrative settings UI                                        |

## Endpoints

All endpoints except the token-protected audio download require normal Home Assistant authentication. Use HA's authenticated frontend API or a bearer token; never put an HA token in the audio URL.

| Method | Path                                    | Access         | Result                                                             |
| ------ | --------------------------------------- | -------------- | ------------------------------------------------------------------ |
| GET    | `/api/homecall/status`                  | Authenticated  | Allowed targets, 60-second limit, fetch count                      |
| GET    | `/api/homecall/status?receipt=<token>`  | Authenticated  | Returns audio retrieval count for this receipt                     |
| GET    | `/api/homecall/settings`                | Administrator  | Effective settings, detected system address, discovered targets    |
| POST   | `/api/homecall/settings`                | Administrator  | Update connection or device scope                                  |
| POST   | `/api/homecall/speaker-test`            | Administrator  | Test speakers, confirm DLNA onboarding, remove, or set DLNA resume |
| POST   | `/api/homecall/send?target=<entity_id>` | Authenticated  | Request acceptance per target, duration, receipt token             |
| GET    | `/api/homecall/audio/<token>.mp3`       | Expiring token | MP3 bytes, `Cache-Control: no-store`                               |

Repeat `target` for multiple recipients. Duplicate target IDs are collapsed. The upload body is a WAV file with one channel, 16-bit samples, sample rate 8–48kHz, and duration 0.2–60.5 seconds. The card caps capture at 60 seconds. Uploads are limited to 6,000,000 bytes, including streamed requests without a content length.

FFmpeg encodes mono MP3 at 24kHz and 48kbps, strips metadata, and has a 30-second subprocess timeout. Temporary conversion files are removed when encoding finishes. Encoded clips stay in memory for at most 180 seconds; at most 20 clips may coexist. Unloading the integration clears clips.

Only one upload/conversion/delivery operation runs at a time. The lock ends after the service calls finish; it does not serialize complete speaker playback. A competing request receives `409`. Invalid targets or audio receive `400`; oversize uploads receive `413`; conversion failure receives `500`; missing setup receives `503`; a full clip store receives `429`. Settings requests without administrator access receive `403`. Invalid/expired audio tokens receive `404`.

## Response example

```json
{
  "results": [{ "entity_id": "notify.kitchen_speak", "accepted": true }],
  "duration": 3.4,
  "receipt": "opaque-random-token"
}
```

A successful HTTP response can include rejected targets. The card reports full, partial, or failed acceptance. Fetch counts are transport observations, not proof of audible playback. The count is aggregated for the clip, not attributed to each target, and is zero without a receipt. Audio HEAD requests are supported but do not increment it. A receipt does not report playback completion.

## Settings requests

```json
{
  "page": "connection",
  "use_system_url": false,
  "public_url": "https://ha.example.com"
}
```

```json
{
  "page": "devices",
  "use_all": false,
  "default_targets": ["notify.kitchen_speak"]
}
```

## DLNA onboarding API

`POST /api/homecall/speaker-test` requires an administrator. Send `{"action":"test","entity_id":"media_player.speaker"}` to play the chime. The returned `receipt` is temporary and bound to that entity. After hearing it, send `{"action":"confirm","entity_id":"media_player.speaker","receipt":"..."}`. Confirmation requires an unexpired test clip that was downloaded (HEAD requests do not count). `{"action":"remove","entity_id":"media_player.speaker"}` revokes its tested state and card visibility.

Settings return `dlna_candidates`, `tested_dlna`, `local_url` and `detected_local_url`. `local_url` is an optional HTTP/HTTPS origin override. `use_all` applies to Alexa only; DLNA speakers must be tested and explicitly present in `default_targets`. The normal upload endpoint cannot bypass either requirement. DLNA delivery calls `media_player.play_media`; Alexa delivery calls `notify.send_message`.

Music restoration is stored in `resume_dlna` (entity IDs, empty by default). The settings panel saves it together with visibility through `POST /api/homecall/settings` (`page: "devices"`, `use_all`, `default_targets`, and `resume_dlna`). Every resume target must already be tested; disabling it cancels pending restoration. Administrators can also set a single speaker using `POST /api/homecall/speaker-test` with `{"action":"resume","entity_id":"media_player.speaker","enabled":true}`. The entity must already have passed its sound test. Removing the speaker revokes restoration and cancels pending work. Settings pages preserve this list when saving unrelated options.

## Local speaker discovery and delivery

The legacy `dlna_candidates` response includes all local speaker routes. Its `transport` identifies `dlna`, `sonos`, `music_assistant`, `cast` or `echomuse`. Local players must be explicitly selected in `default_targets`; Alexa’s `use_all` does not include them. Only DLNA requires test confirmation.

Speaker tests return `requires_confirmation: true` for DLNA and `false` for Alexa, Sonos, Music Assistant, Google Cast and EchoMuse. Optional tests do not add or select a speaker. Settings can include `added_speakers` to preserve the administrative speaker list separately from visibility, and `removed_dlna` to revoke a tested DLNA speaker when saving pending removals.

Sonos delivery calls `media_player.play_media` with `announce: true`. Music Assistant delivery calls `music_assistant.play_announcement` with `url` and `use_pre_announce: false`. Both use the local audio address and leave announcement playback/restoration to the respective integration; they do not use HomeCall's DLNA resume manager. A failed Music Assistant call is reported as rejected, without a fallback to direct playback.

## Google Cast delivery

The legacy `dlna_candidates` field also includes Google Cast media players with `transport: "cast"`. Enabled registry entities must support `PLAY_MEDIA`; unavailable and unknown entities remain discoverable but cannot receive recordings. Cast devices require explicit `default_targets` selection and are excluded from Alexa’s `use_all` setting.

Delivery uses `media_player.play_media` with the token-protected local MP3 URL as `media_content_id` and `audio/mpeg` as `media_content_type`. Cast never uses Alexa’s notify route, Sonos announcement mode or the DLNA resume manager. Optional speaker tests return `requires_confirmation: false` and do not change selection. Existing audio expiry, authentication and fetch receipts apply unchanged. Service acceptance and fetch receipts do not establish audible playback.

## EchoMuse delivery

Discovery requires an enabled ESPHome media player attached to a device with manufacturer `EchoMuse`. Online players must support `PLAY_MEDIA` and `MEDIA_ANNOUNCE`; unavailable/unknown players remain listed but cannot receive recordings. EchoMuse requires explicit selection in `default_targets`.

Delivery calls `media_player.play_media` with the local token-protected MP3 URL, `media_content_type: "audio/mpeg"` and `announce: true`. Home Assistant may proxy/transcode the audio for ESPHome. The EchoMuse controller retrieves the audio and streams it to its Dot. Music handling belongs to EchoMuse; HomeCall does not apply DLNA restoration. Tests are optional and do not select speakers. See [setup and limitations](echomuse.md).
