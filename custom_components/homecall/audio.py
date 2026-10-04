"""Validate microphone WAV files and encode Alexa-compatible MP3 audio."""

import io
import subprocess
import tempfile
import wave
from pathlib import Path


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


def convert_wav(data):
    with tempfile.TemporaryDirectory(prefix="homecall-") as folder:
        source = Path(folder) / "input.wav"
        dest = Path(folder) / "output.mp3"
        source.write_bytes(data)
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-nostdin",
                "-y",
                "-i",
                str(source),
                "-t",
                "60",
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
