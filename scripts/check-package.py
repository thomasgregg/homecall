"""Check that a release archive contains the matching bundled frontend."""

import argparse
import json
from pathlib import Path
from zipfile import ZipFile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    component = Path("custom_components/homecall")
    with ZipFile(args.archive) as archive:
        assert archive.testzip() is None, "Corrupt archive"
        names = set(archive.namelist())
        required = {
            "manifest.json",
            "__init__.py",
            "dashboard.py",
            "frontend/homecall-card.js",
            "frontend/homecall-settings.js",
            "frontend/homecall-recorder-worklet.js",
        }
        assert required <= names, f"Missing package files: {required - names}"
        for name in required:
            assert archive.read(name) == (component / name).read_bytes(), name
        manifest = json.loads(archive.read("manifest.json"))
        assert "lovelace" in manifest["dependencies"]
        assert (
            f"HomeCall Card v{manifest['version']}"
            in archive.read("frontend/homecall-card.js").decode()
        )
        assert not any(name.startswith(("card/", "tests/", "node_modules/")) for name in names), (
            "Development files in integration archive"
        )
    print(f"Verified {args.archive}: HomeCall {manifest['version']} with matching bundled card")


if __name__ == "__main__":
    main()
