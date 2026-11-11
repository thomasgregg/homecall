"""Validate custom chime safety and FFmpeg mixing into one MP3."""

import io
import subprocess
import wave
import pytest

from custom_components.homecall.audio import (
    convert_wav, resolve_chime_path, validated_chime_duration
)


def make_cue(path, seconds):
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", f"sine=frequency=600:duration={seconds}", str(path)],
        check=True,
    )


def voice():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(b"\x00\x00" * 24000)
    return buf.getvalue()


def test_mp3_cue_is_concatenated_into_one_mp3(tmp_path):
    folder = tmp_path / "chimes"
    folder.mkdir()
    cue = folder / "friendly.mp3"
    make_cue(cue, 2)
    assert 1.9 < validated_chime_duration(str(cue), folder) < 2.1
    audio = convert_wav(voice(), True, cue)
    assert len(audio) > 10000
    assert audio.startswith(b"ID3") or audio.startswith(b"\xff\xfb")


def test_rejects_path_traversal_and_symlink(tmp_path):
    folder = tmp_path / "chimes"
    folder.mkdir()
    outside = tmp_path / "outside.mp3"
    make_cue(outside, 1)
    with pytest.raises(ValueError):
        resolve_chime_path(str(outside), folder)
    (folder / "shortcut.mp3").symlink_to(outside)
    with pytest.raises(ValueError):
        resolve_chime_path(str(folder / "shortcut.mp3"), folder)


def test_rejects_long_cue(tmp_path):
    folder = tmp_path / "chimes"
    folder.mkdir()
    cue = folder / "too_long.wav"
    make_cue(cue, 11)
    with pytest.raises(ValueError):
        validated_chime_duration(str(cue), folder)
