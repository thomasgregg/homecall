"""Validate microphone WAV files and encode Alexa-compatible MP3 audio."""

import io
import subprocess
import tempfile
import wave
from pathlib import Path

from homeassistant.components.media_source import async_resolve_media
from homeassistant.components.media_source.error import Unresolvable

CHIME_FILE = Path(__file__).parent / "assets" / "announcement-chime.wav"
LOCAL_MEDIA_PREFIX = "media-source://media_source/"
MAX_CHIME_SECONDS = 10
MAX_CHIME_BYTES = 2 * 1024 * 1024
CHIME_RATE = 24000


async def async_custom_chime(hass, media_id):
    """Read an optional local MP3 via Home Assistant's Media Source resolver."""
    source, _, filename = media_id.removeprefix(LOCAL_MEDIA_PREFIX).partition("/")
    if not media_id.startswith(LOCAL_MEDIA_PREFIX) or Path(filename).suffix.lower() != ".mp3":
        return None
    if not (root := hass.config.media_dirs.get(source)):
        return None
    try:
        media = await async_resolve_media(hass, media_id, target_media_player=None)
        if media.path is not None:
            return await hass.async_add_executor_job(read_custom_chime, media.path, Path(root))
    except Unresolvable, ValueError, OSError, subprocess.SubprocessError:
        return None
    return None


def read_custom_chime(path, root):
    """Validate a bounded MP3 and return a normalized WAV with its decoded duration."""
    path = path.resolve(strict=True)
    if not path.is_relative_to(root.resolve(strict=True)) or not path.is_file():
        raise ValueError("Chime must be a file in its Home Assistant media directory")
    with path.open("rb") as file:
        data = file.read(MAX_CHIME_BYTES + 1)
    if len(data) > MAX_CHIME_BYTES:
        raise ValueError("Chime file is too large")
    pcm = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-xerror",
            "-nostdin",
            "-protocol_whitelist",
            "pipe",
            "-f",
            "mp3",
            "-i",
            "pipe:0",
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            str(CHIME_RATE),
            "-t",
            str(MAX_CHIME_SECONDS + 0.01),
            "-f",
            "s16le",
            "pipe:1",
        ],
        input=data,
        capture_output=True,
        check=True,
        timeout=10,
    ).stdout
    duration = len(pcm) / (2 * CHIME_RATE)
    if not 0 < duration <= MAX_CHIME_SECONDS:
        raise ValueError("Chime must be at most 10 seconds")
    result = io.BytesIO()
    with wave.open(result, "wb") as wav:
        wav.setparams((1, 2, CHIME_RATE, 0, "NONE", "not compressed"))
        wav.writeframes(pcm)
    return result.getvalue(), duration


def chime_duration():
    """Read the duration of the bundled, user-selected cue."""
    with wave.open(str(CHIME_FILE), "rb") as wav:
        return wav.getnframes() / wav.getframerate()


def validate_wav(data):
    with wave.open(io.BytesIO(data)) as wav:
        duration = wav.getnframes() / wav.getframerate()
        if (
            wav.getnchannels() != 1
            or wav.getsampwidth() != 2
            or not 8000 <= wav.getframerate() <= 48000
            or not 0.2 <= duration <= 60.5
        ):
            raise ValueError("Bitte zwischen 0,2 und 60 Sekunden sprechen.")
        if len(wav.readframes(wav.getnframes())) != wav.getnframes() * 2:
            raise ValueError("Unvollständige Aufnahme.")
        return duration


def convert_wav(data, prepend_chime=False, custom_chime=None):
    with tempfile.TemporaryDirectory(prefix="homecall-") as folder:
        source = Path(folder) / "input.wav"
        dest = Path(folder) / "output.mp3"
        source.write_bytes(data)
        inputs = ["-i", str(source), "-t", "60"]
        if prepend_chime:
            cue = CHIME_FILE
            if custom_chime is not None:
                cue = Path(folder) / "chime.wav"
                cue.write_bytes(custom_chime)
            # Decode both sources to the same PCM format before concatenation.
            # The voice duration is validated separately; do not cap the combined
            # output at 60 seconds and accidentally truncate the final words.
            inputs = [
                "-i",
                str(cue),
                "-i",
                str(source),
                "-filter_complex",
                "[0:a]aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono[c];"
                "[1:a]aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono[v];"
                "[c][v]concat=n=2:v=0:a=1[out]",
                "-map",
                "[out]",
            ]
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-nostdin",
                "-y",
                *inputs,
                "-ac",
                "1",
                "-codec:a",
                "libmp3lame",
                "-b:a",
                "48k",
                "-ar",
                "24000",
                "-write_xing",
                "0",
                "-map_metadata",
                "-1",
                str(dest),
            ],
            check=True,
            timeout=30,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        return dest.read_bytes()


def test_audio():
    """A short quiet chime encoded exactly like microphone recordings."""
    import math
    import struct

    buffer = io.BytesIO()
    rate = 24000
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        samples = []
        for i in range(rate * 3):
            t = i / rate
            envelope = min(t / 0.08, (3 - t) / 0.2, 1)
            samples.append(
                struct.pack("<h", int(1800 * envelope * math.sin(2 * math.pi * 660 * t)))
            )
        wav.writeframes(b"".join(samples))
    return convert_wav(buffer.getvalue())
