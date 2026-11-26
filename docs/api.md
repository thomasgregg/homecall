# Architecture and API

## Modules

| Module                          | Responsibility                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| `__init__.py`                   | Entry setup, route registration, native settings panel, unload           |
| `const.py`                      | Domain, size and expiry limits, HTTPS-origin validation                  |
| `audio.py`                      | WAV validation, chime and test-tone preparation, FFmpeg MP3 encoding     |
| `announcement_volume.py`        | Validates volume preferences and checks Sonos and Music Assistant support |
| `helpers.py`                    | Device discovery, effective settings, allowed targets                    |
| `voice_satellite.py`            | Voice Satellite route constants and page-relative clip path              |
| `views.py`                      | HTTP endpoints and announcement delivery                                 |
| `resume.py`                     | Per-speaker playback snapshots, completion tracking, guarded restoration |
| `dashboard.py`                  | Bundled card resource registration and recognized legacy URL migration   |
| `frontend/homecall-card.js`     | Built recording card and native card editor                              |
| `config_flow.py`                | Native setup and options flows                                           |
| `frontend/homecall-settings.js` | Native administrative settings UI                                        |

## Dashboard resource

The integration serves the built card and recorder from `/homecall-assets/`. At setup, `dashboard.py` registers a content-versioned `/homecall-assets/homecall-card.js?v=<hash>` module through Lovelace's resource collection. Recognized legacy local HomeCall resource URLs are updated in place. YAML-managed resources remain user-managed; see the [migration guide](card-migration.md). The card's source and build tests live under `card/` at the repository root.

## Endpoints

All endpoints except the token-protected audio download require normal Home Assistant authentication. Use HA's authenticated frontend API or a bearer token; never put an HA token in the audio URL.

| Method | Path                                    | Access         | Result                                                             |
| ------ | --------------------------------------- | -------------- | ------------------------------------------------------------------ |
| GET    | `/api/homecall/status`                  | Authenticated  | Allowed targets, 60-second limit, fetch count                      |
| GET    | `/api/homecall/status?receipt=<token>`  | Authenticated  | Returns audio retrieval count for this receipt                     |
| GET    | `/api/homecall/status?diagnostic_id=<id>` | Trace owner    | Short-lived timing and delivery diagnostics                       |
| GET    | `/api/homecall/settings`                | Administrator  | Effective settings, detected system address, discovered targets    |
| POST   | `/api/homecall/settings`                | Administrator  | Update connection, announcement chime, or speaker settings         |
| POST   | `/api/homecall/speaker-test`            | Administrator  | Test speakers, confirm DLNA onboarding, remove, or set DLNA resume |
| POST   | `/api/homecall/send?target=<entity_id>` | Authenticated  | Request acceptance per target, duration, receipt token             |
| GET    | `/api/homecall/audio/<token>.mp3`       | Expiring token | MP3 bytes, `Cache-Control: no-store`                               |

Status filters targets through the requesting user's Home Assistant entity-read permissions. Send requests require read/control permissions as well as HomeCall's global allowlist; these are checked before reading audio and rechecked after conversion.

Speaker labels can include `area_name` and `show_entity_id`. The latter is true when multiple visible speakers share the same name and area, including when neither has an area. The settings response uses the same labels for its speaker lists.

Repeat `target` for multiple recipients. Duplicate target IDs are collapsed. The upload body is a WAV file with one channel, 16-bit samples, sample rate 8–48kHz, and duration 0.2–60.5 seconds. The card caps capture at 60 seconds. Uploads are limited to 6,000,000 bytes, including streamed requests without a content length. The complete upload body must arrive within 30 seconds, including trickling uploads.

FFmpeg encodes mono MP3 at 24kHz and 48kbps, strips metadata, and has a 30-second subprocess timeout. Temporary conversion files are removed when encoding finishes. Encoded clips stay in memory for at most 180 seconds; at most 20 clips may coexist. Unloading the integration clears clips.

Only one upload/conversion/delivery operation runs at a time. Each speaker service call has a 30-second deadline. A Music Assistant or custom-volume delivery that times out returns `accepted: false` with reason `delivery_unconfirmed`. Playback may still occur. Other targets retain their individual results. The lock ends after the service calls finish or time out; it does not serialize complete speaker playback. A competing request receives `409`. Invalid targets or audio receive `400`; oversize uploads receive `413`; upload deadline expiry receives `408`; conversion failure receives `500`; missing setup receives `503`; a full clip store receives `429`. Settings requests without administrator access receive `403`. Invalid/expired audio tokens receive `404`.

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

For chime settings, use `page: "announcements"` with boolean `announcement_chime` and `skip_cast_chime` fields. Set `custom_chime` to a supported local Media Source MP3 ID or `null` to restore the built-in cue. Omitting it preserves the existing selection. A missing or unreadable saved file falls back to the built-in cue and sets `custom_chime_unavailable` in the settings response. See [chime configuration](configuration.md#announcement-chime).

### Announcement-volume preferences

The settings response exposes `announcement_volume_supported: true` on eligible local candidates and an `announcement_volumes` map keyed by their current entity IDs. Update preferences through a `page: "devices"` request with `announcement_volume_changes` alongside the existing speaker selection fields. Each entry is an entity ID mapped to an object such as `{"enabled":true,"level":35}`. The level is an integer from 1 to 100. Enabling an override requires an added speaker with current support. An existing override can be disabled when support is unavailable. Preferences follow the entity registry entry when the entity is renamed. Removing the speaker through the device settings clears its preference.

Normal sends use the saved preference for each recipient. If an enabled override cannot be applied because the route no longer supports it, delivery returns `accepted: false` and reason `announcement_volume_unavailable` for that speaker. Other recipients keep their individual results.

### Speaker test API

`POST /api/homecall/speaker-test` requires an administrator. Send `{"action":"test","entity_id":"media_player.speaker"}` for a three-second tone. HomeCall adds the saved announcement chime when it applies to that route. An optional `announcement_volume` object uses the same `enabled` and `level` fields as a saved preference and applies only to that test. Omitting the object uses the saved preference. Diagnostics report the full test duration and include `requested_announcement_volume_percent` when an override was requested.

Conversion and delivery failures return `diagnostics` alongside the response’s `error`. The report includes the error code and a `failure_stage` of `conversion` or `delivery`. Fetch counts can update after an unconfirmed delivery. The caller that ran the test can read the updated report through the `diagnostic_id` status endpoint before it expires.

## DLNA onboarding API

The speaker test returns a temporary `receipt` bound to the entity. After hearing a DLNA test, send `{"action":"confirm","entity_id":"media_player.speaker","receipt":"..."}`. Confirmation requires an unexpired test clip that was downloaded using GET. `{"action":"remove","entity_id":"media_player.speaker"}` revokes its tested state and card visibility.

Settings return `dlna_candidates`, `tested_dlna`, `local_url` and `detected_local_url`. `local_url` is an optional HTTP/HTTPS origin override. `use_all` applies to Alexa only; DLNA speakers must be tested and explicitly present in `default_targets`. The normal upload endpoint cannot bypass either requirement. DLNA delivery calls `media_player.play_media`; Alexa delivery calls `notify.send_message`.

Music restoration is stored in `resume_dlna` (entity IDs, empty by default). The settings panel saves it together with visibility through `POST /api/homecall/settings` (`page: "devices"`, `use_all`, `default_targets`, and `resume_dlna`). Every resume target must already be tested; disabling it cancels pending restoration. Administrators can also set a single speaker using `POST /api/homecall/speaker-test` with `{"action":"resume","entity_id":"media_player.speaker","enabled":true}`. The entity must already have passed its sound test. Removing the speaker revokes restoration and cancels pending work. Settings pages preserve this list when saving unrelated options.

## Local speaker discovery and delivery

The legacy `dlna_candidates` response includes all local speaker routes. Its `transport` identifies `dlna`, `sonos`, `music_assistant`, `cast`, `echomuse` or `voice_satellite`. Local players must be explicitly selected in `default_targets`; Alexa’s `use_all` does not include them. Only DLNA requires test confirmation.

Speaker tests return `requires_confirmation: true` for DLNA and `false` for Alexa, Sonos, Music Assistant, Google Cast, EchoMuse and Voice Satellite. Optional tests do not add or select a speaker. Settings can include `added_speakers` to preserve the administrative speaker list separately from visibility, and `removed_dlna` to revoke a tested DLNA speaker when saving pending removals.

Sonos delivery calls `media_player.play_media` with `announce: true` by default. An enabled override uses the connected Sonos S2 AudioClip client with the requested volume. Music Assistant delivery calls `music_assistant.play_announcement` with `url` and `use_pre_announce: false`, adding `announce_volume` for an enabled override. Both routes use the local audio address and delegate announcement playback and restoration to Sonos or Music Assistant. Music Assistant applies its own [strategy and limits](configuration.md#music-assistant-volume-setup).

## Google Cast delivery

The legacy `dlna_candidates` field also includes Google Cast media players with `transport: "cast"`. Enabled registry entities must support `PLAY_MEDIA`; unavailable and unknown entities remain discoverable but cannot receive recordings. Cast devices require explicit `default_targets` selection and are excluded from Alexa’s `use_all` setting.

Delivery uses `media_player.play_media` with the token-protected local MP3 URL as `media_content_id` and `audio/mpeg` as `media_content_type`. Cast never uses Alexa’s notify route, Sonos announcement mode or the DLNA resume manager. Optional speaker tests return `requires_confirmation: false` and do not change selection. Existing audio expiry, authentication and fetch receipts apply unchanged. Service acceptance and fetch receipts do not establish audible playback.

## EchoMuse delivery

Discovery requires an enabled ESPHome media player attached to a device with manufacturer `EchoMuse`. Online players must support `PLAY_MEDIA` and `MEDIA_ANNOUNCE`; unavailable/unknown players remain listed but cannot receive recordings. EchoMuse requires explicit selection in `default_targets`.

Delivery calls `media_player.play_media` with the local token-protected MP3 URL, `media_content_type: "audio/mpeg"` and `announce: true`. Home Assistant may proxy/transcode the audio for ESPHome. The EchoMuse controller retrieves the audio and streams it to its Dot. Music handling belongs to EchoMuse; HomeCall does not apply DLNA restoration. Tests are optional and do not select speakers. See [setup and limitations](echomuse.md).

## Voice Satellite delivery

Discovery lists enabled `assist_satellite` entities from the `voice_satellite` platform whose device also has an enabled `voice_satellite` media player. The target ID is the satellite entity, and its device name labels the speaker. Each candidate also includes `player`, the media player entity used for delivery. A kiosk is unavailable while either entity is unavailable or unknown, which happens while no browser has the Voice Satellite card open. An online player must support `PLAY_MEDIA`. Voice Satellite kiosks require explicit selection.

Delivery calls `media_player.play_media` on `player` with `media_content_type: "audio/mpeg"`, `announce: true` and the root-relative path `/api/homecall/audio/<token>.mp3`. The Voice Satellite card signs that path over its authenticated connection and fetches it from its own page origin. HomeCall's local and public addresses are not used, so a kiosk that opens Home Assistant over HTTPS can play the clip while the internal URL is HTTP. `assist_satellite.announce` is not used. Home Assistant makes that action's media ID absolute with its internal URL, which an HTTPS page blocks as mixed content.

Non-administrators need read and control permission on both the satellite and its media player. Speaker tests need no configured local address.
