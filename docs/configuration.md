# Configuration

## Connection

Choose **Use Home Assistant address** to use the Nabu Casa remote domain when present, otherwise the configured external HTTPS address. HomeCall evaluates that address when creating delivery links, so changes to the system address take effect without reconfiguring HomeCall.

Choose **Own HTTPS address** to provide another publicly reachable HTTPS origin. Use an origin such as `https://ha.example.com` or `https://ha.example.com:8443`; credentials, path prefixes, query strings, and fragments are rejected. A trailing slash is normalized. The URL validator checks syntax, not reachability or certificate validity.

Alexa needs to fetch `/api/homecall/audio/<token>.mp3` from this address. An extra reverse-proxy login screen prevents retrieval. Avoid changing the security of your whole Home Assistant instance to accommodate audio: the integration already exposes only the temporary token-protected audio endpoint without HA authentication.

## Allowed devices

**All devices** includes newly discovered Alexa `notify.*_speak` entities automatically. **Custom selection** restricts the card and upload API to the chosen devices. Switching to all-device mode preserves the stored custom selection for later use.

Entities must come from the built-in `alexa_devices` integration, be enabled, and exist in Home Assistant. Unavailable entities appear in the list but cannot receive a message. The card's defaults are a subset of this administrator-controlled scope.

## Change settings

Open **Settings → Devices & services → HomeCall → Configure**. The native HomeCall settings panel controls connection and devices. Only Home Assistant administrators can read or write integration settings; authenticated users can use the recording card and permitted speakers.

No YAML entry is required. HomeCall supports one configuration entry per instance.
