# Security and privacy

## Audio and access

HomeCall Card buffers microphone audio in browser memory. It uploads only after Send; Discard stops capture and clears the local buffers. The integration converts audio in a temporary directory and retains MP3 bytes in memory for up to 180 seconds. Temporary files are removed after conversion; unloading clears stored clips.

Status and send endpoints require Home Assistant authentication. Integration settings additionally require administrator access. All target IDs are validated against the configured allowlist and current availability.

Alexa cannot authenticate to HA. The audio endpoint therefore permits retrieval by anyone holding its random, expiring token URL. Treat that URL like a short-lived credential. For Alexa delivery, audio is transmitted to Amazon/Alexa; HomeCall’s local retention does not describe Amazon’s retention policy. DLNA, Sonos, Music Assistant, Google Cast and EchoMuse use the local audio address; the relevant speaker, server or controller retrieves the clip. Playback integrations and their services may have their own data handling. Do not use it to distribute confidential recordings.

## Reporting

Do not publish exploitable details or tokens in an issue. Use **Security → Report a vulnerability** in the repository when private reporting is available. If unavailable, open a general request for a private reporting channel without exploit details or personal data. There is no guaranteed response-time SLA.

Security fixes target the current release. No formal audit or enterprise support guarantee is claimed.
