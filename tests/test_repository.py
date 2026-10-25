"""Check distribution metadata, translation parity and documentation links."""

import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "homecall"


def test_manifest_and_version():
    manifest = json.loads((COMPONENT / "manifest.json").read_text())
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert manifest["domain"] == project["name"] == "homecall"
    assert manifest["version"] == project["version"]
    assert manifest["config_flow"] is True
    assert "alexa_devices" in manifest["after_dependencies"]
    assert manifest["codeowners"] == ["@thomasgregg"]
    assert (COMPONENT / "frontend" / "homecall-settings.js").is_file()
    assert "lovelace" in manifest["dependencies"]
    card_package = json.loads((ROOT / "card/package.json").read_text())
    card_lock = json.loads((ROOT / "card/package-lock.json").read_text())
    assert manifest["version"] == card_package["version"] == card_lock["version"]
    assert card_lock["packages"][""]["version"] == manifest["version"]
    assert (
        f"HomeCall Card v{manifest['version']}"
        in (COMPONENT / "frontend/homecall-card.js").read_text()
    )


def test_translation_parity():
    def keys(value, prefix=""):
        return {
            path
            for key, child in value.items()
            for path in (
                keys(child, prefix + key + ".") if isinstance(child, dict) else {prefix + key}
            )
        }

    strings = json.loads((COMPONENT / "strings.json").read_text())
    for language in ("en", "de"):
        assert keys(
            json.loads((COMPONENT / "translations" / f"{language}.json").read_text())
        ) == keys(strings)


def test_local_documentation_links():
    for document in [*ROOT.glob("*.md"), *ROOT.glob("docs/*.md")]:
        links = re.findall(r"\]\(([^)]+)\)|(?:src|href)=\"([^\"]+)\"", document.read_text())
        for markdown, html in links:
            target = markdown or html
            if ":" not in target and not target.startswith("#"):
                assert (document.parent / target.split("#")[0]).exists(), (document, target)
