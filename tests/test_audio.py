"""Exercise actual WAV parsing and FFmpeg conversion, including rejected input."""

import subprocess
import wave

import pytest

from custom_components.homecall.audio import convert_wav, validate_wav


@pytest.mark.parametrize("seconds", [0.2, 1, 60, 60.5])
def test_supported_durations(wav_bytes, seconds):
    assert validate_wav(wav_bytes(seconds=seconds)) == pytest.approx(seconds)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"seconds": 0.1},
        {"seconds": 61},
        {"channels": 2},
        {"width": 1},
        {"rate": 7999},
        {"rate": 48001},
    ],
)
def test_rejects_unsupported_audio(wav_bytes, kwargs):
    with pytest.raises(ValueError):
        validate_wav(wav_bytes(**kwargs))


def test_truncated_payload(wav_bytes):
    with pytest.raises(ValueError):
        validate_wav(wav_bytes()[:-2])


@pytest.mark.parametrize("body", [b"", b"not a wav", b"RIFF" + b"\0" * 30])
def test_corrupt_payload(body):
    with pytest.raises((ValueError, wave.Error, EOFError)):
        validate_wav(body)


def test_real_ffmpeg_conversion(wav_bytes, tmp_path):
    audio = convert_wav(wav_bytes())
    assert len(audio) > 0
    output = tmp_path / "clip.mp3"
    output.write_bytes(audio)
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(output),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    import json

    stream = json.loads(result.stdout)["streams"][0]
    assert stream["codec_name"] == "mp3"
    assert stream["channels"] == 1
    assert stream["sample_rate"] == "24000"
