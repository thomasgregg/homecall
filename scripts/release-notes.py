"""Generate release notes in the shared HomeCall format."""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--previous-tag", default="")
    parser.add_argument("--validation", required=True)
    args = parser.parse_args()
    version = args.tag.removeprefix("v")
    changelog = Path("CHANGELOG.md").read_text()
    marker = f"## {version}\n"
    if marker not in changelog:
        parser.error(f"Missing changelog entry for {version}")
    changes = changelog.split(marker, 1)[1].split("\n## ", 1)[0].strip()
    if args.repository.endswith("/homecall-card"):
        installation = (
            "Install or update HomeCall Card through HACS, then refresh the dashboard. "
            "For manual installation, use `homecall-card.js`. "
            "The HomeCall integration is installed separately."
        )
    else:
        installation = (
            "Install or update HomeCall through HACS, then restart Home Assistant. "
            "For manual installation, extract `homecall.zip` into `custom_components/homecall`. "
            "HomeCall Card is installed separately."
        )
    base = f"https://github.com/{args.repository}"
    link = (
        f"{base}/compare/{args.previous_tag}...{args.tag}"
        if args.previous_tag
        else f"{base}/commits/{args.tag}"
    )
    print(
        f"## Changes\n\n{changes}\n\n"
        f"## Installation\n\n{installation}\n\n"
        f"## Validation\n\n{args.validation}\n\n"
        f"## Full changelog\n\n[View changes]({link})"
    )


if __name__ == "__main__":
    main()
