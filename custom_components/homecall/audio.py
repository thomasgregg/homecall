"""Validate microphone WAV files and encode Alexa-compatible MP3 audio."""

import io
import subprocess
import tempfile
import wave
from pathlib import Path

CHIME_FILE = Path(__file__).parent / "assets" / "announcement-chime.wav"


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


def convert_wav(data, prepend_chime=False):
    with tempfile.TemporaryDirectory(prefix="homecall-") as folder:
        source = Path(folder) / "input.wav"
        dest = Path(folder) / "output.mp3"
        source.write_bytes(data)
        inputs = ["-i", str(source), "-t", "60"]
        if prepend_chime:
            # Decode both sources to the same PCM format before concatenation.
            # The voice duration is validated separately; do not cap the combined
            # output at 60 seconds and accidentally truncate the final words.
            inputs = [
                "-i",
                str(CHIME_FILE),
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
