"""Deliver recordings to Voice Satellite browser kiosks.

Voice Satellite (github.com/jxlarrea/voice-satellite-card-integration) turns a
dashboard browser into an Assist satellite. Each kiosk device has an
``assist_satellite`` entity, used here to find and name the kiosk, and a
``media_player`` entity whose playback runs in the kiosk's browser.

HomeCall plays through the media player. The card resolves a root-relative
clip path against the page's own address, so playback works whether the kiosk
opens Home Assistant over HTTP or HTTPS. ``assist_satellite.announce`` instead
receives an absolute URL built from Home Assistant's internal URL, which a
browser blocks as mixed content when that URL is HTTP and the kiosk page is
HTTPS.
"""

PLATFORM = "voice_satellite"
TRANSPORT = "voice_satellite"


def audio_path(token):
    """Return the root-relative clip path the kiosk browser fetches."""
    return "/api/homecall/audio/" + token + ".mp3"
